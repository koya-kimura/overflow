// APCMiniMK2ToggleMatrix - simple grid toggle pattern

import p5 from "p5";
import {
    APCMiniMK2Base,
    GRID_COLS,
    GRID_ROWS,
    MIDI_OUTPUT_STATUS,
    MIDI_STATUS,
    NOTE_RANGES,
} from "./APCMiniMK2PatternTemplate";

const LED_COLOR = {
    OFF: 0,
    ACTIVE: 120,
};

const DEBUG_LINE_HEIGHT = 18;
const DEBUG_PADDING = 12;
const DEBUG_PANEL_MIN_WIDTH = 260;
const DEBUG_PANEL_WIDTH_RATIO = 0.42;

export class APCMiniMK2ToggleMatrix extends APCMiniMK2Base {
    public readonly faderValues: number[];
    public readonly faderButtonToggleState: number[];
    public readonly sideButtonToggleState: number[];

    private readonly faderRawValues: number[];
    private readonly gridToggleStates: boolean[][];
    private ledsDirty = true;

    // constructor は単純なトグルマトリクスの初期状態を構築する。
    constructor() {
        super();
        this.faderRawValues = new Array(9).fill(0);
        this.faderValues = new Array(9).fill(0);
        this.faderButtonToggleState = new Array(9).fill(0);
        this.sideButtonToggleState = new Array(8).fill(0);
        this.gridToggleStates = Array.from({ length: GRID_COLS }, () => new Array(GRID_ROWS).fill(false));
    }

    // gridToggleState は指定グリッドの ON/OFF 状態を返す。
    public gridToggleState(columnIndex: number, rowIndex: number): boolean {
        if (columnIndex < 0 || columnIndex >= GRID_COLS) {
            return false;
        }
        if (rowIndex < 0 || rowIndex >= GRID_ROWS) {
            return false;
        }
        return this.gridToggleStates[columnIndex][rowIndex];
    }

    // update はステートが変化しているときのみ LED を更新する。
    public update(): void {
        if (!this.ledsDirty) {
            return;
        }
        this.midiOutputSendControls();
        this.ledsDirty = false;
    }

    // handleMIDIMessage はトグル操作やフェーダー入力を処理する。
    protected handleMIDIMessage(message: WebMidi.MIDIMessageEvent): void {
        const [status, data1, data2 = 0] = message.data;

        if (status === MIDI_STATUS.CONTROL_CHANGE) {
            if (data1 >= NOTE_RANGES.FADERS.START && data1 <= NOTE_RANGES.FADERS.END) {
                const faderIndex = data1 - NOTE_RANGES.FADERS.START;
                this.setFaderValue(faderIndex, data2 / 127);
            }
            return;
        }

        if (status === MIDI_STATUS.NOTE_ON && data2 > 0) {
            if (this.isGridPad(data1)) {
                this.toggleGridPad(data1);
                return;
            }

            const faderButtonIndex = this.getFaderButtonIndex(data1);
            if (faderButtonIndex !== -1) {
                this.toggleFaderButton(faderButtonIndex);
                return;
            }

            if (this.isSideButton(data1)) {
                const sideIndex = data1 - NOTE_RANGES.SIDE_BUTTONS.START;
                this.toggleSideButton(sideIndex);
            }
        }
    }

    // toggleGridPad は単一グリッドのトグル状態を反転する。
    private toggleGridPad(note: number): void {
        const coord = this.getGridCoordinate(note);
        if (!coord) {
            return;
        }

        const current = this.gridToggleStates[coord.column][coord.row];
        this.gridToggleStates[coord.column][coord.row] = !current;
        this.markLedsDirty();
    }

    // toggleSideButton はサイドボタンのトグル状態を切り替える。
    private toggleSideButton(index: number): void {
        if (index < 0 || index >= this.sideButtonToggleState.length) {
            return;
        }
        this.sideButtonToggleState[index] = this.sideButtonToggleState[index] ? 0 : 1;
        this.markLedsDirty();
    }

    // toggleFaderButton はフェーダーボタンのミュート状態を切り替える。
    private toggleFaderButton(index: number): void {
        if (index < 0 || index >= this.faderButtonToggleState.length) {
            return;
        }
        this.faderButtonToggleState[index] = this.faderButtonToggleState[index] ? 0 : 1;
        this.applyFaderState(index);
    }

    // setFaderValue はフェーダーに受け取った値を正規化して保持する。
    private setFaderValue(index: number, value: number): void {
        if (index < 0 || index >= this.faderRawValues.length) {
            return;
        }

        this.faderRawValues[index] = this.clamp01(value);
        this.applyFaderState(index);
    }

    // applyFaderState はミュート状態に応じて公開フェーダー値を決定する。
    private applyFaderState(index: number): void {
        const muted = this.faderButtonToggleState[index] === 1;
        this.faderValues[index] = muted ? 0 : this.faderRawValues[index];
        this.markLedsDirty();
    }

    // midiOutputSendControls はトグル状態を LED としてデバイスに書き込む。
    protected midiOutputSendControls(): void {
        for (let i = 0; i < this.sideButtonToggleState.length; i++) {
            const note = NOTE_RANGES.SIDE_BUTTONS.START + i;
            const velocity = this.sideButtonToggleState[i] ? LED_COLOR.ACTIVE : LED_COLOR.OFF;
            this.send(MIDI_STATUS.NOTE_ON, note, velocity);
        }

        for (let column = 0; column < GRID_COLS; column++) {
            for (let row = 0; row < GRID_ROWS; row++) {
                const note = this.getGridNote(column, row);
                const velocity = this.gridToggleStates[column][row] ? LED_COLOR.ACTIVE : LED_COLOR.OFF;
                this.send(MIDI_OUTPUT_STATUS.NOTE_ON, note, velocity);
            }
        }

        for (let i = 0; i < this.faderButtonToggleState.length; i++) {
            const note = (i < GRID_COLS)
                ? NOTE_RANGES.FADER_BUTTONS.START + i
                : NOTE_RANGES.FADER_BUTTON_8;
            const velocity = this.faderButtonToggleState[i] ? LED_COLOR.ACTIVE : LED_COLOR.OFF;
            this.send(MIDI_STATUS.NOTE_ON, note, velocity);
        }
    }

    // getGridToggleStates は内部状態をそのまま参照用に返す。
    public getGridToggleStates(): boolean[][] {
        return this.gridToggleStates;
    }

    // markLedsDirty は次回 update で LED を再送するようフラグを立てる。
    private markLedsDirty(): void {
        this.ledsDirty = true;
    }

    // dispose は将来のリソース解放用フックとして残されている。
    public dispose(): void {
        // 現状は特になし。必要になればリソース解放処理を追加してください。
    }

    // init は基底クラス側で初期化されるため処理を持たない。
    public async init(): Promise<void> {
        // 基底クラスがデバイス初期化を担当
    }

    // drawDebug はトグルマトリクスの状態をデバッグパネルとして描画する。
    public drawDebug(p: p5, target: p5.Graphics, originX = 24, originY = 24): void {
        const lines = this.buildDebugLines();
        this.renderDebugPanel(p, target, "Toggle Matrix", lines, originX, originY);
    }

    // buildDebugLines はデバッグ表示用テキストを生成する。
    private buildDebugLines(): string[] {
        const lines: string[] = [];

        lines.push(`faders=${this.formatNumbers(this.faderValues)}`);
        lines.push(`side=${this.sideButtonToggleState.join("")}`);

        const grid = this.getGridToggleStates();
        for (let row = GRID_ROWS - 1; row >= 0; row--) {
            let rowString = "";
            for (let col = 0; col < GRID_COLS; col++) {
                rowString += grid[col][row] ? "1" : ".";
            }
            lines.push(rowString);
        }

        return lines;
    }

    // renderDebugPanel は Graphics に共通デバッグパネルを描画する。
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

    // formatNumbers はフェーダー値を小数 2 桁の文字列へ整形する。
    private formatNumbers(values: number[]): string {
        return values.map((value) => value.toFixed(2)).join(" ");
    }
}