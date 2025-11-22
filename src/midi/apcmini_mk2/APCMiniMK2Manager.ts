// src/midi/APCMiniMK2Manager.ts

import { MIDIManager } from "../midiManager";
import {
    clampGridSelection,
    getCurrentTimestamp,
    pseudoRandomFromSeed,
    type NumericRange,
} from "../utils";
import { RandomFaderController, type FaderButtonMode } from "./RandomFaderController";
export type { FaderButtonMode } from "./RandomFaderController";

// --- 定数定義: MIDIステータスとノートレンジ ---
const MIDI_STATUS = {
    NOTE_ON: 0x90,
    NOTE_OFF: 0x80,
    CONTROL_CHANGE: 0xB0,
};

// MIDI出力専用のステータス。入力判定には既存の MIDI_STATUS を使い、
// LED 制御などの送信時はこのステータスを使用する。
const MIDI_OUTPUT_STATUS = {
    NOTE_ON: 0x96,
};

const NOTE_RANGES = {
    GRID: { START: 0, END: 63 },
    FADER_BUTTONS: { START: 100, END: 107 },
    SIDE_BUTTONS: { START: 112, END: 119 }, // シーン切り替えボタン
    FADERS: { START: 48, END: 56 },
    FADER_BUTTON_8: 122, // 9番目のフェーダーボタン
};

const GRID_ROWS = 8;
const GRID_COLS = 8;

const RANDOM_LOW_DURATION_RANGE: NumericRange = { min: 1200, max: 4000 };
const RANDOM_HIGH_DURATION_RANGE: NumericRange = { min: 80, max: 220 };

// LEDのベロシティ (色) 定義
const LED_COLORS = {
    OFF: 0,
    RED: 3,           // 選択可能/初期色 (変更: 5 -> 3)
    // BLUE はシーン毎に色を割り当てるため個別配列で扱う
    // GREEN はデバイス上は紫に見えていたが、ランダムONは専用の色に変更
    BRIGHT_WHITE: 127, // シーン選択中/トグルON
};

// サイドボタン（シーン）ごとのアクティブ色マップ (index: scene 0..7)
const SIDE_ACTIVE_COLORS = [
    5,   // scene 0 -> 赤 (ユーザ指定)
    60,  // scene 1 -> オレンジ
    56,  // scene 2 -> うすピンク
    53,  // scene 3 -> 濃いピンク
    37,  // scene 4 -> 青
    32,  // scene 5 -> 水色
    21,  // scene 6 -> 青緑
    13,  // scene 7 -> 黄緑
];

// ランダム行（最下段）がONのときの色
const RANDOM_ON_COLOR = 45; // 紫

// デフォルトのアクティブ色（フォールバック）
const DEFAULT_ACTIVE_COLOR = 41;


/**
 * グリッドパッドのパラメーター状態を定義するインターフェース
 */
export interface GridParameterState {
    selectedRow: number; // 現在の選択インデックス (手動選択時)
    maxOptions: number;  // このパラメーターの有効な選択肢の数 (0-8)
    isRandom: boolean;   // ランダムモードが有効か
    randomValue: number; // BPM同期で更新されるランダムな値
}

/**
 * APC Mini MK2 MIDIコントローラーの入出力と状態を管理するクラス
 */
export class APCMiniMK2Manager extends MIDIManager {

    public faderValues: number[];
    private faderValuesPrev: number[];
    public faderButtonToggleState: number[];
    public sideButtonToggleState: number[];

    public currentSceneIndex: number; // 現在選択されているシーンのインデックス (0-7)
    private faderButtonMode: FaderButtonMode;
    private readonly randomFaderController: RandomFaderController;

    /** グリッドパッドの全状態を保持 [sceneIndex][columnIndex] */
    public gridRadioState: GridParameterState[][];

    constructor() {
        super();
        this.faderValues = new Array(9).fill(0);
        this.faderValuesPrev = new Array(9).fill(1);
        this.faderButtonToggleState = new Array(9).fill(0);
        this.sideButtonToggleState = new Array(8).fill(0);
        this.currentSceneIndex = 0;
        this.faderButtonMode = "random";
        this.randomFaderController = new RandomFaderController(9, RANDOM_LOW_DURATION_RANGE, RANDOM_HIGH_DURATION_RANGE);

        // 8シーン x 8カラムの状態を初期化
        this.gridRadioState = Array(GRID_COLS).fill(0).map(() =>
            Array(GRID_COLS).fill(0).map(() => ({
                selectedRow: 0,
                maxOptions: 8,
                isRandom: false,
                randomValue: 0,
            }))
        );

        this.sideButtonToggleState[this.currentSceneIndex] = 1;
        this.onMidiMessageCallback = this.handleMIDIMessage.bind(this);
    }

    public selectScene(index: number): void {
        if (index < 0 || index >= GRID_COLS) {
            return;
        }

        this.currentSceneIndex = index;
        this.sideButtonToggleState.fill(0);
        this.sideButtonToggleState[index] = 1;
    }

    /**
    * 現在選択中のシーンのパラメーター値を取得する。ランダムモードを自動でチェック。
    */
    public getParamValues(sceneIndex: number = this.currentSceneIndex): number[] {
        const params = this.gridRadioState[sceneIndex];
        return params.map(param => param.isRandom ? param.randomValue : param.selectedRow);
    }

    /**
     * 特定のシーンのmaxOptionsを一括設定する。
     */
    public setMaxOptionsForScene(sceneIndex: number, optionsArray: number[]): void {
        if (sceneIndex < 0 || sceneIndex >= GRID_COLS || optionsArray.length !== GRID_COLS) {
            console.error("Invalid scene index or options array length for setMaxOptionsForScene.");
            return;
        }

        for (let col = 0; col < GRID_COLS; col++) {
            const param = this.gridRadioState[sceneIndex][col];
            const clampedMax = Math.max(0, Math.min(8, optionsArray[col]));
            param.maxOptions = clampedMax;

            if (clampedMax === 0) {
                param.selectedRow = 0;
                param.randomValue = 0;
                param.isRandom = false;
                continue;
            }

            if (param.selectedRow >= clampedMax) {
                param.selectedRow = clampedMax - 1;
            }

            if (param.randomValue >= clampedMax) {
                param.randomValue = clampedMax - 1;
            }
        }
    }

    /**
     * メインループからの更新処理。ランダム値の更新とLED出力を実行する。
     */
    public update(tempoIndex: number = 0): void {
        this.updateRandomGridValues(tempoIndex);

        const now = getCurrentTimestamp();
        this.randomFaderController.process(now, this.faderButtonMode, this.faderValues);

        this.midiOutputSendControls();
    }

    private updateRandomGridValues(tempoIndex: number): void {
        for (let sceneIndex = 0; sceneIndex < GRID_COLS; sceneIndex++) {
            const params = this.gridRadioState[sceneIndex];

            for (let colIndex = 0; colIndex < GRID_COLS; colIndex++) {
                const param = params[colIndex];

                if (param.maxOptions === 0) {
                    param.isRandom = false;
                    param.randomValue = 0;
                    continue;
                }

                if (!param.isRandom) {
                    continue;
                }

                const seed = tempoIndex + colIndex;
                param.randomValue = Math.floor(pseudoRandomFromSeed(seed) * param.maxOptions);
            }
        }
    }

    /**
     * MIDIメッセージ受信時の処理 (入力)
     */
    protected handleMIDIMessage(message: WebMidi.MIDIMessageEvent): void {
        const [statusByte, dataByte1, dataByte2] = message.data;
        const noteNumber = dataByte1;
        const velocity = dataByte2;

        if (this.handleFaderButton(statusByte, noteNumber, velocity)) {
            return;
        }

        if (this.handleSideButton(statusByte, noteNumber, velocity)) {
            return;
        }

        if (this.handleGridPad(statusByte, noteNumber, velocity)) {
            return;
        }

        this.handleFaderControlChange(statusByte, noteNumber, velocity);
    }

    private handleFaderButton(statusByte: number, noteNumber: number, velocity: number): boolean {
        const isFaderButton = statusByte === MIDI_STATUS.NOTE_ON && (
            (noteNumber >= NOTE_RANGES.FADER_BUTTONS.START && noteNumber <= NOTE_RANGES.FADER_BUTTONS.END) ||
            noteNumber === NOTE_RANGES.FADER_BUTTON_8
        );

        if (!isFaderButton) {
            return false;
        }

        if (velocity > 0) {
            const index = noteNumber >= NOTE_RANGES.FADER_BUTTONS.START ? noteNumber - NOTE_RANGES.FADER_BUTTONS.START : 8;
            this.faderButtonToggleState[index] = 1 - this.faderButtonToggleState[index];
            this.updateFaderValue(index);
        }

        return true;
    }

    private handleSideButton(statusByte: number, noteNumber: number, velocity: number): boolean {
        const isSideButton = statusByte === MIDI_STATUS.NOTE_ON &&
            noteNumber >= NOTE_RANGES.SIDE_BUTTONS.START &&
            noteNumber <= NOTE_RANGES.SIDE_BUTTONS.END;

        if (!isSideButton) {
            return false;
        }

        if (velocity > 0) {
            const sceneIndex = noteNumber - NOTE_RANGES.SIDE_BUTTONS.START;
            this.selectScene(sceneIndex);
        }

        return true;
    }

    private handleGridPad(statusByte: number, noteNumber: number, velocity: number): boolean {
        const isGridPad = statusByte === MIDI_STATUS.NOTE_ON &&
            noteNumber >= NOTE_RANGES.GRID.START &&
            noteNumber <= NOTE_RANGES.GRID.END;

        if (!isGridPad) {
            return false;
        }

        if (velocity <= 0) {
            return true;
        }

        const gridIndex = noteNumber - NOTE_RANGES.GRID.START;
        const colIndex = gridIndex % GRID_COLS;
        const rowIndex = GRID_ROWS - 1 - Math.floor(gridIndex / GRID_COLS);
        const param = this.gridRadioState[this.currentSceneIndex][colIndex];

        if (param.maxOptions === 0) {
            param.isRandom = false;
            param.selectedRow = 0;
            param.randomValue = 0;
            return true;
        }

        if (rowIndex === 7) {
            param.isRandom = !param.isRandom;
            if (!param.isRandom) {
                param.selectedRow = clampGridSelection(param.selectedRow, param.maxOptions);
            }
            return true;
        }

        if (rowIndex < param.maxOptions) {
            param.selectedRow = rowIndex;
            param.isRandom = false;
        }
        return true;
    }

    private handleFaderControlChange(statusByte: number, noteNumber: number, value: number): void {
        const isFaderControlChange = statusByte === MIDI_STATUS.CONTROL_CHANGE &&
            noteNumber >= NOTE_RANGES.FADERS.START &&
            noteNumber <= NOTE_RANGES.FADERS.END;

        if (!isFaderControlChange) {
            return;
        }

        const index = noteNumber - NOTE_RANGES.FADERS.START;
        const normalizedValue = value / 127;
        this.faderValuesPrev[index] = normalizedValue;
        this.updateFaderValue(index);
    }

    /**
     * フェーダー値の更新。ボタンがONの場合は強制的に0にする。
     */
    protected updateFaderValue(index: number): void {
        const now = getCurrentTimestamp();
        const toggleState = this.faderButtonToggleState[index];
        const prevValue = this.faderValuesPrev[index];
        this.faderValues[index] = this.randomFaderController.recomputeValue(
            index,
            this.faderButtonMode,
            toggleState,
            prevValue,
            now,
        );
    }

    /**
     * APC Mini MK2へのMIDI出力 (LED制御)
     */
    protected midiOutputSendControls(): void {
        this.sendSceneButtonLeds();
        this.sendGridPadLeds();
        this.sendFaderButtonLeds();
    }

    private sendSceneButtonLeds(): void {
        for (let i = 0; i < 8; i++) {
            const note = NOTE_RANGES.SIDE_BUTTONS.START + i;
            const velocity = (i === this.currentSceneIndex) ? LED_COLORS.BRIGHT_WHITE : LED_COLORS.OFF;
            this.sendNoteOn(MIDI_STATUS.NOTE_ON, note, velocity);
        }
    }

    private sendGridPadLeds(): void {
        const currentScene = this.gridRadioState[this.currentSceneIndex];

        for (let col = 0; col < GRID_COLS; col++) {
            const param = currentScene[col];
            const activeRows = param.maxOptions;
            const hasOptions = activeRows > 0;

            for (let row = 0; row < GRID_ROWS; row++) {
                const gridIndex = (GRID_ROWS - 1 - row) * GRID_COLS + col;
                const note = NOTE_RANGES.GRID.START + gridIndex;
                let velocity = LED_COLORS.OFF;

                if (hasOptions) {
                    if (row === 7) {
                        velocity = param.isRandom ? RANDOM_ON_COLOR : LED_COLORS.RED;
                    }
                    else if (row < activeRows) {
                        const currentValue = param.isRandom ? param.randomValue : param.selectedRow;

                        if (row === currentValue) {
                            const sceneColor = SIDE_ACTIVE_COLORS[this.currentSceneIndex] ?? DEFAULT_ACTIVE_COLOR;
                            velocity = sceneColor;
                        } else {
                            velocity = LED_COLORS.RED;
                        }
                    }
                }

                this.sendNoteOn(MIDI_OUTPUT_STATUS.NOTE_ON, note, velocity);
            }
        }
    }

    private sendFaderButtonLeds(): void {
        for (let i = 0; i < 9; i++) {
            const note = (i < 8)
                ? NOTE_RANGES.FADER_BUTTONS.START + i
                : NOTE_RANGES.FADER_BUTTON_8;
            const velocity = this.faderButtonToggleState[i] ? LED_COLORS.BRIGHT_WHITE : LED_COLORS.OFF;
            this.sendNoteOn(MIDI_STATUS.NOTE_ON, note, velocity);
        }
    }

    private sendNoteOn(status: number, note: number, velocity: number): void {
        this.send(status, note, velocity);
    }

    public setFaderButtonMode(mode: FaderButtonMode): void {
        if (this.faderButtonMode === mode) {
            return;
        }

        this.faderButtonMode = mode;
        const now = getCurrentTimestamp();
        this.randomFaderController.syncForMode(
            mode,
            this.faderButtonToggleState,
            this.faderValuesPrev,
            this.faderValues,
            now,
        );
    }

    public getFaderButtonMode(): FaderButtonMode {
        return this.faderButtonMode;
    }

    /**
     * MIDIメッセージを送信するヘルパー (MIDIManager経由)
     */
    private send(status: number, data1: number, data2: number): void {
        this.sendMessage([status, data1, data2]);
    }

    public async init(): Promise<void> {
        // 基底クラスで初期化済み
    }
}