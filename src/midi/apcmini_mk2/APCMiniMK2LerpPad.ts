// APCMiniMK2LerpSurface - easing-based pad interaction pattern

import p5 from "p5";
import {
    APCMiniMK2Base,
    GRID_COLS,
    GRID_ROWS,
    MIDI_OUTPUT_STATUS,
    MIDI_STATUS,
    NOTE_RANGES,
} from "./APCMiniMK2PatternTemplate";

type GridStateType = "INACTIVE" | "TOGGLED" | "ONESHOT" | "PRESSED" | "LEAP";
type GridStateMode = "SET" | "GET";

const LERP_DURATION_MS = 300;

const DEBUG_LINE_HEIGHT = 18;
const DEBUG_PADDING = 12;
const DEBUG_PANEL_MIN_WIDTH = 260;
const DEBUG_PANEL_WIDTH_RATIO = 0.42;

export class APCMiniMK2LerpSurface extends APCMiniMK2Base {
    private gridPressedState: number[][];
    private gridPrevState: number[][];
    private gridOneShotState: number[][];
    private gridToggleState: number[][];
    private gridStateType: GridStateType[][];
    private gridLerpState: number[][];
    private gridPressTime: number[][];
    private gridLerpDirection: number[][];

    private readonly faderValuesPrev: number[];
    public readonly faderValues: number[];
    private readonly faderButtonState: number[];
    public readonly faderButtonToggleState: number[];
    private readonly sideButtonState: number[];
    public readonly sideButtonToggleState: number[];

    private ledsDirty = true;

    // constructor は補間サーフェスに必要なマトリクスを初期化する。
    constructor() {
        super();
        this.gridPressedState = this.createGridMatrix(0);
        this.gridPrevState = this.createGridMatrix(0);
        this.gridOneShotState = this.createGridMatrix(0);
        this.gridToggleState = this.createGridMatrix(0);
        this.gridStateType = this.createGridStateMatrix("INACTIVE");
        this.gridLerpState = this.createGridMatrix(0);
        this.gridPressTime = this.createGridMatrix(0);
        this.gridLerpDirection = this.createGridMatrix(0);

        this.faderValuesPrev = new Array(9).fill(0);
        this.faderValues = new Array(9).fill(0);
        this.faderButtonState = new Array(9).fill(0);
        this.faderButtonToggleState = new Array(9).fill(0);

        this.sideButtonState = new Array(8).fill(0);
        this.sideButtonToggleState = new Array(8).fill(0);
    }

    // update はワンショットと補間状態を進行させ、必要であれば LED を更新する。
    public update(): void {
        this.updateOneShotStates();
        this.updateLerpStates();

        if (this.midiSuccess && this.ledsDirty) {
            this.sendLeds();
            this.ledsDirty = false;
        }

        this.gridPrevState = this.cloneGridMatrix(this.gridPressedState);
    }

    // gridState は指定セルの状態を設定または取得するユーティリティ。
    public gridState(row: number, col: number, type: GridStateType, mode: GridStateMode = "SET"): number {
        if (!this.isValidCell(row, col)) {
            return 0;
        }

        if (mode === "SET") {
            if (this.gridStateType[row][col] !== type) {
                this.gridStateType[row][col] = type;
                this.markLedsDirty();
            }
        }

        switch (type) {
            case "TOGGLED":
                return this.gridToggleState[row][col];
            case "ONESHOT":
                return this.gridOneShotState[row][col];
            case "PRESSED":
                return this.gridPressedState[row][col];
            case "LEAP":
                return this.gridLerpState[row][col];
            default:
                return 0;
        }
    }

    // handleMIDIMessage は補間サーフェス向けの MIDI 入力を処理する。
    protected handleMIDIMessage(message: WebMidi.MIDIMessageEvent): void {
        const [status, data1, data2 = 0] = message.data;

        if (status === MIDI_STATUS.CONTROL_CHANGE) {
            if (data1 >= NOTE_RANGES.FADERS.START && data1 <= NOTE_RANGES.FADERS.END) {
                const index = data1 - NOTE_RANGES.FADERS.START;
                this.setFaderValue(index, data2 / 127);
            }
            return;
        }

        if ((status === MIDI_STATUS.NOTE_ON || status === MIDI_STATUS.NOTE_OFF) && this.isGridPad(data1)) {
            this.handleGridInput(data1, status, data2);
            return;
        }

        if (status === MIDI_STATUS.NOTE_ON && data2 > 0) {
            if (this.isFaderButton(data1)) {
                const index = this.getFaderButtonIndex(data1);
                if (index !== -1) {
                    this.toggleFaderButton(index);
                }
                return;
            }

            if (this.isSideButton(data1)) {
                const index = data1 - NOTE_RANGES.SIDE_BUTTONS.START;
                this.toggleSideButton(index);
            }
        }
    }

    // midiButtonReset は内部状態をリセットしサーフェスをクリアする。
    public midiButtonReset(): void {
        this.gridPressedState = this.createGridMatrix(0);
        this.gridPrevState = this.createGridMatrix(0);
        this.gridOneShotState = this.createGridMatrix(0);
        this.gridToggleState = this.createGridMatrix(0);
        this.gridStateType = this.createGridStateMatrix("INACTIVE");
        this.gridLerpState = this.createGridMatrix(0);
        this.gridPressTime = this.createGridMatrix(0);
        this.gridLerpDirection = this.createGridMatrix(0);

        this.faderButtonState.fill(0);
        this.faderButtonToggleState.fill(0);
        this.sideButtonState.fill(0);
        this.sideButtonToggleState.fill(1);
        this.markLedsDirty();
    }

    // getPressedMatrix は押下状態マトリクスのコピーを返す。
    public getPressedMatrix(): number[][] {
        return this.cloneGridMatrix(this.gridPressedState);
    }

    // getToggleMatrix はトグル状態マトリクスのコピーを返す。
    public getToggleMatrix(): number[][] {
        return this.cloneGridMatrix(this.gridToggleState);
    }

    // getLerpMatrix は補間値マトリクスのコピーを返す。
    public getLerpMatrix(): number[][] {
        return this.cloneGridMatrix(this.gridLerpState);
    }

    // handleGridInput はグリッドからのノート入力を解析し各状態を更新する。
    private handleGridInput(note: number, status: number, velocity: number): void {
        const coord = this.getGridCoordinate(note);
        if (!coord) {
            return;
        }

        const row = GRID_ROWS - 1 - coord.row;
        const col = coord.column;
        const isPressed = status === MIDI_STATUS.NOTE_ON && velocity > 0;

        this.gridPressedState[row][col] = isPressed ? 1 : 0;
        if (isPressed) {
            this.gridToggleState[row][col] = 1 - this.gridToggleState[row][col];
        }

        this.markLedsDirty();
    }

    // toggleFaderButton はフェーダーボタンのトグル操作を処理する。
    private toggleFaderButton(index: number): void {
        if (index < 0 || index >= this.faderButtonToggleState.length) {
            return;
        }

        this.faderButtonState[index] = 1;
        this.faderButtonToggleState[index] = this.faderButtonToggleState[index] ? 0 : 1;
        this.updateFaderValue(index);
    }

    // toggleSideButton はサイドボタンのトグル状態を反転させる。
    private toggleSideButton(index: number): void {
        if (index < 0 || index >= this.sideButtonToggleState.length) {
            return;
        }

        this.sideButtonState[index] = 1;
        this.sideButtonToggleState[index] = this.sideButtonToggleState[index] ? 0 : 1;
        this.markLedsDirty();
    }

    // setFaderValue はフェーダー値を正規化して保存する。
    private setFaderValue(index: number, value: number): void {
        if (index < 0 || index >= this.faderValuesPrev.length) {
            return;
        }

        this.faderValuesPrev[index] = this.clamp01(value);
        this.updateFaderValue(index);
    }

    // updateFaderValue はフェーダーのミュート状態に応じて最終値を求める。
    private updateFaderValue(index: number): void {
        const nextValue = this.faderButtonToggleState[index] ? 0 : this.faderValuesPrev[index];
        if (this.faderValues[index] !== nextValue) {
            this.faderValues[index] = nextValue;
            this.markLedsDirty();
        }
    }

    // updateOneShotStates は押下時に 1 フレームだけ立つワンショットを更新する。
    private updateOneShotStates(): void {
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                const diff = this.gridPressedState[row][col] - this.gridPrevState[row][col];
                this.gridOneShotState[row][col] = Math.max(diff, 0);
            }
        }
    }

    // updateLerpStates は各セルの補間値を時間経過に合わせて更新する。
    private updateLerpStates(): void {
        const now = this.getTimestamp();

        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                const pressed = this.gridOneShotState[row][col] === 1;
                this.updateGridState(row, col, pressed, now);
            }
        }
    }

    // updateGridState は個別セルの補間方向と値を決定する。
    private updateGridState(row: number, col: number, pressed: boolean, now: number): void {
        const previousValue = this.gridLerpState[row][col];

        if (pressed) {
            const elapsedSinceLastPress = now - this.gridPressTime[row][col];
            if (elapsedSinceLastPress < LERP_DURATION_MS) {
                this.gridLerpDirection[row][col] = this.gridLerpDirection[row][col] === 0
                    ? 1
                    : -this.gridLerpDirection[row][col];
            } else {
                this.gridLerpDirection[row][col] = this.gridLerpState[row][col] === 0 ? 1 : -1;
            }
            this.gridPressTime[row][col] = now;
        }

        const elapsed = now - this.gridPressTime[row][col];
        if (elapsed >= LERP_DURATION_MS) {
            this.gridLerpState[row][col] = this.gridLerpDirection[row][col] === 1 ? 1 : 0;
        } else {
            const progress = this.clamp01(elapsed / LERP_DURATION_MS);
            this.gridLerpState[row][col] = this.gridLerpDirection[row][col] === 1 ? progress : 1 - progress;
        }

        if (Math.abs(this.gridLerpState[row][col] - previousValue) > 1e-3) {
            this.markLedsDirty();
        }
    }

    // sendLeds はグリッド・ボタン・フェーダーの LED と CC を一括送信する。
    private sendLeds(): void {
        for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
                const note = this.getGridNote(col, GRID_ROWS - 1 - row);
                const stateType = this.gridStateType[row][col];
                const value = this.gridState(row, col, stateType, "GET");
                const intensity = this.scale(value, 0, 1, 0, 0.7);
                const velocity = Math.round(intensity * 127);
                this.send(MIDI_OUTPUT_STATUS.NOTE_ON, note, velocity);
            }
        }

        for (let i = 0; i < this.faderButtonToggleState.length; i++) {
            const note = i < GRID_COLS
                ? NOTE_RANGES.FADER_BUTTONS.START + i
                : NOTE_RANGES.FADER_BUTTON_8;
            const velocity = this.faderButtonToggleState[i] ? 127 : 0;
            this.send(MIDI_STATUS.NOTE_ON, note, velocity);
        }

        for (let i = 0; i < this.sideButtonToggleState.length; i++) {
            const note = NOTE_RANGES.SIDE_BUTTONS.START + i;
            const velocity = this.sideButtonToggleState[i] ? 127 : 0;
            this.send(MIDI_STATUS.NOTE_ON, note, velocity);
        }

        for (let i = 0; i < this.faderValues.length; i++) {
            const value = this.faderValues[i];
            const velocity = Math.round(this.clamp01(value) * 127);
            this.send(MIDI_STATUS.CONTROL_CHANGE, NOTE_RANGES.FADERS.START + i, velocity);
        }
    }

    // createGridMatrix は数値マトリクスを初期値で生成する。
    private createGridMatrix(initial: number): number[][] {
        return Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(initial));
    }

    // createGridStateMatrix は状態マトリクスを初期化する。
    private createGridStateMatrix(initial: GridStateType): GridStateType[][] {
        return Array.from({ length: GRID_ROWS }, () => Array<GridStateType>(GRID_COLS).fill(initial));
    }

    // cloneGridMatrix はマトリクスのディープコピーを行う。
    private cloneGridMatrix(source: number[][]): number[][] {
        return source.map((row) => row.slice());
    }

    // scale は値を指定範囲から別範囲へ線形変換する。
    private scale(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
        if (inMax === inMin) {
            return outMin;
        }
        const t = (value - inMin) / (inMax - inMin);
        return outMin + (outMax - outMin) * t;
    }

    // isValidCell は行列インデックスが有効かどうかを判定する。
    private isValidCell(row: number, col: number): boolean {
        return row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS;
    }

    // markLedsDirty は次の更新で LED 送信を行うよう指示する。
    private markLedsDirty(): void {
        this.ledsDirty = true;
    }

    // drawDebug は補間サーフェスの状態をデバッグパネルに描画する。
    public drawDebug(p: p5, target: p5.Graphics, originX = 24, originY = 24): void {
        const lines = this.buildDebugLines();
        this.renderDebugPanel(p, target, "Lerp Surface", lines, originX, originY);
    }

    // buildDebugLines はデバッグ表示用の行データを構築する。
    private buildDebugLines(): string[] {
        const pressed = this.getPressedMatrix();
        const toggled = this.getToggleMatrix();
        const lerp = this.getLerpMatrix();

        const lines: string[] = [];
        lines.push(`pressed=${this.countActiveCells(pressed)} toggled=${this.countActiveCells(toggled)}`);
        lines.push(`faders=${this.formatNumbers(this.faderValues)}`);

        for (let row = GRID_ROWS - 1; row >= 0; row--) {
            const rowValues: string[] = [];
            for (let col = 0; col < GRID_COLS; col++) {
                const value = lerp[row]?.[col] ?? 0;
                rowValues.push(value.toFixed(2));
            }
            lines.push(rowValues.join(" "));
        }

        return lines;
    }

    // renderDebugPanel は共通のデバッグ描画処理を行う。
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

    // formatNumbers はフェーダー値を文字列に整形する。
    private formatNumbers(values: number[]): string {
        return values.map((value) => value.toFixed(2)).join(" ");
    }

    // countActiveCells は 0 より大きいセルの数を集計する。
    private countActiveCells(matrix: number[][]): number {
        return matrix.reduce((sum, row) => {
            return sum + row.reduce((rowSum, value) => rowSum + (value > 0 ? 1 : 0), 0);
        }, 0);
    }

    // init は基底クラス側で初期化されるため処理を持たない。
    public async init(): Promise<void> {
        // 基底クラスで初期化済み
    }
}
