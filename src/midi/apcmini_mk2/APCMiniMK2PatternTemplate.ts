// APCMiniMK2PatternTemplate は APC Mini MK2 系クラスの共通基盤を提供する。

import type { MidiMessageLike } from "../MidiTypes";
import { MIDIManager } from "../midiManager";
import { APCMiniMK2VirtualSurface } from "./APCMiniMK2VirtualSurface";
import { APCMiniMK2VirtualInput } from "./APCMiniMK2VirtualInput";
import {
    GRID_COLS,
    GRID_ROWS,
    MIDI_OUTPUT_STATUS,
    MIDI_STATUS,
    NOTE_RANGES,
} from "./APCMiniMK2Constants";
export {
    GRID_COLS,
    GRID_ROWS,
    MIDI_OUTPUT_STATUS,
    MIDI_STATUS,
    NOTE_RANGES,
} from "./APCMiniMK2Constants";

export interface GridCoordinate {
    column: number;
    row: number; // bottom-origin (0 = bottom row)
}

/**
 * APC Mini MK2 で共通して利用する機能をまとめた基底クラス。
 *
 * 現在このベースクラスを継承している代表的なパターン:
 * - APCMiniMK2SceneMatrix: シーン切替とランダム化を備えたラジオボタン型のシンセパラメータ選択
 * - APCMiniMK2ToggleMatrix: 全パッドをトグルとして扱うシンプルなオン/オフマトリクス
 * - APCMiniMK2StepSequencer: 8x8 のステップシーケンサーとして扱うビートパターン用ラッパー
 * - APCMiniMK2LerpSurface: 押下時間に応じて値が補間されるエクスプレッシブなパッドサーフェス
 *
 * フレーム更新や LED 出力、MIDI イベント処理などパターン固有の挙動は派生クラス側で実装します。
 * 最低限 {@link handleMIDIMessage} を実装し、必要に応じて update ループや補助メソッドを用意してください。
 */
export abstract class APCMiniMK2Base extends MIDIManager {
    private readonly usesVirtualInput: boolean;
    private readonly virtualSurface: APCMiniMK2VirtualSurface | null;
    private readonly virtualInput: APCMiniMK2VirtualInput | null;
    // constructor は MIDI コールバックを必要に応じて自動紐付けする。
    protected constructor(autoBindCallback = true) {
        super();
        this.usesVirtualInput = this.shouldUseVirtualInput();

        if (this.usesVirtualInput) {
            const surface = new APCMiniMK2VirtualSurface();
            this.virtualSurface = surface;
            const input = new APCMiniMK2VirtualInput(surface);
            input.setMessageEmitter((data: number[]) => {
                this.dispatchVirtualMidiMessage(data);
            });
            this.virtualInput = input;
        } else {
            this.virtualSurface = null;
            this.virtualInput = null;
        }
        if (autoBindCallback) {
            this.onMidiMessageCallback = (message) => {
                this.reflectIncomingForVirtual(message);
                this.handleMIDIMessage(message);
            };
        }
    }

    // handleMIDIMessage は派生クラスが実装すべき必須コールバック。
    protected abstract handleMIDIMessage(message: MidiMessageLike): void;

    // サブクラスが仮想入力を必要とする場合に true を返す。
    protected shouldUseVirtualInput(): boolean {
        return false;
    }

    // isGridPad はノート番号がメイングリッドかを判定する。
    protected isGridPad(note: number): boolean {
        return note >= NOTE_RANGES.GRID.START && note <= NOTE_RANGES.GRID.END;
    }

    // isSideButton はサイドボタン領域かどうかを判定する。
    protected isSideButton(note: number): boolean {
        return note >= NOTE_RANGES.SIDE_BUTTONS.START && note <= NOTE_RANGES.SIDE_BUTTONS.END;
    }

    // isFaderButton はフェーダーボタンに該当するか判別する。
    protected isFaderButton(note: number): boolean {
        return this.getFaderButtonIndex(note) !== -1;
    }

    // getFaderButtonIndex はフェーダーボタンのインデックスを計算する。
    protected getFaderButtonIndex(note: number): number {
        if (note >= NOTE_RANGES.FADER_BUTTONS.START && note <= NOTE_RANGES.FADER_BUTTONS.END) {
            return note - NOTE_RANGES.FADER_BUTTONS.START;
        }

        if (note === NOTE_RANGES.FADER_BUTTON_8) {
            return GRID_COLS;
        }

        return -1;
    }

    // getGridCoordinate はノート番号を列・行インデックスへ変換する。
    protected getGridCoordinate(note: number): GridCoordinate | null {
        if (!this.isGridPad(note)) {
            return null;
        }

        const gridIndex = note - NOTE_RANGES.GRID.START;
        const column = gridIndex % GRID_COLS;
        const rowFromTop = Math.floor(gridIndex / GRID_COLS);
        const rowFromBottom = GRID_ROWS - 1 - rowFromTop;
        return { column, row: rowFromBottom };
    }

    // getGridNote は列・行からノート番号を逆算する。
    protected getGridNote(column: number, row: number): number {
        const clampedColumn = this.clampIndex(column, GRID_COLS);
        const clampedRow = this.clampIndex(row, GRID_ROWS);
        const rowFromTop = GRID_ROWS - 1 - clampedRow;
        const gridIndex = rowFromTop * GRID_COLS + clampedColumn;
        return NOTE_RANGES.GRID.START + gridIndex;
    }

    protected onMidiAvailabilityChanged(available: boolean): void {
        super.onMidiAvailabilityChanged(available);
        if (!this.usesVirtualInput || !this.virtualSurface || !this.virtualInput) {
            return;
        }

        const useVirtual = !available;
        this.virtualSurface.setVisible(useVirtual);
        this.virtualInput.setActive(useVirtual);
    }

    public override sendMessage(message: number[]): void {
        super.sendMessage(message);
        if (!this.usesVirtualInput || !this.virtualSurface || message.length === 0) {
            return;
        }

        const [status, data1, data2 = 0] = message;
        if (status === MIDI_STATUS.NOTE_ON || status === MIDI_OUTPUT_STATUS.NOTE_ON) {
            this.virtualSurface.applyNoteOutput(status, data1, data2);
        } else if (status === MIDI_STATUS.NOTE_OFF) {
            this.virtualSurface.applyNoteOutput(status, data1, 0);
        } else if (status === MIDI_STATUS.CONTROL_CHANGE) {
            this.virtualSurface.applyControlChange(data1, data2);
        }
    }

    protected getVirtualSurface(): APCMiniMK2VirtualSurface | null {
        return this.virtualSurface;
    }

    private dispatchVirtualMidiMessage(data: number[]): void {
        if (!this.usesVirtualInput) {
            return;
        }
        const message: MidiMessageLike = {
            data: new Uint8Array(data),
        };

        const callback = this.onMidiMessageCallback;
        if (callback) {
            callback(message);
            return;
        }

        this.reflectIncomingForVirtual(message);
        this.handleMIDIMessage(message);
    }

    private reflectIncomingForVirtual(message: MidiMessageLike): void {
        if (!this.usesVirtualInput || !this.virtualSurface) {
            return;
        }

        const data = message.data;
        if (!data || data.length < 2) {
            return;
        }

        const [status, data1, data2 = 0] = data;
        if (status === MIDI_STATUS.CONTROL_CHANGE) {
            this.virtualSurface.applyControlChange(data1, data2);
            return;
        }

        if (status === MIDI_STATUS.NOTE_ON || status === MIDI_OUTPUT_STATUS.NOTE_ON) {
            this.virtualSurface.applyNoteOutput(status, data1, data2);
            return;
        }

        if (status === MIDI_STATUS.NOTE_OFF) {
            this.virtualSurface.applyNoteOutput(status, data1, 0);
        }
    }

    // clamp01 は 0〜1 の範囲に値を収める。
    protected clamp01(value: number): number {
        if (value < 0) {
            return 0;
        }
        if (value > 1) {
            return 1;
        }
        return value;
    }

    // getTimestamp は高精度タイムスタンプを取得する。
    protected getTimestamp(): number {
        if (typeof performance !== "undefined" && typeof performance.now === "function") {
            return performance.now();
        }
        return Date.now();
    }

    // send は MIDI 出力にメッセージを転送するショートカット。
    protected send(status: number, data1: number, data2: number): void {
        this.sendMessage([status, data1, data2]);
    }

    // clampIndex は任意長の配列インデックスを範囲内に収める。
    private clampIndex(index: number, length: number): number {
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
}

/**
 * 派生クラスを作成する際の最小実装サンプル。
 * update() 内で LED を送信したい場合は、派生クラス側で `this.send(...)` を呼び出してください。
 */
export class APCMiniMK2PatternTemplate extends APCMiniMK2Base {
    // constructor は基底クラスを初期化するのみ。
    constructor() {
        super();
    }

    // handleMIDIMessage はテンプレートとして空実装を提供する。
    protected handleMIDIMessage(_message: MidiMessageLike): void {
        // TODO: MIDI入力に応じた処理を実装してください。
    }
}
