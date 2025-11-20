import {
    GRID_COLS,
    GRID_ROWS,
    MIDI_STATUS,
    NOTE_RANGES,
} from "./APCMiniMK2Constants";
import type { APCMiniMK2VirtualRefs } from "./APCMiniMK2VirtualSurface";
import { APCMiniMK2VirtualSurface } from "./APCMiniMK2VirtualSurface";

type MidiMessageEmitter = (data: number[]) => void;

export class APCMiniMK2VirtualInput {
    private readonly surface: APCMiniMK2VirtualSurface;
    private emitter: MidiMessageEmitter | null = null;
    private active = false;
    private isBound = false;
    private pendingActive = false;

    constructor(surface: APCMiniMK2VirtualSurface) {
        this.surface = surface;
        this.surface.onReady((refs) => {
            this.bind(refs);
            this.surface.setInteractive(this.pendingActive);
        });
    }

    public setMessageEmitter(emitter: MidiMessageEmitter): void {
        this.emitter = emitter;
    }

    public setActive(active: boolean): void {
        this.pendingActive = active;
        this.active = active;
        this.surface.setInteractive(active);
    }

    private bind(refs: APCMiniMK2VirtualRefs): void {
        if (this.isBound) {
            return;
        }
        this.isBound = true;

        refs.gridPads.forEach((button) => {
            button.addEventListener("pointerdown", this.handlePadPointerDown);
            button.addEventListener("keydown", this.handlePadKeyDown);
        });

        refs.sideButtons.forEach((button) => {
            button.addEventListener("click", this.handleSideButtonClick);
            button.addEventListener("keydown", this.handleSideButtonKeyDown);
        });

        refs.faderButtons.forEach((button) => {
            button.addEventListener("click", this.handleFaderButtonClick);
            button.addEventListener("keydown", this.handleFaderButtonKeyDown);
        });

        refs.faderSliders.forEach((slider) => {
            slider.addEventListener("input", this.handleFaderInput);
        });
    }

    private emit(data: number[]): void {
        if (!this.active || !this.emitter) {
            return;
        }
        this.emitter(data);
    }

    private handlePadPointerDown = (event: PointerEvent): void => {
        event.preventDefault();
        const button = event.currentTarget as HTMLButtonElement | null;
        if (!button) {
            return;
        }
        this.triggerPad(button);
    };

    private handlePadKeyDown = (event: KeyboardEvent): void => {
        if (event.key !== "Enter" && event.key !== " ") {
            return;
        }
        event.preventDefault();
        const button = event.currentTarget as HTMLButtonElement | null;
        if (!button) {
            return;
        }
        this.triggerPad(button);
    };

    private handleSideButtonClick = (event: MouseEvent): void => {
        const button = event.currentTarget as HTMLButtonElement | null;
        if (!button) {
            return;
        }
        this.triggerSideButton(button);
    };

    private handleSideButtonKeyDown = (event: KeyboardEvent): void => {
        if (event.key !== "Enter" && event.key !== " ") {
            return;
        }
        event.preventDefault();
        const button = event.currentTarget as HTMLButtonElement | null;
        if (!button) {
            return;
        }
        this.triggerSideButton(button);
    };

    private handleFaderButtonClick = (event: MouseEvent): void => {
        const button = event.currentTarget as HTMLButtonElement | null;
        if (!button) {
            return;
        }
        this.triggerFaderButton(button);
    };

    private handleFaderButtonKeyDown = (event: KeyboardEvent): void => {
        if (event.key !== "Enter" && event.key !== " ") {
            return;
        }
        event.preventDefault();
        const button = event.currentTarget as HTMLButtonElement | null;
        if (!button) {
            return;
        }
        this.triggerFaderButton(button);
    };

    private handleFaderInput = (event: Event): void => {
        const slider = event.currentTarget as HTMLInputElement | null;
        if (!slider) {
            return;
        }
        const index = this.parseDatasetIndex(slider.dataset.index);
        if (index === null) {
            return;
        }
        const controller = NOTE_RANGES.FADERS.START + this.clamp(index, GRID_COLS + 1);
        const value = this.clamp(Math.round(Number(slider.value)), 128);
        this.emit([MIDI_STATUS.CONTROL_CHANGE, controller, value]);
    };

    private triggerPad(button: HTMLButtonElement): void {
        const column = this.parseDatasetIndex(button.dataset.column);
        const row = this.parseDatasetIndex(button.dataset.row);
        if (column === null || row === null) {
            return;
        }
        const note = this.getGridNote(column, row);
        this.emit([MIDI_STATUS.NOTE_ON, note, 127]);
    }

    private triggerSideButton(button: HTMLButtonElement): void {
        const index = this.parseDatasetIndex(button.dataset.index);
        if (index === null) {
            return;
        }
        const note = NOTE_RANGES.SIDE_BUTTONS.START + this.clamp(index, GRID_ROWS);
        this.emit([MIDI_STATUS.NOTE_ON, note, 127]);
    }

    private triggerFaderButton(button: HTMLButtonElement): void {
        const index = this.parseDatasetIndex(button.dataset.index);
        if (index === null) {
            return;
        }
        const clampedIndex = this.clamp(index, GRID_COLS + 1);
        const note = clampedIndex < GRID_COLS
            ? NOTE_RANGES.FADER_BUTTONS.START + clampedIndex
            : NOTE_RANGES.FADER_BUTTON_8;
        this.emit([MIDI_STATUS.NOTE_ON, note, 127]);
    }

    private parseDatasetIndex(value: string | undefined): number | null {
        if (typeof value === "undefined") {
            return null;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    private getGridNote(column: number, row: number): number {
        const clampedColumn = this.clamp(column, GRID_COLS);
        const clampedRow = this.clamp(row, GRID_ROWS);
        const rowFromTop = GRID_ROWS - 1 - clampedRow;
        const gridIndex = rowFromTop * GRID_COLS + clampedColumn;
        return NOTE_RANGES.GRID.START + gridIndex;
    }

    private clamp(value: number, maxExclusive: number): number {
        if (value < 0) {
            return 0;
        }
        if (value >= maxExclusive) {
            return maxExclusive - 1;
        }
        return value;
    }
}
