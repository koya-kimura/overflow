import {
    GRID_COLS,
    GRID_ROWS,
    NOTE_RANGES,
} from "./APCMiniMK2Constants";
import styleSheet from "./APCMiniMK2VirtualSurface.css?inline";

const SIDE_BUTTON_COUNT = GRID_ROWS;
const FADER_COUNT = GRID_COLS + 1;
const SLIDER_ACTIVE_COLOR = "#6cf5ff";

const LED_COLOR_MAP: Record<number, string> = {
    0: "#202020",
    3: "#ff4d4d",
    5: "#ff6b6b",
    13: "#a8ff5c",
    21: "#2ef2a2",
    32: "#32b8ff",
    37: "#3f6dff",
    41: "#7dff50",
    45: "#bf6dff",
    53: "#ff66d9",
    56: "#ff94d9",
    60: "#ffb347",
    120: "#ffe066",
    127: "#ffffff",
};

export interface APCMiniMK2VirtualRefs {
    root: HTMLElement;
    gridPads: HTMLButtonElement[];
    sideButtons: HTMLButtonElement[];
    faderButtons: HTMLButtonElement[];
    faderSliders: HTMLInputElement[];
}

export class APCMiniMK2VirtualSurface {
    private root: HTMLElement | null = null;
    private pendingVisible = false;
    private pendingInteractive = false;
    private readonly handleDomReady: () => void;
    private stylesReady = false;

    private gridPads: HTMLButtonElement[] = [];
    private sideButtons: HTMLButtonElement[] = [];
    private faderButtons: HTMLButtonElement[] = [];
    private faderSliders: HTMLInputElement[] = [];

    private readonly noteToPad = new Map<number, HTMLButtonElement>();
    private readonly noteToSide = new Map<number, HTMLButtonElement>();
    private readonly noteToFaderButton = new Map<number, HTMLButtonElement>();
    private readonly controllerToSlider = new Map<number, HTMLInputElement>();

    private readonly readyCallbacks: Array<(refs: APCMiniMK2VirtualRefs) => void> = [];

    constructor() {
        this.handleDomReady = () => {
            this.ensureStyles();
            this.root = this.buildSurface();
            if (this.root) {
                this.applyVisibility(this.pendingVisible);
                this.applyInteractive(this.pendingInteractive);
                this.notifyReady();
            }
        };

        if (typeof document === "undefined") {
            return;
        }

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", this.handleDomReady, { once: true });
        } else {
            this.handleDomReady();
        }
    }

    public setVisible(visible: boolean): void {
        this.pendingVisible = visible;
        this.applyVisibility(visible);
    }

    public setInteractive(interactive: boolean): void {
        this.pendingInteractive = interactive;
        this.applyInteractive(interactive);
    }

    public onReady(callback: (refs: APCMiniMK2VirtualRefs) => void): void {
        if (this.root) {
            callback(this.cloneRefs());
            return;
        }
        this.readyCallbacks.push(callback);
    }

    private applyVisibility(visible: boolean): void {
        if (!this.root) {
            return;
        }
        this.root.dataset.visible = visible ? "true" : "false";
        this.root.setAttribute("aria-hidden", visible ? "false" : "true");
    }

    private applyInteractive(interactive: boolean): void {
        if (!this.root) {
            return;
        }
        this.root.dataset.interactive = interactive ? "true" : "false";
        this.root.setAttribute("aria-disabled", interactive ? "false" : "true");
    }

    private buildSurface(): HTMLElement | null {
        const host = document.getElementById("apcmini-ui");
        if (!host) {
            console.warn("apcmini-ui host element was not found in the document.");
            return null;
        }

        const existing = host.querySelector<HTMLElement>(".apcmini-virtual");
        if (existing) {
            this.cacheElementsFromExisting(existing);
            return existing;
        }

        this.resetElementCaches();

        const container = document.createElement("div");
        container.className = "apcmini-virtual";
        container.dataset.visible = "false";
        container.dataset.interactive = "false";
        container.setAttribute("aria-hidden", "true");

        const headline = document.createElement("div");
        headline.className = "apcmini-virtual__headline";

        const title = document.createElement("h2");
        title.className = "apcmini-virtual__title";
        title.textContent = "APC Mini MK2 Virtual Surface";
        headline.appendChild(title);

        const status = document.createElement("p");
        status.className = "apcmini-virtual__status";
        status.textContent = "MIDI controller not detected. Use this virtual layout.";
        headline.appendChild(status);

        container.appendChild(headline);

        const matrix = document.createElement("div");
        matrix.className = "apcmini-virtual__matrix";

        const grid = document.createElement("div");
        grid.className = "apcmini-virtual__grid";
        this.populateGridPads(grid);
        matrix.appendChild(grid);

        const side = document.createElement("div");
        side.className = "apcmini-virtual__side";
        this.populateSideButtons(side);
        matrix.appendChild(side);

        container.appendChild(matrix);

        const faders = document.createElement("div");
        faders.className = "apcmini-virtual__faders";
        this.populateFaders(faders);
        container.appendChild(faders);

        host.appendChild(container);
        return container;
    }

    private ensureStyles(): void {
        if (this.stylesReady || typeof document === "undefined") {
            return;
        }

        const styleId = "apcmini-virtual-style";
        const existing = document.getElementById(styleId);
        if (!existing) {
            const style = document.createElement("style");
            style.id = styleId;
            style.textContent = styleSheet;
            document.head.appendChild(style);
        }

        this.stylesReady = true;
    }

    private populateGridPads(target: HTMLElement): void {
        for (let visualRow = 0; visualRow < GRID_ROWS; visualRow++) {
            for (let col = 0; col < GRID_COLS; col++) {
                const pad = document.createElement("button");
                pad.type = "button";
                pad.className = "apcmini-virtual__pad";
                pad.textContent = `${col + 1}-${visualRow + 1}`;
                pad.dataset.column = String(col);
                pad.dataset.row = String(visualRow);
                pad.dataset.led = "off";
                target.appendChild(pad);
                this.gridPads.push(pad);

                const note = this.computeGridNote(col, visualRow);
                this.noteToPad.set(note, pad);
            }
        }
    }

    private populateSideButtons(target: HTMLElement): void {
        for (let index = 0; index < SIDE_BUTTON_COUNT; index++) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "apcmini-virtual__side-button";
            button.textContent = `S${index + 1}`;
            button.dataset.index = String(index);
            button.dataset.led = "off";
            target.appendChild(button);
            this.sideButtons.push(button);

            const note = NOTE_RANGES.SIDE_BUTTONS.START + index;
            this.noteToSide.set(note, button);
        }
    }

    private populateFaders(target: HTMLElement): void {
        for (let index = 0; index < FADER_COUNT; index++) {
            const column = document.createElement("div");
            column.className = "apcmini-virtual__fader";

            const button = document.createElement("button");
            button.type = "button";
            button.className = "apcmini-virtual__fader-button";
            button.textContent = index === FADER_COUNT - 1 ? "Master" : `F${index + 1}`;
            button.dataset.index = String(index);
            button.dataset.led = "off";
            column.appendChild(button);
            this.faderButtons.push(button);

            const note = index < GRID_COLS
                ? NOTE_RANGES.FADER_BUTTONS.START + index
                : NOTE_RANGES.FADER_BUTTON_8;
            this.noteToFaderButton.set(note, button);

            const slider = document.createElement("input");
            slider.type = "range";
            slider.min = "0";
            slider.max = "127";
            slider.value = "0";
            slider.dataset.index = String(index);
            slider.setAttribute("aria-label", `Fader ${index + 1}`);
            column.appendChild(slider);
            this.faderSliders.push(slider);

            const controller = NOTE_RANGES.FADERS.START + index;
            this.controllerToSlider.set(controller, slider);
            this.updateSliderVisual(slider, 0);

            target.appendChild(column);
        }
    }

    private cacheElementsFromExisting(root: HTMLElement): void {
        this.gridPads = Array.from(root.querySelectorAll<HTMLButtonElement>(".apcmini-virtual__pad"));
        this.sideButtons = Array.from(root.querySelectorAll<HTMLButtonElement>(".apcmini-virtual__side-button"));
        this.faderButtons = Array.from(root.querySelectorAll<HTMLButtonElement>(".apcmini-virtual__fader-button"));
        this.faderSliders = Array.from(root.querySelectorAll<HTMLInputElement>(".apcmini-virtual__fader input[type=\"range\"]"));

        this.noteToPad.clear();
        this.gridPads.forEach((pad) => {
            const column = Number(pad.dataset.column ?? "0");
            const rowFromTop = Number(pad.dataset.row ?? "0");
            const note = this.computeGridNote(column, rowFromTop);
            this.noteToPad.set(note, pad);
        });

        this.noteToSide.clear();
        this.sideButtons.forEach((button, index) => {
            const note = NOTE_RANGES.SIDE_BUTTONS.START + index;
            this.noteToSide.set(note, button);
        });

        this.noteToFaderButton.clear();
        this.faderButtons.forEach((button, index) => {
            const note = index < GRID_COLS
                ? NOTE_RANGES.FADER_BUTTONS.START + index
                : NOTE_RANGES.FADER_BUTTON_8;
            this.noteToFaderButton.set(note, button);
        });

        this.controllerToSlider.clear();
        this.faderSliders.forEach((slider, index) => {
            const controller = NOTE_RANGES.FADERS.START + index;
            this.controllerToSlider.set(controller, slider);
            this.updateSliderVisual(slider, Number(slider.value));
        });
    }

    private resetElementCaches(): void {
        this.gridPads = [];
        this.sideButtons = [];
        this.faderButtons = [];
        this.faderSliders = [];
        this.noteToPad.clear();
        this.noteToSide.clear();
        this.noteToFaderButton.clear();
        this.controllerToSlider.clear();
    }

    private notifyReady(): void {
        if (!this.root) {
            return;
        }

        if (this.readyCallbacks.length === 0) {
            return;
        }

        const callbacks = [...this.readyCallbacks];
        this.readyCallbacks.length = 0;
        const refs = this.cloneRefs();
        callbacks.forEach((callback) => callback(refs));
    }

    private cloneRefs(): APCMiniMK2VirtualRefs {
        if (!this.root) {
            throw new Error("Virtual surface root is not ready.");
        }

        return {
            root: this.root,
            gridPads: [...this.gridPads],
            sideButtons: [...this.sideButtons],
            faderButtons: [...this.faderButtons],
            faderSliders: [...this.faderSliders],
        };
    }

    public applyNoteOutput(_status: number, note: number, velocity: number): void {
        const pad = this.noteToPad.get(note);
        if (pad) {
            this.applyLedStyle(pad, velocity);
            return;
        }

        const side = this.noteToSide.get(note);
        if (side) {
            this.applyLedStyle(side, velocity);
            return;
        }

        const faderButton = this.noteToFaderButton.get(note);
        if (faderButton) {
            this.applyLedStyle(faderButton, velocity);
        }
    }

    public applyControlChange(controller: number, value: number): void {
        const slider = this.controllerToSlider.get(controller);
        if (!slider) {
            return;
        }
        this.updateSliderVisual(slider, value);
    }

    private computeGridNote(column: number, rowFromTop: number): number {
        const clampedColumn = this.clamp(column, 0, GRID_COLS - 1);
        const clampedRowFromTop = this.clamp(rowFromTop, 0, GRID_ROWS - 1);
        const rowFromBottom = GRID_ROWS - 1 - clampedRowFromTop;
        return NOTE_RANGES.GRID.START + rowFromBottom * GRID_COLS + clampedColumn;
    }

    private applyLedStyle(element: HTMLButtonElement, velocity: number): void {
        if (velocity <= 0) {
            this.resetLedStyle(element);
            return;
        }

        const color = this.resolveLedColor(velocity);
        const lighter = this.lightenColor(color, 0.4);
        const darker = this.darkenColor(color, 0.35);
        const glow = this.withAlpha(color, 0.55);

        element.style.background = `linear-gradient(145deg, ${lighter}, ${darker})`;
        element.style.borderColor = darker;
        element.style.boxShadow = `0 0 18px ${glow}`;
        element.style.color = "#050505";
        element.dataset.led = "on";
    }

    private resetLedStyle(element: HTMLButtonElement): void {
        element.style.background = "";
        element.style.borderColor = "";
        element.style.boxShadow = "";
        element.style.color = "";
        element.dataset.led = "off";
    }

    private updateSliderVisual(slider: HTMLInputElement, value: number): void {
        const clampedValue = this.clamp(value, 0, 127);
        slider.value = String(clampedValue);
        const percent = (clampedValue / 127) * 100;
        slider.style.background = `linear-gradient(180deg, ${SLIDER_ACTIVE_COLOR} 0%, ${SLIDER_ACTIVE_COLOR} ${percent}%, rgba(40, 40, 40, 0.9) ${percent}%, rgba(40, 40, 40, 0.9) 100%)`;
    }

    private resolveLedColor(velocity: number): string {
        const mapped = LED_COLOR_MAP[velocity];
        if (mapped) {
            return mapped;
        }

        const hue = Math.round((velocity / 127) * 360) % 360;
        return this.hslToHex(hue, 70, 55);
    }

    private lightenColor(color: string, amount: number): string {
        return this.mixColor(color, "#ffffff", amount);
    }

    private darkenColor(color: string, amount: number): string {
        return this.mixColor(color, "#000000", amount);
    }

    private mixColor(color: string, mixWith: string, amount: number): string {
        const [r1, g1, b1] = this.parseColor(color);
        const [r2, g2, b2] = this.parseColor(mixWith);
        const t = this.clamp(amount, 0, 1);
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        return this.rgbToHex(r, g, b);
    }

    private withAlpha(color: string, alpha: number): string {
        const [r, g, b] = this.parseColor(color);
        const clamped = this.clamp(alpha, 0, 1);
        return `rgba(${r}, ${g}, ${b}, ${clamped})`;
    }

    private parseColor(color: string): [number, number, number] {
        if (color.startsWith("#")) {
            const hex = color.slice(1);
            const normalized = hex.length === 3
                ? hex.split("").map((ch) => ch + ch).join("")
                : hex;
            const value = Number.parseInt(normalized, 16);
            const r = (value >> 16) & 255;
            const g = (value >> 8) & 255;
            const b = value & 255;
            return [r, g, b];
        }

        throw new Error(`Unsupported color format: ${color}`);
    }

    private rgbToHex(r: number, g: number, b: number): string {
        const toHex = (component: number) => component.toString(16).padStart(2, "0");
        const red = this.clamp(Math.round(r), 0, 255);
        const green = this.clamp(Math.round(g), 0, 255);
        const blue = this.clamp(Math.round(b), 0, 255);
        return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
    }

    private hslToHex(h: number, s: number, l: number): string {
        const saturation = this.clamp(s / 100, 0, 1);
        const lightness = this.clamp(l / 100, 0, 1);
        const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
        const hPrime = (h % 360) / 60;
        const x = c * (1 - Math.abs((hPrime % 2) - 1));
        let r = 0;
        let g = 0;
        let b = 0;

        if (hPrime >= 0 && hPrime < 1) {
            r = c;
            g = x;
        } else if (hPrime >= 1 && hPrime < 2) {
            r = x;
            g = c;
        } else if (hPrime >= 2 && hPrime < 3) {
            g = c;
            b = x;
        } else if (hPrime >= 3 && hPrime < 4) {
            g = x;
            b = c;
        } else if (hPrime >= 4 && hPrime < 5) {
            r = x;
            b = c;
        } else if (hPrime >= 5 && hPrime < 6) {
            r = c;
            b = x;
        }

        const m = lightness - c / 2;
        const red = Math.round((r + m) * 255);
        const green = Math.round((g + m) * 255);
        const blue = Math.round((b + m) * 255);
        return this.rgbToHex(red, green, blue);
    }

    private clamp(value: number, min: number, max: number): number {
        if (Number.isNaN(value)) {
            return min;
        }
        if (value < min) {
            return min;
        }
        if (value > max) {
            return max;
        }
        return value;
    }
}
