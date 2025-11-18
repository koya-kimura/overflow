// APCMiniMK2PatternTemplate は APC Mini MK2 系クラスの共通基盤を提供する。

import { MIDIManager } from "../midiManager";

export const MIDI_STATUS = {
    NOTE_ON: 0x90,
    NOTE_OFF: 0x80,
    CONTROL_CHANGE: 0xB0,
} as const;

export const MIDI_OUTPUT_STATUS = {
    NOTE_ON: 0x96,
    NOTE_OFF: 0x80,
} as const;

export const NOTE_RANGES = {
    GRID: { START: 0, END: 63 },
    FADER_BUTTONS: { START: 100, END: 107 },
    SIDE_BUTTONS: { START: 112, END: 119 },
    FADERS: { START: 48, END: 56 },
    FADER_BUTTON_8: 122,
} as const;

export const GRID_ROWS = 8;
export const GRID_COLS = 8;

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
    // constructor は MIDI コールバックを必要に応じて自動紐付けする。
    protected constructor(autoBindCallback = true) {
        super();
        if (autoBindCallback) {
            this.onMidiMessageCallback = this.handleMIDIMessage.bind(this);
        }
    }

    // handleMIDIMessage は派生クラスが実装すべき必須コールバック。
    protected abstract handleMIDIMessage(message: WebMidi.MIDIMessageEvent): void;

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
    protected handleMIDIMessage(_message: WebMidi.MIDIMessageEvent): void {
        // TODO: MIDI入力に応じた処理を実装してください。
    }
}
