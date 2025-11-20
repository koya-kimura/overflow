import { GRID_COLS, GRID_ROWS } from "./APCMiniMK2Constants";
import styleSheet from "./APCMiniMK2VirtualSurface.css?inline";

const SIDE_BUTTON_COUNT = GRID_ROWS;
const FADER_COUNT = GRID_COLS + 1;

export class APCMiniMK2VirtualSurface {
    private root: HTMLElement | null = null;
    private pendingVisible = false;
    private readonly handleDomReady: () => void;
    private stylesReady = false;

    constructor() {
        this.handleDomReady = () => {
            this.ensureStyles();
            this.root = this.buildSurface();
            this.applyVisibility(this.pendingVisible);
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

    private applyVisibility(visible: boolean): void {
        if (!this.root) {
            return;
        }
        this.root.dataset.visible = visible ? "true" : "false";
        this.root.setAttribute("aria-hidden", visible ? "false" : "true");
    }

    private buildSurface(): HTMLElement | null {
        const host = document.getElementById("apcmini-ui");
        if (!host) {
            console.warn("apcmini-ui host element was not found in the document.");
            return null;
        }

        const existing = host.querySelector<HTMLElement>(".apcmini-virtual");
        if (existing) {
            return existing;
        }

        const container = document.createElement("div");
        container.className = "apcmini-virtual";
        container.dataset.visible = "false";
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
        for (let row = GRID_ROWS - 1; row >= 0; row--) {
            for (let col = 0; col < GRID_COLS; col++) {
                const pad = document.createElement("button");
                pad.type = "button";
                pad.className = "apcmini-virtual__pad";
                pad.textContent = `${col + 1}-${GRID_ROWS - row}`;
                pad.dataset.column = String(col);
                pad.dataset.row = String(row);
                target.appendChild(pad);
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
            target.appendChild(button);
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
            column.appendChild(button);

            const slider = document.createElement("input");
            slider.type = "range";
            slider.min = "0";
            slider.max = "127";
            slider.value = "0";
            slider.setAttribute("aria-label", `Fader ${index + 1}`);
            column.appendChild(slider);

            target.appendChild(column);
        }
    }
}
