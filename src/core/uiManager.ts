import p5 from "p5";
import type { TexManager } from "./texManager";
import type { bandManager } from "../scenes/bandManager";
import type { EffectManager } from "./effectManager";
import { DateText } from "../utils/dateText";
import { Easing } from "../utils/easing";

type UIDrawResources = {
    texManager: TexManager;
    bandManager: bandManager;
    effectManager: EffectManager;
    captureTexture: p5.Graphics | undefined;
    bpm: number;
    beat: number;
    paramsRows: number[][];
    colorPalette: string[];
    colorPaletteRGB: number[];
};

type UIDrawContext = UIDrawResources & {
    p: p5;
    tex: p5.Graphics;
    font: p5.Font;
};

type UIDrawFunction = (context: UIDrawContext) => void;

const UIDraw01: UIDrawFunction = ({ tex }) => {
    tex.clear();
    // UI表示なし
};

const UIDraw02: UIDrawFunction = ({
    p,
    tex,
    font,
    bpm,
    beat,
}) => {
    tex.push();
    tex.textFont(font);

    tex.push();
    tex.textAlign(p.CENTER, p.CENTER);
    tex.fill(255);
    tex.noStroke();
    tex.textSize(Math.min(tex.width, tex.height) * 0.15);
    tex.text("TAKASHIMA & KIMURA", tex.width / 2, tex.height / 2);
    tex.pop();

    const n = 50;
    for(let j of [-1, 1]) {
        for (let i = 0; i < n; i++) {
            const speed = 10;                   // 流れる速さはお好みで
            const span = tex.width * 1.2;       // ループさせたい幅
            const base = p.map(i, 0, n, -0.1, 1.1) * tex.width;

            const x = ((base - beat * speed) % span + span) % span - tex.width * 0.1;
            const y = tex.height * (0.5 + 0.45 * j);
            const str = [..."OVER!FLOW"][i % 9];

            tex.push();
            tex.fill(255);
            tex.noStroke();
            tex.textSize(tex.width / n * 0.95);
            tex.textAlign(p.CENTER, p.CENTER);
            tex.text(str, x, y);
            tex.pop();
        }
    }

    tex.push();
    tex.textAlign(p.RIGHT, p.BOTTOM);
    tex.fill(255);
    tex.noStroke();
    tex.textSize(tex.width * 0.015);
    const dateText = DateText.getYYYYMMDD_HHMMSS_format();
    tex.text(`BPM: ${bpm.toFixed(1)}`, tex.width * 0.97, tex.height * 0.86);
    tex.text(`DATE: ${dateText}`, tex.width * 0.97, tex.height * 0.9);
    tex.pop();

    tex.push();
    tex.noFill();
    tex.stroke(255);
    tex.rect(tex.width * 0.03, tex.height * 0.9, tex.width * 0.1, -tex.height * 0.04);

    const x = p.map(Easing.zigzag(beat / 2), 0, 1, 0, tex.width * 0.1 - tex.width * 0.01);
    tex.noStroke();
    tex.fill(255);
    tex.rect(tex.width * 0.03 + x, tex.height * 0.9, tex.width * 0.01, -tex.height * 0.04);
    tex.pop();

    tex.pop();
}

const UIDRAWERS: readonly UIDrawFunction[] = [
    UIDraw01,
    UIDraw02,
];

// UIManager は単純なテキストオーバーレイの描画を担当する。
export class UIManager {
    private renderTexture: p5.Graphics | undefined;
    private activePatternIndex: number;

    constructor() {
        this.renderTexture = undefined;
        this.activePatternIndex = 0;
    }

    init(p: p5): void {
        this.renderTexture = p.createGraphics(p.width, p.height);
    }

    getTexture(): p5.Graphics {
        const texture = this.renderTexture;
        if (!texture) {
            throw new Error("Texture not initialized");
        }
        return texture;
    }

    resize(p: p5): void {
        const texture = this.renderTexture;
        if (!texture) {
            throw new Error("Texture not initialized");
        }
        texture.resizeCanvas(p.width, p.height);
    }

    update(_p: p5, params: number[]): void {
        const index = this.normalizePatternIndex(params?.[0]);
        this.activePatternIndex = index;
    }

    draw(p: p5, font: p5.Font, resources: UIDrawResources): void {
        const texture = this.renderTexture;
        if (!texture) {
            throw new Error("Texture not initialized");
        }

        texture.push();
        texture.clear();
        const drawer = UIDRAWERS[this.activePatternIndex] ?? UIDRAWERS[0];
        drawer({
            p,
            tex: texture,
            font,
            ...resources,
        });

        texture.pop();
    }

    private normalizePatternIndex(value: number | undefined): number {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            return 0;
        }
        const clamped = Math.max(0, Math.floor(value));
        return Math.min(UIDRAWERS.length - 1, clamped);
    }
}