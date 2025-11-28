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
const RANDOM_ROW_INDEX = GRID_ROWS - 1;

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
// 3ページ目(sceneIndex === 2)では、カラーパレットの色順と対応させるため、
// カラムインデックスに応じて以下の色が使用される：
// カラム0: 赤, カラム1: オレンジ, カラム2: 黄色, カラム3: 緑,
// カラム4: 青, カラム5: インディゴ(濃いピンク), カラム6: 紫(うすいピンク), カラム7: シアン(水色)
const SIDE_ACTIVE_COLORS = [
    5,   // カラム0 -> 赤 (#FF0000)
    9,   // カラム1 -> オレンジ (#FFA500)
    13,  // カラム2 -> 黄色 (#d8d813ff) - Light Green/Yellow
    17,  // カラム3 -> 緑 (#008000)
    41,  // カラム4 -> 青 (#0000FF)
    53,  // カラム5 -> インディゴ/濃いピンク (#4B0082)
    56,  // カラム6 -> 紫/うすいピンク (#800080)
    37,  // カラム7 -> シアン/水色 (#00FFFF)
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

    public currentSceneIndex: number; // 現在選択されているシーンのインデックス (0-7)
    private faderButtonMode: FaderButtonMode;
    private readonly randomFaderController: RandomFaderController;

    /** グリッドパッドの全状態を保持 [sceneIndex][columnIndex] */
    public gridRadioState: GridParameterState[][];

    /**
     * APCMiniMK2Managerクラスのコンストラクタです。
     * フェーダー、ボタン、グリッドの状態を初期化し、MIDIメッセージのコールバックを設定します。
     * グリッドの状態（gridRadioState）は、8つのシーン × 8つのカラムの2次元配列として初期化され、
     * 各セルは選択状態、最大オプション数、ランダムモードの状態などを保持します。
     * また、ランダムフェーダーコントローラーも初期化され、時間経過による自動変化の準備を行います。
     * 親クラス（MIDIManager）のコンストラクタも呼び出され、MIDIデバイスへの接続が開始されます。
     */
    constructor() {
        super();
        this.faderValues = new Array(9).fill(0);
        this.faderValuesPrev = new Array(9).fill(1);
        this.faderButtonToggleState = new Array(9).fill(0);
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

        this.onMidiMessageCallback = this.handleMIDIMessage.bind(this);
    }

    /**
     * 現在アクティブなシーンを変更します。
     * シーンインデックスは0から7の範囲で指定します。
     * 範囲外のインデックスが指定された場合は無視されます。
     * シーンが切り替わると、グリッドパッドのLED表示や制御対象のパラメータセットが
     * 即座に新しいシーンのものに切り替わります。
     *
     * @param index 切り替え先のシーンインデックス（0-7）。
     */
    public selectScene(index: number): void {
        if (index < 0 || index >= GRID_COLS) {
            return;
        }

        this.currentSceneIndex = index;
    }

    /**
     * 指定されたシーン（デフォルトは現在のシーン）のパラメータ値の配列を取得します。
     * 各カラム（0-7）について、ランダムモードが有効な場合は現在のランダム値を、
     * 無効な場合は手動で選択された行インデックスを返します。
     * これにより、描画側はランダムか手動かを意識せずに、現在のパラメータ値を取得して利用できます。
     *
     * @param sceneIndex 取得対象のシーンインデックス（省略時は現在のシーン）。
     * @returns パラメータ値（0〜maxOptions-1）の配列。
     */
    public getParamValues(sceneIndex: number = this.currentSceneIndex): number[] {
        const params = this.gridRadioState[sceneIndex];
        return params.map((param) => (param.isRandom ? param.randomValue : param.selectedRow));
    }

    /**
     * 指定されたシーンの各カラムにおける最大選択肢数（maxOptions）を一括設定します。
     * アプリケーションの初期化時や設定変更時に呼び出され、
     * 各パラメータが取りうる値の範囲（例：0〜3、0〜7など）を定義します。
     * maxOptionsが変更されると、現在の選択値が範囲内に収まるように自動的に調整（クランプ）されます。
     *
     * @param sceneIndex 設定対象のシーンインデックス。
     * @param optionsArray 各カラムのmaxOptionsを指定する数値配列（長さ8）。
     */
    public setMaxOptionsForScene(sceneIndex: number, optionsArray: number[]): void {
        if (sceneIndex < 0 || sceneIndex >= GRID_COLS || optionsArray.length !== GRID_COLS) {
            console.error("Invalid scene index or options array length for setMaxOptionsForScene.");
            return;
        }

        for (let col = 0; col < GRID_COLS; col++) {
            const param = this.gridRadioState[sceneIndex][col];
            this.applyMaxOptions(param, optionsArray[col]);
        }
    }

    private applyMaxOptions(param: GridParameterState, requestedMax: number): void {
        const clampedMax = Math.max(0, Math.min(GRID_ROWS, requestedMax));
        param.maxOptions = clampedMax;

        if (!this.hasSelectableOptions(param)) {
            this.resetGridParam(param);
            return;
        }

        const maxSelectableIndex = this.getMaxSelectableIndex(param);

        if (param.selectedRow > maxSelectableIndex) {
            param.selectedRow = maxSelectableIndex;
        }

        if (param.randomValue > maxSelectableIndex) {
            param.randomValue = maxSelectableIndex;
        }
    }

    /**
     * メインループから毎フレーム呼び出される更新処理です。
     * 1. グリッドのランダム値を更新（BPM同期など）。
     * 2. フェーダーの値を更新（ランダムモード時の自動変化など）。
     * 3. MIDIコントローラーへのLED出力（現在の状態をハードウェアに反映）。
     * を順に行います。
     *
     * @param tempoIndex テンポ同期のためのインデックス（シード値として使用）。
     */
    public update(tempoIndex: number = 0): void {
        this.updateRandomGridValues(tempoIndex);

        const now = getCurrentTimestamp();
        this.randomFaderController.process(now, this.faderButtonMode, this.faderValues);

        this.midiOutputSendControls();
    }

    /**
     * グリッドパラメータのランダム値を更新します。
     * ランダムモードが有効なパラメータに対して、
     * 与えられた `tempoIndex` とカラムインデックスを組み合わせたシード値を用いて
     * 新しいランダムな値を計算・設定します。
     * これにより、BPMに同期したランダムなパラメータ変化を実現します。
     *
     * @param tempoIndex テンポ同期のためのインデックス。
     */
    private updateRandomGridValues(tempoIndex: number): void {
        for (let sceneIndex = 0; sceneIndex < GRID_COLS; sceneIndex++) {
            const params = this.gridRadioState[sceneIndex];

            for (let colIndex = 0; colIndex < GRID_COLS; colIndex++) {
                const param = params[colIndex];

                if (param.maxOptions === 0) {
                    this.resetGridParam(param);
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
     * MIDIメッセージを受信した際のメインハンドラです。
     * 受信したメッセージのステータスバイトとデータバイトを解析し、
     * メッセージの種類（フェーダーボタン、サイドボタン、グリッドパッド、フェーダー操作）に応じて
     * 適切な処理メソッドに振り分けます。
     *
     * @param message 受信したMIDIメッセージイベント。
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

        if (!this.hasSelectableOptions(param)) {
            this.resetGridParam(param);
            return true;
        }

        if (rowIndex === RANDOM_ROW_INDEX) {
            this.toggleGridRandom(param);
            return true;
        }

        if (rowIndex < param.maxOptions) {
            this.setGridSelection(param, rowIndex);
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
     * 指定されたインデックスのフェーダー値を更新します。
     * `RandomFaderController` を使用して、現在のモード（手動/ランダム）、
     * ボタンのトグル状態、前回の値、現在時刻に基づいて、
     * 最終的なフェーダー値を再計算します。
     * 例えば、ボタンがONの場合は値が強制的に0になったり、
     * ランダムモードの場合は自動的に値が変動したりします。
     *
     * @param index 更新対象のフェーダーインデックス（0-8）。
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
     * 現在の内部状態に基づいて、APC Mini MK2のLEDを更新するためのMIDIメッセージを送信します。
     * シーン選択ボタン、グリッドパッド、フェーダーボタンのLED状態を一括で更新します。
     * これにより、ハードウェアの見た目とソフトウェアの状態を同期させます。
     * 毎フレーム呼び出されることを想定しています。
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

            for (let row = 0; row < GRID_ROWS; row++) {
                const gridIndex = (GRID_ROWS - 1 - row) * GRID_COLS + col;
                const note = NOTE_RANGES.GRID.START + gridIndex;
                const velocity = this.getGridPadVelocity(param, row, this.currentSceneIndex, col);
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

    private hasSelectableOptions(param: GridParameterState): boolean {
        return param.maxOptions > 0;
    }

    private resetGridParam(param: GridParameterState): void {
        param.isRandom = false;
        param.selectedRow = 0;
        param.randomValue = 0;
    }

    private toggleGridRandom(param: GridParameterState): void {
        param.isRandom = !param.isRandom;
        if (!param.isRandom) {
            param.selectedRow = clampGridSelection(param.selectedRow, this.getMaxSelectableIndex(param));
        }
    }

    private setGridSelection(param: GridParameterState, rowIndex: number): void {
        const safeIndex = Math.min(rowIndex, this.getMaxSelectableIndex(param));
        param.isRandom = false;
        param.selectedRow = safeIndex;
    }

    private getMaxSelectableIndex(param: GridParameterState): number {
        return Math.min(param.maxOptions, RANDOM_ROW_INDEX) - 1;
    }

    private getGridPadVelocity(param: GridParameterState, row: number, sceneIndex: number, colIndex: number = 0): number {
        if (!this.hasSelectableOptions(param)) {
            return LED_COLORS.OFF;
        }

        if (row === RANDOM_ROW_INDEX) {
            return param.isRandom ? RANDOM_ON_COLOR : LED_COLORS.RED;
        }

        if (row >= param.maxOptions) {
            return LED_COLORS.OFF;
        }

        const currentValue = param.isRandom ? param.randomValue : param.selectedRow;
        if (row === currentValue) {
            // 3ページ目(sceneIndex === 2)の時は、カラムインデックスに応じた色を使用
            if (sceneIndex === 2) {
                return SIDE_ACTIVE_COLORS[colIndex] ?? DEFAULT_ACTIVE_COLOR;
            }
            // それ以外のシーンでは、従来通りシーンインデックスに応じた色を使用
            return SIDE_ACTIVE_COLORS[sceneIndex] ?? DEFAULT_ACTIVE_COLOR;
        }

        return LED_COLORS.RED;
    }

    /**
     * フェーダーボタンの動作モードを設定します。
     * モードが変更された場合、現在時刻を基準にしてフェーダーコントローラーの状態を同期させます。
     * これにより、モード切替時の値の急激な変化を防いだり、
     * 新しいモードでの動作を即座に開始したりします。
     *
     * @param mode 設定するモード ("random" | "manual" など)。
     */
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
     * MIDIメッセージを送信するための内部ヘルパーメソッドです。
     * ステータスバイトと2つのデータバイトを受け取り、配列として `sendMessage` に渡します。
     *
     * @param status MIDIステータスバイト。
     * @param data1 第1データバイト（ノート番号など）。
     * @param data2 第2データバイト（ベロシティなど）。
     */
    private send(status: number, data1: number, data2: number): void {
        this.sendMessage([status, data1, data2]);
    }

    public async init(): Promise<void> {
        // 基底クラスで初期化済み
    }
}