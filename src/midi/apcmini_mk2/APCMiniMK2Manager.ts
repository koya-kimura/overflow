// src/midi/APCMiniMK2Manager.ts

import { MIDIManager } from "../midiManager";

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

const SPECIAL_NOTES = {
    SHIFT: 122, // APC Mini MK2 Shift button (Note 122).
};

const GRID_ROWS = 8;
const GRID_COLS = 8;

// LEDのベロシティ (色) 定義
const LED_COLOR = {
    OFF: 0,
    RED: 3,           // 選択可能/初期色 (変更: 5 -> 3)
    // BLUE はシーン毎に色を割り当てるため個別配列で扱う
    // GREEN はデバイス上は紫に見えていたが、ランダムONは専用の色に変更
    BRIGHT_WHITE: 127, // シーン選択中/トグルON
};

export type FaderButtonMode = "mute" | "random";

interface FaderRandomState {
    isActive: boolean;
    currentValue: number;
    nextSwitchTime: number;
    isHighPhase: boolean;
}

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

const KEYBOARD_FADER_KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o'] as const;
const KEYBOARD_GRID_KEYS = ['z', 'x', 'c', 'v', 'b', 'n', 'm', ','] as const;
const KEYBOARD_SCENE_FUNCTION_KEYS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'] as const;
const KEYBOARD_SCENE_RANDOM_FUNCTION_KEY = 'F9';
const KEYBOARD_SCENE_SELECT_KEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k'] as const;
const KEYBOARD_SCENE_RANDOM_KEY = 'l';
const KEYBOARD_SCENE_PREV_KEY = '[';
const KEYBOARD_SCENE_NEXT_KEY = ']';
const FALLBACK_FADER_STEP = 0.05;
const FALLBACK_FINE_MODIFIER = 0.01;


/**
 * グリッドパッドのパラメーター状態を定義するインターフェース
 */
export interface GridParameterState {
    selectedRow: number; // 現在の選択インデックス (手動選択時)
    maxOptions: number;  // このパラメーターの有効な選択肢の数 (1-8)
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
    private randomSceneMode: boolean;
    private faderButtonMode: FaderButtonMode;
    private faderRandomStates: FaderRandomState[];
    private readonly randomLowDurationRange = { min: 1200, max: 4000 };
    private readonly randomHighDurationRange = { min: 80, max: 220 };
    private keyboardFallbackActive: boolean = false;
    private keyboardFallbackNoticeShown: boolean = false;
    private readonly handleKeyDownRef: (event: KeyboardEvent) => void;

    /** グリッドパッドの全状態を保持 [sceneIndex][columnIndex] */
    public gridRadioState: GridParameterState[][];

    constructor() {
        super();
        this.faderValues = new Array(9).fill(0);
        this.faderValuesPrev = new Array(9).fill(1);
        this.faderButtonToggleState = new Array(9).fill(0);
        this.sideButtonToggleState = new Array(8).fill(0);
        this.currentSceneIndex = 0;
        this.randomSceneMode = false;
        this.faderButtonMode = "random";
        this.faderRandomStates = new Array(9).fill(0).map(() => ({
            isActive: false,
            currentValue: 0,
            nextSwitchTime: 0,
            isHighPhase: false,
        }));

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
        this.handleKeyDownRef = this.handleFallbackKeyDown.bind(this);
    }

    protected onMidiAvailabilityChanged(available: boolean): void {
        if (!available) {
            this.enableKeyboardFallback();
        } else {
            this.disableKeyboardFallback();
        }
    }

    public isRandomSceneModeActive(): boolean {
        return this.randomSceneMode;
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
    public getParamValue(columnIndex: number, sceneIndex: number = this.currentSceneIndex): number {
        const param = this.gridRadioState[sceneIndex][columnIndex];
        return param.isRandom ? param.randomValue : param.selectedRow;
    }

    /**
    * 現在選択中のシーンのパラメーター値を取得する。ランダムモードを自動でチェック。
    */
    public getParamValues(sceneIndex: number = this.currentSceneIndex): number[] {
        const params = this.gridRadioState[sceneIndex];
        return params.map(param => param.isRandom ? param.randomValue : param.selectedRow);
    }

    /**
     * 全シーンのmaxOptionsをデフォルト値 (1) にリセットする。
     */
    public resetAllMaxOptions(): void {
        const DEFAULT_MAX_OPTIONS = 1;

        for (let scene = 0; scene < GRID_COLS; scene++) {
            for (let col = 0; col < GRID_COLS; col++) {
                this.gridRadioState[scene][col].maxOptions = DEFAULT_MAX_OPTIONS;
                this.gridRadioState[scene][col].selectedRow = 0;
                this.gridRadioState[scene][col].isRandom = false;
            }
        }
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
            const max = Math.max(1, Math.min(8, optionsArray[col]));
            this.gridRadioState[sceneIndex][col].maxOptions = max;

            const param = this.gridRadioState[sceneIndex][col];
            // 新しいmaxOptionsが現在の選択値より小さい場合、値を修正する
            if (param.selectedRow >= max) {
                param.selectedRow = max - 1;
            }
        }
    }

    /**
     * メインループからの更新処理。ランダム値の更新とLED出力を実行する。
     */
    public update(tempoIndex: number = 0): void {
        const currentScene = this.gridRadioState[this.currentSceneIndex];
        currentScene.forEach((param, colIndex) => {
            if (param.isRandom) {
                // ランダム値をBPMに同期して更新
                param.randomValue = Math.floor(this.simplePseudoRandom(tempoIndex + colIndex) * param.maxOptions);
            }
        });

        this.processRandomFaders(this.getTimestamp());

        this.midiOutputSendControls();
    }

    public isKeyboardFallbackActive(): boolean {
        return this.keyboardFallbackActive;
    }

    /**
     * 簡易な擬似乱数生成
     */
    private simplePseudoRandom(seed: number): number {
        const x = Math.sin(seed * 99999 + 1) * 10000;
        return x - Math.floor(x);
    }

    private enableKeyboardFallback(): void {
        if (this.keyboardFallbackActive || typeof window === 'undefined') {
            return;
        }

        this.keyboardFallbackActive = true;
        window.addEventListener('keydown', this.handleKeyDownRef, { passive: false });

        if (!this.keyboardFallbackNoticeShown) {
            console.info('[APCMiniMK2Manager] MIDIデバイスが見つからなかったため、キーボードフォールバックを有効化しました。');
            console.info('[APCMiniMK2Manager] フェーダー: Q~O (Shiftで減少 / Ctrlで微調整)。列調整: Z~,(Shiftで減少 / Optionでランダム切替)。シーン選択: A~K (左→右)、[/] で前後移動、L でランダム切替。F1~F9 も引き続き使用可能です。');
            this.keyboardFallbackNoticeShown = true;
        }
    }

    private disableKeyboardFallback(): void {
        if (!this.keyboardFallbackActive || typeof window === 'undefined') {
            return;
        }

        window.removeEventListener('keydown', this.handleKeyDownRef);
        this.keyboardFallbackActive = false;
    }

    private handleFallbackKeyDown(event: KeyboardEvent): void {
        if (!this.keyboardFallbackActive) {
            return;
        }

        if (this.handleSceneSelectionFallback(event)) {
            event.preventDefault();
            return;
        }

        const lowerKey = event.key.toLowerCase();

        if (this.handleFaderFallback(lowerKey, event)) {
            event.preventDefault();
            return;
        }

        if (this.handleGridFallback(lowerKey, event)) {
            event.preventDefault();
        }
    }

    private handleSceneSelectionFallback(event: KeyboardEvent): boolean {
        const lowerKey = event.key.toLowerCase();

        const directIndex = KEYBOARD_SCENE_SELECT_KEYS.indexOf(lowerKey as typeof KEYBOARD_SCENE_SELECT_KEYS[number]);
        if (directIndex !== -1) {
            this.selectScene(directIndex);
            return true;
        }

        if (lowerKey === KEYBOARD_SCENE_RANDOM_KEY) {
            this.randomSceneMode = !this.randomSceneMode;
            return true;
        }

        if (event.key === KEYBOARD_SCENE_PREV_KEY) {
            const prevIndex = (this.currentSceneIndex - 1 + GRID_COLS) % GRID_COLS;
            this.selectScene(prevIndex);
            return true;
        }

        if (event.key === KEYBOARD_SCENE_NEXT_KEY) {
            const nextIndex = (this.currentSceneIndex + 1) % GRID_COLS;
            this.selectScene(nextIndex);
            return true;
        }

        if (KEYBOARD_SCENE_FUNCTION_KEYS.includes(event.key as typeof KEYBOARD_SCENE_FUNCTION_KEYS[number])) {
            const index = parseInt(event.key.replace('F', ''), 10) - 1;
            if (!Number.isNaN(index) && index >= 0 && index < GRID_COLS) {
                this.selectScene(index);
                return true;
            }
        }

        if (event.key === KEYBOARD_SCENE_RANDOM_FUNCTION_KEY) {
            this.randomSceneMode = !this.randomSceneMode;
            return true;
        }

        return false;
    }

    private handleFaderFallback(key: string, event: KeyboardEvent): boolean {
        const index = KEYBOARD_FADER_KEYS.indexOf(key as typeof KEYBOARD_FADER_KEYS[number]);
        if (index === -1) {
            return false;
        }

        const direction = event.shiftKey ? -1 : 1;
        const step = event.ctrlKey || event.metaKey ? FALLBACK_FINE_MODIFIER : FALLBACK_FADER_STEP;
        const delta = direction * step;

        this.faderButtonToggleState[index] = 0;
        this.deactivateRandomFader(index);

        const nextValue = this.clamp01(this.faderValuesPrev[index] + delta);
        this.faderValuesPrev[index] = nextValue;
        this.faderValues[index] = nextValue;
        return true;
    }

    private handleGridFallback(key: string, event: KeyboardEvent): boolean {
        const columnIndex = KEYBOARD_GRID_KEYS.indexOf(key as typeof KEYBOARD_GRID_KEYS[number]);
        if (columnIndex === -1) {
            return false;
        }

        const param = this.gridRadioState[this.currentSceneIndex][columnIndex];

        if (event.altKey) {
            param.isRandom = !param.isRandom;
            if (!param.isRandom) {
                param.selectedRow = this.clampGridSelection(param.selectedRow, param.maxOptions);
            } else {
                param.randomValue = Math.floor(Math.random() * param.maxOptions);
            }
            return true;
        }

        const direction = event.shiftKey ? -1 : 1;
        param.isRandom = false;
        const nextRow = this.clampGridSelection(param.selectedRow + direction, param.maxOptions);
        if (nextRow !== param.selectedRow) {
            param.selectedRow = nextRow;
        }
        return true;
    }

    private clampGridSelection(value: number, maxOptions: number): number {
        const maxIndex = Math.max(0, Math.min(7, maxOptions - 1));
        if (value < 0) {
            return 0;
        }
        if (value > maxIndex) {
            return maxIndex;
        }
        return value;
    }

    private clamp01(value: number): number {
        if (value < 0) {
            return 0;
        }
        if (value > 1) {
            return 1;
        }
        return value;
    }

    /**
     * MIDIメッセージ受信時の処理 (入力)
     */
    protected handleMIDIMessage(message: WebMidi.MIDIMessageEvent): void {
        const [status, data1, data2] = message.data;
        const velocity = data2;

        // SHIFT ボタンのトグル操作
        if ((status === MIDI_STATUS.NOTE_ON || status === MIDI_STATUS.NOTE_OFF) && data1 === SPECIAL_NOTES.SHIFT) {
            if (status === MIDI_STATUS.NOTE_ON && velocity > 0) {
                this.randomSceneMode = !this.randomSceneMode;
            }
            return;
        }

        // フェーダーボタンの処理 (トグル入力)
        if (status === MIDI_STATUS.NOTE_ON && (
            (data1 >= NOTE_RANGES.FADER_BUTTONS.START && data1 <= NOTE_RANGES.FADER_BUTTONS.END) ||
            data1 === NOTE_RANGES.FADER_BUTTON_8
        )) {
            const index = (data1 >= NOTE_RANGES.FADER_BUTTONS.START) ? data1 - NOTE_RANGES.FADER_BUTTONS.START : 8;
            if (velocity > 0) {
                this.faderButtonToggleState[index] = 1 - this.faderButtonToggleState[index];
                this.updateFaderValue(index);
            }
        }

        // サイドボタンの処理 (シーン切り替え/ラジオボタン)
        else if (status === MIDI_STATUS.NOTE_ON && data1 >= NOTE_RANGES.SIDE_BUTTONS.START && data1 <= NOTE_RANGES.SIDE_BUTTONS.END) {
            const index = data1 - NOTE_RANGES.SIDE_BUTTONS.START;
            if (velocity > 0) {
                this.selectScene(index);
            }
        }

        // グリッドパッドの処理 (パラメーター選択/ラジオボタンとランダムトグル)
        else if (status === MIDI_STATUS.NOTE_ON && data1 >= NOTE_RANGES.GRID.START && data1 <= NOTE_RANGES.GRID.END) {
            const gridIndex = data1 - NOTE_RANGES.GRID.START;
            const colIndex = gridIndex % GRID_COLS;
            const rowIndex = GRID_ROWS - 1 - Math.floor(gridIndex / GRID_COLS); // 行を0-7 (下から上へ) に変換

            if (velocity > 0) {
                const param = this.gridRadioState[this.currentSceneIndex][colIndex];

                if (rowIndex === 7) {
                    // 8行目: ランダムモードのトグル
                    param.isRandom = !param.isRandom;
                    if (!param.isRandom) {
                        // ランダム解除時、選択肢内の一番上に強制移動
                        param.selectedRow = param.maxOptions > 0 ? Math.min(param.maxOptions - 1, 6) : 0;
                    }
                }
                else if (rowIndex < param.maxOptions) {
                    // 選択肢内の行: ラジオボタン入力
                    param.selectedRow = rowIndex;
                    param.isRandom = false; // 明示的な選択はランダムを解除
                }
            }
        }

        // フェーダーの処理 (CC入力)
        else if (status === MIDI_STATUS.CONTROL_CHANGE && data1 >= NOTE_RANGES.FADERS.START && data1 <= NOTE_RANGES.FADERS.END) {
            const index = data1 - NOTE_RANGES.FADERS.START;
            const normalizedValue = data2 / 127;
            this.faderValuesPrev[index] = normalizedValue;
            this.updateFaderValue(index);
        }
    }

    /**
     * フェーダー値の更新。ボタンがONの場合は強制的に0にする。
     */
    protected updateFaderValue(index: number): void {
        const now = this.getTimestamp();

        if (this.faderButtonMode === "mute") {
            this.deactivateRandomFader(index);
            this.faderValues[index] = this.faderButtonToggleState[index] ? 0 : this.faderValuesPrev[index];
            return;
        }

        if (this.faderButtonToggleState[index]) {
            this.activateRandomFader(index, now);
            this.faderValues[index] = this.faderRandomStates[index].currentValue;
        } else {
            this.deactivateRandomFader(index);
            this.faderValues[index] = this.faderValuesPrev[index];
        }
    }

    /**
     * APC Mini MK2へのMIDI出力 (LED制御)
     */
    protected midiOutputSendControls(): void {
        // 1. サイドボタンのLED制御 (選択中のシーンのみ点灯)
        for (let i = 0; i < 8; i++) {
            const note = NOTE_RANGES.SIDE_BUTTONS.START + i;
            const velocity = (i === this.currentSceneIndex) ? LED_COLOR.BRIGHT_WHITE : LED_COLOR.OFF;
            // サイドボタンは元のステータス 0x90 を使用して送信
            this.send(MIDI_STATUS.NOTE_ON, note, velocity);
        }

        // 2. グリッドパッドのLED制御 (パラメーター状態の視覚化)
        const currentScene = this.gridRadioState[this.currentSceneIndex];

        for (let col = 0; col < GRID_COLS; col++) {
            const param = currentScene[col];
            const activeRows = param.maxOptions;

            for (let row = 0; row < GRID_ROWS; row++) {
                const gridIndex = (GRID_ROWS - 1 - row) * GRID_COLS + col;
                const note = NOTE_RANGES.GRID.START + gridIndex;
                let velocity = LED_COLOR.OFF;

                if (row === 7) {
                    // 8行目: ランダムモードの状態
                    velocity = param.isRandom ? RANDOM_ON_COLOR : LED_COLOR.RED;
                }
                else if (row < activeRows) {
                    // 選択肢内の行
                    const currentValue = param.isRandom ? param.randomValue : param.selectedRow;

                    if (row === currentValue) {
                        // アクティブな選択: シーンごとの色を使用
                        const sceneColor = SIDE_ACTIVE_COLORS[this.currentSceneIndex] ?? DEFAULT_ACTIVE_COLOR;
                        velocity = sceneColor;
                    } else {
                        // 選択可能な非アクティブな選択 (赤)
                        velocity = LED_COLOR.RED;
                    }
                }

                this.send(MIDI_OUTPUT_STATUS.NOTE_ON, note, velocity);
            }
        }

        // 3. フェーダーボタンのLED制御 (トグル状態の表示)
        for (let i = 0; i < 9; i++) {
            let note: number;
            if (i < 8) {
                note = NOTE_RANGES.FADER_BUTTONS.START + i;
            } else {
                note = NOTE_RANGES.FADER_BUTTON_8;
            }
            const velocity = this.faderButtonToggleState[i] ? LED_COLOR.BRIGHT_WHITE : LED_COLOR.OFF;
            // フェーダーボタンは元のステータス 0x90 を使用して送信
            this.send(MIDI_STATUS.NOTE_ON, note, velocity);
        }
    }

    public setFaderButtonMode(mode: FaderButtonMode): void {
        if (this.faderButtonMode === mode) {
            return;
        }

        this.faderButtonMode = mode;
        const now = this.getTimestamp();

        for (let i = 0; i < this.faderButtonToggleState.length; i++) {
            if (mode === "random") {
                if (this.faderButtonToggleState[i]) {
                    this.activateRandomFader(i, now);
                    this.faderValues[i] = this.faderRandomStates[i].currentValue;
                } else {
                    this.deactivateRandomFader(i);
                    this.faderValues[i] = this.faderValuesPrev[i];
                }
            } else {
                this.deactivateRandomFader(i);
                this.faderValues[i] = this.faderButtonToggleState[i] ? 0 : this.faderValuesPrev[i];
            }
        }
    }

    public getFaderButtonMode(): FaderButtonMode {
        return this.faderButtonMode;
    }

    private activateRandomFader(index: number, now: number): void {
        const state = this.faderRandomStates[index];
        if (state.isActive) {
            return;
        }

        state.isActive = true;
        state.isHighPhase = false;
        state.currentValue = 0;
        state.nextSwitchTime = now + this.getRandomLowDuration();
    }

    private deactivateRandomFader(index: number): void {
        const state = this.faderRandomStates[index];
        if (!state.isActive && state.currentValue === 0) {
            return;
        }

        state.isActive = false;
        state.isHighPhase = false;
        state.currentValue = 0;
        state.nextSwitchTime = 0;
    }

    private processRandomFaders(now: number): void {
        if (this.faderButtonMode !== "random") {
            return;
        }

        for (let i = 0; i < this.faderRandomStates.length; i++) {
            const state = this.faderRandomStates[i];
            if (!state.isActive) {
                continue;
            }

            if (state.nextSwitchTime === 0) {
                state.nextSwitchTime = now + (state.isHighPhase ? this.getRandomHighDuration() : this.getRandomLowDuration());
            }

            if (now >= state.nextSwitchTime) {
                if (state.isHighPhase) {
                    state.isHighPhase = false;
                    state.currentValue = 0;
                    state.nextSwitchTime = now + this.getRandomLowDuration();
                } else {
                    state.isHighPhase = true;
                    state.currentValue = 1;
                    state.nextSwitchTime = now + this.getRandomHighDuration();
                }
            }

            this.faderValues[i] = state.currentValue;
        }
    }

    private getRandomDuration(range: { min: number; max: number }): number {
        if (range.min >= range.max) {
            return range.min;
        }
        return range.min + Math.random() * (range.max - range.min);
    }

    private getRandomLowDuration(): number {
        return this.getRandomDuration(this.randomLowDurationRange);
    }

    private getRandomHighDuration(): number {
        return this.getRandomDuration(this.randomHighDurationRange);
    }

    private getTimestamp(): number {
        if (typeof performance !== "undefined" && typeof performance.now === "function") {
            return performance.now();
        }
        return Date.now();
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