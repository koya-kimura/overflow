// APCMiniMK2StepSequencer - 8x8 step sequencer pattern

import p5 from "p5";
import {
    APCMiniMK2Base,
    GRID_COLS,
    GRID_ROWS,
    MIDI_OUTPUT_STATUS,
    MIDI_STATUS,
    NOTE_RANGES,
} from "./APCMiniMK2PatternTemplate";

const APC_COLORS = {
    OFF: 0,
    WHITE: 3,
    PATTERN_COLORS: [5, 60, 56, 53, 45, 37, 32, 21],
} satisfies {
    OFF: number;
    WHITE: number;
    PATTERN_COLORS: number[];
};

const MAX_INTENSITY_OFFSET = 124;

const DEBUG_LINE_HEIGHT = 18;
const DEBUG_PADDING = 12;
const DEBUG_PANEL_MIN_WIDTH = 260;
const DEBUG_PANEL_WIDTH_RATIO = 0.42;

export class APCMiniMK2StepSequencer extends APCMiniMK2Base {
    public readonly sequencePatterns: number[][];
    public readonly faderValues: number[];
    public readonly faderButtonToggleState: number[];
    public readonly sideButtonToggleState: number[];

    private readonly faderRawValues: number[];
    private currentPatternIndex = 0;
    private activeStep = 0;
    private ledsDirty = true;

    // constructor はステップシーケンサーの初期パターンと状態を構築する。
    constructor() {
        super();
        this.sequencePatterns = Array.from({ length: GRID_COLS }, () =>
            new Array(GRID_COLS).fill(0)
        );

        this.faderRawValues = new Array(9).fill(0);
        this.faderValues = new Array(9).fill(0);
        this.faderButtonToggleState = new Array(9).fill(0);
        this.sideButtonToggleState = new Array(8).fill(0);
        this.sideButtonToggleState[this.currentPatternIndex] = 1;
    }

    // update は現在のステップ位置を反映し、必要に応じて LED を更新する。
    public update(currentStep: number): void {
        const clampedStep = this.clampStepIndex(currentStep, GRID_COLS);
        if (clampedStep !== this.activeStep) {
            this.activeStep = clampedStep;
            this.markLedsDirty();
        }

        if (!this.ledsDirty) {
            return;
        }

        this.sendSequencerLEDs();
        this.ledsDirty = false;
    }

    // getSequenceValue は指定パターンの列が指す行インデックスを返す。
    public getSequenceValue(patternIndex: number, columnIndex: number): number {
        if (!this.sequencePatterns[patternIndex]) {
            return 0;
        }
        const column = this.sequencePatterns[patternIndex][columnIndex];
        return typeof column === "number" ? column : 0;
    }

    // clearCurrentPattern はアクティブなパターンをリセットする。
    public clearCurrentPattern(): void {
        this.sequencePatterns[this.currentPatternIndex].fill(0);
        this.markLedsDirty();
    }

    // clearPattern は指定されたパターン番号をリセットする。
    public clearPattern(patternIndex: number): void {
        if (patternIndex < 0 || patternIndex >= this.sequencePatterns.length) {
            return;
        }
        this.sequencePatterns[patternIndex].fill(0);
        this.markLedsDirty();
    }

    // getCurrentPatternIndex は現在アクティブなパターン番号を返す。
    public getCurrentPatternIndex(): number {
        return this.currentPatternIndex;
    }

    // getActiveStep は現在の再生ステップを返す。
    public getActiveStep(): number {
        return this.activeStep;
    }

    // getPatternSnapshot は指定パターンの値をコピーして返す。
    public getPatternSnapshot(patternIndex: number): number[] {
        const pattern = this.sequencePatterns[patternIndex];
        return pattern ? [...pattern] : new Array(GRID_COLS).fill(0);
    }

    // handleMIDIMessage はシーケンサー用の入力を解釈する。
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
                this.handleGridPadInput(data1);
                return;
            }

            const faderButtonIndex = this.getFaderButtonIndex(data1);
            if (faderButtonIndex !== -1) {
                this.toggleFaderButton(faderButtonIndex);
                return;
            }

            if (this.isSideButton(data1)) {
                const patternIndex = data1 - NOTE_RANGES.SIDE_BUTTONS.START;
                this.selectPattern(patternIndex);
                return;
            }
        }
    }

    // handleGridPadInput はグリッド入力を現在パターンへ記録する。
    private handleGridPadInput(note: number): void {
        const coord = this.getGridCoordinate(note);
        if (!coord) {
            return;
        }

        this.sequencePatterns[this.currentPatternIndex][coord.column] = coord.row;
        this.markLedsDirty();
    }

    // selectPattern はアクティブパターンを切り替える。
    private selectPattern(index: number): void {
        if (index < 0 || index >= this.sideButtonToggleState.length) {
            return;
        }

        if (this.currentPatternIndex === index) {
            return;
        }

        this.currentPatternIndex = index;
        this.sideButtonToggleState.fill(0);
        this.sideButtonToggleState[index] = 1;
        this.markLedsDirty();
    }

    // toggleFaderButton はフェーダーミュートのトグルを処理する。
    private toggleFaderButton(index: number): void {
        if (index < 0 || index >= this.faderButtonToggleState.length) {
            return;
        }

        this.faderButtonToggleState[index] = this.faderButtonToggleState[index] ? 0 : 1;
        this.applyFaderState(index);
    }

    // setFaderValue はフェーダー入力を正規化して記録する。
    private setFaderValue(index: number, value: number): void {
        if (index < 0 || index >= this.faderRawValues.length) {
            return;
        }

        this.faderRawValues[index] = this.clamp01(value);
        this.applyFaderState(index);
    }

    // applyFaderState はミュート状態に合わせて最終値を決定する。
    private applyFaderState(index: number): void {
        const muted = this.faderButtonToggleState[index] === 1;
        this.faderValues[index] = muted ? 0 : this.faderRawValues[index];
        this.markLedsDirty();
    }

    // sendSequencerLEDs はパッド・サイドボタン・フェーダーの LED を更新する。
    private sendSequencerLEDs(): void {
        if (!this.midiSuccess) {
            return;
        }

        const patternColor = APC_COLORS.PATTERN_COLORS[this.currentPatternIndex] ?? APC_COLORS.WHITE;

        for (let column = 0; column < GRID_COLS; column++) {
            const activeRow = this.sequencePatterns[this.currentPatternIndex][column];

            for (let row = 0; row < GRID_ROWS; row++) {
                const note = this.getGridNote(column, row);
                let intensity: number = APC_COLORS.OFF;

                if (row === activeRow) {
                    intensity = patternColor;
                }

                if (column === this.activeStep) {
                    if (row === activeRow) {
                        intensity = patternColor;
                    } else {
                        intensity = APC_COLORS.WHITE;
                    }
                }

                this.sendLEDMessage(note, intensity);
            }
        }

        for (let i = 0; i < this.sideButtonToggleState.length; i++) {
            const note = NOTE_RANGES.SIDE_BUTTONS.START + i;
            let intensity: number = APC_COLORS.OFF;

            if (i === this.currentPatternIndex) {
                intensity = Math.min(patternColor + MAX_INTENSITY_OFFSET, 127);
            }

            this.sendLEDMessage(note, intensity);
        }

        for (let i = 0; i < this.faderButtonToggleState.length; i++) {
            const note = (i < GRID_COLS)
                ? NOTE_RANGES.FADER_BUTTONS.START + i
                : NOTE_RANGES.FADER_BUTTON_8;
            const intensity: number = this.faderButtonToggleState[i]
                ? Math.min(APC_COLORS.WHITE + MAX_INTENSITY_OFFSET, 127)
                : APC_COLORS.OFF;
            this.sendLEDMessage(note, intensity);
        }
    }

    // sendLEDMessage は LED 用のノートまたはコントロールメッセージを送信する。
    private sendLEDMessage(note: number, intensity: number): void {
        const clampedIntensity = Math.min(Math.max(Math.floor(intensity), 0), 127);
        const isGrid = this.isGridPad(note);
        const isControl = this.isSideButton(note) || this.isFaderButton(note);

        if (isGrid) {
            this.send(MIDI_OUTPUT_STATUS.NOTE_ON, note, clampedIntensity);
        } else if (isControl) {
            this.send(MIDI_STATUS.NOTE_ON, note, clampedIntensity);
        } else {
            this.send(MIDI_STATUS.NOTE_ON, note, clampedIntensity);
        }
    }

    // markLedsDirty は次回描画時に LED 更新を強制する。
    private markLedsDirty(): void {
        this.ledsDirty = true;
    }

    // clampStepIndex はステップ番号が範囲外に出ないよう補正する。
    private clampStepIndex(index: number, length: number): number {
        if (length <= 0) {
            return 0;
        }
        if (index < 0) {
            return 0;
        }
        if (index >= length) {
            return length - 1;
        }
        return index;
    }

    // drawDebug はシーケンサーの状態をデバッグパネルとして描画する。
    public drawDebug(p: p5, target: p5.Graphics, originX = 24, originY = 24): void {
        const lines = this.buildDebugLines();
        this.renderDebugPanel(p, target, "Step Sequencer", lines, originX, originY);
    }

    // buildDebugLines はデバッグ表示内容を文字列化する。
    private buildDebugLines(): string[] {
        const patternIndex = this.getCurrentPatternIndex();
        const activeStep = this.getActiveStep();
        const pattern = this.getPatternSnapshot(patternIndex);

        const lines: string[] = [];
        lines.push(`pattern=${patternIndex} step=${activeStep}`);
        lines.push(`faders=${this.formatNumbers(this.faderValues)}`);
        lines.push(`sequence=${pattern.join(" ")}`);

        return lines;
    }

    // renderDebugPanel はデバッグパネルの共通描画処理を行う。
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

    // formatNumbers はフェーダー値を文字列へ整形する。
    private formatNumbers(values: number[]): string {
        return values.map((value) => value.toFixed(2)).join(" ");
    }

    // init は基底クラスでの初期化に委ねる。
    public async init(): Promise<void> {
        // 基底クラスで初期化済み
    }
}
