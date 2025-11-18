// APCMiniMK2SceneMatrix - scene-based radio selector pattern

import p5 from "p5";
import {
    APCMiniMK2Base,
    GRID_COLS,
    GRID_ROWS,
    MIDI_OUTPUT_STATUS,
    MIDI_STATUS,
    NOTE_RANGES,
} from "./APCMiniMK2PatternTemplate";

const SPECIAL_NOTES = {
    SHIFT: 122, // APC Mini MK2 Shift button (Note 122).
};

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

const DEBUG_LINE_HEIGHT = 18;
const DEBUG_PADDING = 12;
const DEBUG_PANEL_MIN_WIDTH = 260;
const DEBUG_PANEL_WIDTH_RATIO = 0.42;

// デフォルトのアクティブ色（フォールバック）
const DEFAULT_ACTIVE_COLOR = 41;

type GridStateMatrix = GridParameterState[][];

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
export class APCMiniMK2SceneMatrix extends APCMiniMK2Base {

    public faderValues: number[];
    private readonly faderValuesPrev: number[];
    public faderButtonToggleState: number[];
    public sideButtonToggleState: number[];

    public currentSceneIndex: number; // 現在選択されているシーンのインデックス (0-7)
    private randomSceneMode: boolean;
    private faderButtonMode: FaderButtonMode;
    private readonly faderRandomStates: FaderRandomState[];
    private readonly randomLowDurationRange = { min: 1200, max: 4000 };
    private readonly randomHighDurationRange = { min: 80, max: 220 };

    /** グリッドパッドの全状態を保持 [sceneIndex][columnIndex] */
    public gridRadioState: GridStateMatrix;

    // constructor はコントローラーの内部状態と初期シーンを準備する。
    constructor() {
        super();
        this.faderValues = new Array(9).fill(0);
        this.faderValuesPrev = new Array(9).fill(1);
        this.faderButtonToggleState = new Array(9).fill(0);
        this.sideButtonToggleState = new Array(8).fill(0);
        this.currentSceneIndex = 0;
        this.randomSceneMode = false;
        this.faderButtonMode = "random";
        this.faderRandomStates = Array.from({ length: 9 }, () => ({
            isActive: false,
            currentValue: 0,
            nextSwitchTime: 0,
            isHighPhase: false,
        }));

        this.gridRadioState = this.createInitialGridState();

        this.sideButtonToggleState[this.currentSceneIndex] = 1;
    }

    // isRandomSceneModeActive はランダムシーンモードの有効状態を返す。
    public isRandomSceneModeActive(): boolean {
        return this.randomSceneMode;
    }

    // setRandomSceneMode はランダムシーンモードを切り替え、フックを呼び出す。
    public setRandomSceneMode(active: boolean): void {
        if (this.randomSceneMode === active) {
            return;
        }
        this.randomSceneMode = active;
        this.onRandomSceneModeChanged(this.randomSceneMode);
    }

    // toggleRandomSceneMode はランダムシーンモードをトグルする。
    public toggleRandomSceneMode(): void {
        this.setRandomSceneMode(!this.randomSceneMode);
    }

    // selectScene は指定したシーンをアクティブにし、関連インジケーターを更新する。
    public selectScene(index: number): void {
        if (index < 0 || index >= GRID_COLS) {
            return;
        }

        this.currentSceneIndex = index;
        this.sideButtonToggleState.fill(0);
        this.sideButtonToggleState[index] = 1;
        this.onSceneSelected(index);
    }

    /**
     * 現在選択中のシーンのパラメーター値を取得する。ランダムモードを自動でチェック。
     */
    public getParamValue(columnIndex: number): number {
        const param = this.gridRadioState[this.currentSceneIndex][columnIndex];
        return param.isRandom ? param.randomValue : param.selectedRow;
    }

    /**
     * 全シーンのmaxOptionsをデフォルト値 (1) にリセットする。
     */
    public resetAllMaxOptions(): void {
        const DEFAULT_MAX_OPTIONS = 1;

        for (let scene = 0; scene < GRID_COLS; scene++) {
            for (let col = 0; col < GRID_COLS; col++) {
                const param = this.gridRadioState[scene][col];
                param.maxOptions = DEFAULT_MAX_OPTIONS;
                param.selectedRow = 0;
                param.isRandom = false;
                param.randomValue = 0;
                this.notifyGridParameterChanged(scene, col);
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
            const param = this.gridRadioState[sceneIndex][col];
            const max = Math.max(1, Math.min(GRID_ROWS, optionsArray[col]));
            param.maxOptions = max;

            if (param.selectedRow >= max) {
                param.selectedRow = max - 1;
            }

            this.notifyGridParameterChanged(sceneIndex, col);
        }
    }

    /**
     * メインループからの更新処理。ランダム値の更新とLED出力を実行する。
     */
    public update(tempoIndex: number = 0): void {
        const currentScene = this.gridRadioState[this.currentSceneIndex];

        currentScene.forEach((param, colIndex) => {
            if (!param.isRandom || param.maxOptions <= 0) {
                return;
            }

            const nextValue = Math.floor(this.simplePseudoRandom(tempoIndex + colIndex) * param.maxOptions);
            if (param.randomValue !== nextValue) {
                param.randomValue = nextValue;
                this.notifyGridParameterChanged(this.currentSceneIndex, colIndex);
            }
        });

        this.processRandomFaders(this.getTimestamp());

        this.midiOutputSendControls();
        this.afterUpdate(tempoIndex);
    }

    /**
     * MIDIメッセージ受信時の処理 (入力)
     */
    protected handleMIDIMessage(message: WebMidi.MIDIMessageEvent): void {
        const [status, data1, data2] = message.data;

        if (status === MIDI_STATUS.CONTROL_CHANGE) {
            this.handleControlChange(data1, data2);
            return;
        }

        if (status === MIDI_STATUS.NOTE_ON || status === MIDI_STATUS.NOTE_OFF) {
            this.handleNoteMessage(status, data1, data2);
        }
    }

    /**
     * フェーダー値の更新。ボタンがONの場合は専用処理に切り替える。
     */
    protected updateFaderValue(index: number): void {
        const now = this.getTimestamp();
        let nextValue = this.faderValues[index];

        if (this.faderButtonMode === "mute") {
            this.deactivateRandomFader(index);
            nextValue = this.faderButtonToggleState[index] ? 0 : this.faderValuesPrev[index];
        } else if (this.faderButtonToggleState[index]) {
            this.activateRandomFader(index, now);
            nextValue = this.faderRandomStates[index].currentValue;
        } else {
            this.deactivateRandomFader(index);
            nextValue = this.faderValuesPrev[index];
        }

        this.applyFaderValue(index, nextValue);
    }

    /**
     * APC Mini MK2へのMIDI出力 (LED制御)
     */
    protected midiOutputSendControls(): void {
        this.updateSideButtonLeds();
        this.updateGridPadLeds();
        this.updateFaderButtonLeds();
    }

    // setFaderButtonMode はランダム／ミュートモードを切り替えフェーダーを再評価する。
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
                    this.applyFaderValue(i, this.faderRandomStates[i].currentValue);
                } else {
                    this.deactivateRandomFader(i);
                    this.applyFaderValue(i, this.faderValuesPrev[i]);
                }
            } else {
                this.deactivateRandomFader(i);
                const nextValue = this.faderButtonToggleState[i] ? 0 : this.faderValuesPrev[i];
                this.applyFaderValue(i, nextValue);
            }
        }

        this.onFaderButtonModeChanged(mode);
    }

    // getFaderButtonMode は現在のフェーダーモードを返す。
    public getFaderButtonMode(): FaderButtonMode {
        return this.faderButtonMode;
    }

    protected onSceneSelected(_sceneIndex: number): void {
        // サブクラスで必要に応じてオーバーライド
    }

    protected onRandomSceneModeChanged(_isActive: boolean): void {
        // サブクラスで必要に応じてオーバーライド
    }

    protected onFaderButtonModeChanged(_mode: FaderButtonMode): void {
        // サブクラスで必要に応じてオーバーライド
    }

    protected onFaderValueChanged(_index: number, _value: number): void {
        // サブクラスで必要に応じてオーバーライド
    }

    protected onGridParameterChanged(_sceneIndex: number, _columnIndex: number, _state: GridParameterState): void {
        // サブクラスで必要に応じてオーバーライド
    }

    protected afterUpdate(_tempoIndex: number): void {
        // サブクラスで必要に応じてオーバーライド
    }

    // createInitialGridState は各シーンの初期ラジオステートを生成する。
    private createInitialGridState(): GridStateMatrix {
        return Array.from({ length: GRID_COLS }, () =>
            Array.from({ length: GRID_COLS }, () => ({
                selectedRow: 0,
                maxOptions: GRID_ROWS,
                isRandom: false,
                randomValue: 0,
            }))
        );
    }

    // simplePseudoRandom は軽量な疑似乱数を生成する。
    private simplePseudoRandom(seed: number): number {
        const x = Math.sin(seed * 99999 + 1) * 10000;
        return x - Math.floor(x);
    }

    // handleNoteMessage はノートメッセージを解析し適切な処理に振り分ける。
    private handleNoteMessage(status: number, note: number, velocity: number): void {
        if (note === SPECIAL_NOTES.SHIFT) {
            if (status === MIDI_STATUS.NOTE_ON && velocity > 0) {
                this.toggleRandomSceneMode();
            }
            return;
        }

        if (status !== MIDI_STATUS.NOTE_ON || velocity === 0) {
            return;
        }

        if (this.isFaderButton(note)) {
            this.handleFaderButtonInput(note);
            return;
        }

        if (this.isSideButton(note)) {
            this.handleSceneButtonInput(note);
            return;
        }

        if (this.isGridPad(note)) {
            this.handleGridPadInput(note);
        }
    }

    // handleControlChange はフェーダーからのコントロールチェンジを反映する。
    private handleControlChange(controller: number, value: number): void {
        if (controller < NOTE_RANGES.FADERS.START || controller > NOTE_RANGES.FADERS.END) {
            return;
        }

        const index = controller - NOTE_RANGES.FADERS.START;
        const normalizedValue = value / 127;
        this.faderValuesPrev[index] = normalizedValue;
        this.updateFaderValue(index);
    }

    // handleFaderButtonInput はフェーダーボタンのトグル操作を処理する。
    private handleFaderButtonInput(note: number): void {
        const index = this.getFaderButtonIndex(note);
        if (index === -1) {
            return;
        }

        this.faderButtonToggleState[index] = 1 - this.faderButtonToggleState[index];
        this.updateFaderValue(index);
    }

    // handleSceneButtonInput はシーンボタン押下でシーン切り替えを行う。
    private handleSceneButtonInput(note: number): void {
        const index = note - NOTE_RANGES.SIDE_BUTTONS.START;
        this.selectScene(index);
    }

    // handleGridPadInput はグリッドパッドの選択状態やランダム設定を更新する。
    private handleGridPadInput(note: number): void {
        const gridIndex = note - NOTE_RANGES.GRID.START;
        const columnIndex = gridIndex % GRID_COLS;
        const rowIndex = GRID_ROWS - 1 - Math.floor(gridIndex / GRID_COLS);
        const param = this.gridRadioState[this.currentSceneIndex][columnIndex];

        if (rowIndex === GRID_ROWS - 1) {
            param.isRandom = !param.isRandom;
            if (!param.isRandom) {
                param.selectedRow = param.maxOptions > 0 ? Math.min(param.maxOptions - 1, GRID_ROWS - 2) : 0;
            }
            this.notifyGridParameterChanged(this.currentSceneIndex, columnIndex);
            return;
        }

        if (rowIndex < param.maxOptions) {
            param.selectedRow = rowIndex;
            param.isRandom = false;
            this.notifyGridParameterChanged(this.currentSceneIndex, columnIndex);
        }
    }

    // processRandomFaders はランダムフェーダーの点滅スケジュールを進行させる。
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

            this.applyFaderValue(i, state.currentValue);
        }
    }

    // activateRandomFader は指定フェーダーをランダム発振状態に切り替える。
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

    // deactivateRandomFader はランダムフェーダーを停止し値を初期化する。
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

    // updateSideButtonLeds はシーン選択ボタンの LED を更新する。
    private updateSideButtonLeds(): void {
        for (let i = 0; i < GRID_COLS; i++) {
            const note = NOTE_RANGES.SIDE_BUTTONS.START + i;
            const velocity = (i === this.currentSceneIndex) ? LED_COLOR.BRIGHT_WHITE : LED_COLOR.OFF;
            this.send(MIDI_STATUS.NOTE_ON, note, velocity);
        }
    }

    // updateGridPadLeds は現在のシーン状態に基づきパッド LED を塗り分ける。
    private updateGridPadLeds(): void {
        const currentScene = this.gridRadioState[this.currentSceneIndex];

        for (let col = 0; col < GRID_COLS; col++) {
            const param = currentScene[col];
            const activeRows = param.maxOptions;

            for (let row = 0; row < GRID_ROWS; row++) {
                const gridIndex = (GRID_ROWS - 1 - row) * GRID_COLS + col;
                const note = NOTE_RANGES.GRID.START + gridIndex;
                let velocity = LED_COLOR.OFF;

                if (row === GRID_ROWS - 1) {
                    velocity = param.isRandom ? RANDOM_ON_COLOR : LED_COLOR.RED;
                } else if (row < activeRows) {
                    const currentValue = param.isRandom ? param.randomValue : param.selectedRow;

                    if (row === currentValue) {
                        const sceneColor = SIDE_ACTIVE_COLORS[this.currentSceneIndex] ?? DEFAULT_ACTIVE_COLOR;
                        velocity = sceneColor;
                    } else {
                        velocity = LED_COLOR.RED;
                    }
                }

                this.send(MIDI_OUTPUT_STATUS.NOTE_ON, note, velocity);
            }
        }
    }

    // updateFaderButtonLeds はフェーダーボタンの LED トグルを送信する。
    private updateFaderButtonLeds(): void {
        for (let i = 0; i < this.faderButtonToggleState.length; i++) {
            const note = (i < GRID_COLS)
                ? NOTE_RANGES.FADER_BUTTONS.START + i
                : NOTE_RANGES.FADER_BUTTON_8;
            const velocity = this.faderButtonToggleState[i] ? LED_COLOR.BRIGHT_WHITE : LED_COLOR.OFF;
            this.send(MIDI_STATUS.NOTE_ON, note, velocity);
        }
    }

    // applyFaderValue はフェーダー値を記録し、値変更フックを呼ぶ。
    private applyFaderValue(index: number, nextValue: number): void {
        if (this.faderValues[index] === nextValue) {
            return;
        }

        this.faderValues[index] = nextValue;
        this.onFaderValueChanged(index, nextValue);
    }

    // notifyGridParameterChanged はシーン内パラメータ変更をフックへ転送する。
    private notifyGridParameterChanged(sceneIndex: number, columnIndex: number): void {
        const state = this.gridRadioState[sceneIndex][columnIndex];
        this.onGridParameterChanged(sceneIndex, columnIndex, state);
    }

    // getRandomDuration は指定範囲からランダムな持続時間を求める。
    private getRandomDuration(range: { min: number; max: number }): number {
        if (range.min >= range.max) {
            return range.min;
        }
        return range.min + Math.random() * (range.max - range.min);
    }

    // getRandomLowDuration はランダムフェーダーの低位時間を取得する。
    private getRandomLowDuration(): number {
        return this.getRandomDuration(this.randomLowDurationRange);
    }

    // getRandomHighDuration はランダムフェーダーの高位時間を取得する。
    private getRandomHighDuration(): number {
        return this.getRandomDuration(this.randomHighDurationRange);
    }

    // drawDebug は現在のシーン状態をオーバーレイとして描画する。
    public drawDebug(p: p5, target: p5.Graphics, originX = 24, originY = 24): void {
        const lines = this.buildDebugLines();
        this.renderDebugPanel(p, target, "Scene Matrix", lines, originX, originY);
    }

    // buildDebugLines はデバッグ表示用のテキスト配列を構築する。
    private buildDebugLines(): string[] {
        const lines: string[] = [];
        const currentScene = this.gridRadioState[this.currentSceneIndex];

        lines.push(
            `scene=${this.currentSceneIndex} randomScene=${this.isRandomSceneModeActive() ? "ON" : "OFF"}`,
        );
        lines.push(
            `faderMode=${this.getFaderButtonMode()} faders=${this.formatNumbers(this.faderValues)}`,
        );

        if (currentScene) {
            currentScene.forEach((param, columnIndex) => {
                const valueLabel = param.isRandom
                    ? `R${param.randomValue}`
                    : `S${param.selectedRow}`;
                lines.push(`col${columnIndex}: ${valueLabel}/${param.maxOptions}`);
            });
        }

        return lines;
    }

    // renderDebugPanel は共通のデバッグパネル描画ロジックを処理する。
    private renderDebugPanel(
        p: p5,
        target: p5.Graphics,
        title: string,
        lines: string[],
        originX: number,
        originY: number,
    ): void {
        const contentLines = lines.length > 0 ? lines : ["(no data)"];
        const innerWidth = Math.max(DEBUG_PANEL_MIN_WIDTH, target.width * DEBUG_PANEL_WIDTH_RATIO);
        const panelWidth = innerWidth + DEBUG_PADDING * 2;
        const panelHeight = (contentLines.length + 1) * DEBUG_LINE_HEIGHT + DEBUG_PADDING * 2;

        target.push();
        target.noStroke();
        target.fill(0, 200);
        target.rect(originX, originY, panelWidth, panelHeight, 10);

        target.fill(255);
        target.textSize(14);
        target.textAlign(p.LEFT, p.TOP);
        target.text(title, originX + DEBUG_PADDING, originY + DEBUG_PADDING);

        contentLines.forEach((line, index) => {
            const lineY = originY + DEBUG_PADDING + DEBUG_LINE_HEIGHT * (index + 1);
            target.text(line, originX + DEBUG_PADDING, lineY);
        });

        target.pop();
    }

    // formatNumbers は数値配列を小数2桁の文字列に整形する。
    private formatNumbers(values: number[]): string {
        return values.map((value) => value.toFixed(2)).join(" ");
    }

    // init は基底クラスの初期化に依存しているためダミー実装となっている。
    public async init(): Promise<void> {
        // 基底クラスで初期化済み
    }
}