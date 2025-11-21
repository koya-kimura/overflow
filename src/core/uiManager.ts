import p5 from "p5";
import { DateText } from "../utils/dateText";
import { Easing } from "../utils/easing";

type PositionPattern = readonly [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }];

const SIZE_PATTERNS: readonly [number, number, number][] = [
    [1.0, 0.5, 0.5],
    [0.9, 0.6, 0.6],
    [1.1, 0.4, 0.6],
    [0.8, 0.8, 0.4],
    [1.2, 0.6, 0.3],
    [1.0, 0.7, 0.7],
    [0.7, 0.5, 0.9],
];

const ROTATION_PATTERNS: readonly [number, number, number][] = [
    [0, 0, 0],
    [0.1, 0.05, -0.05],
    [-0.1, 0.08, 0.12],
    [0.3, 0, -0.3],
    [-0.2, 0.2, 0],
    [0.5, -0.4, 0.2],
    [0, 0.3, -0.3],
];

const POSITION_PATTERNS: readonly PositionPattern[] = [
    [
        { x: 0.5, y: 0.5 },
        { x: 0.5, y: 0.62 },
        { x: 0.5, y: 0.38 },
    ],
    [
        { x: 0.35, y: 0.4 },
        { x: 0.55, y: 0.55 },
        { x: 0.75, y: 0.7 },
    ],
    [
        { x: 0.2, y: 0.25 },
        { x: 0.2, y: 0.45 },
        { x: 0.2, y: 0.65 },
    ],
    [
        { x: 0.8, y: 0.3 },
        { x: 0.6, y: 0.5 },
        { x: 0.4, y: 0.7 },
    ],
    [
        { x: 0.5, y: 0.2 },
        { x: 0.5, y: 0.5 },
        { x: 0.5, y: 0.8 },
    ],
    [
        { x: 0.3, y: 0.65 },
        { x: 0.5, y: 0.35 },
        { x: 0.7, y: 0.5 },
    ],
    [
        { x: 0.15, y: 0.8 },
        { x: 0.5, y: 0.2 },
        { x: 0.85, y: 0.5 },
    ],
];

type TransitionQueueItem = {
    value: number;
    duration: number;
};

type TransitionState = {
    current: number;
    start: number;
    target: number;
    elapsed: number;
    duration: number;
    queue: TransitionQueueItem[];
};

type TextState = {
    getText: () => string;
    size: TransitionState;
    rotation: TransitionState;
    posX: TransitionState;
    posY: TransitionState;
};

const EPSILON = 1e-4;

// TexManager は描画用の p5.Graphics とシーン、MIDI デバッグ描画のハブを担当する。
export class UIManager {
    private renderTexture: p5.Graphics | null;
    private textStates: TextState[];
    private patternIndices: [number, number, number];

    // コンストラクタではデバッグ用シーン管理と MIDI ハンドラをセットアップする。
    constructor() {
        this.renderTexture = null;
        this.textStates = [
            this.createTextState(() => "TAKASHIMA & KIMURA", 0),
            this.createTextState(() => "OVER!FLOW", 1),
            this.createTextState(() => DateText.getYYYYMMDD_HHMMSS_format(), 2),
        ];
        this.patternIndices = [0, 0, 0];
    }

    private createTextState(getText: () => string, index: number): TextState {
        const sizeInitial = SIZE_PATTERNS[0][index] ?? 1;
        const rotationInitial = ROTATION_PATTERNS[0][index] ?? 0;
        const positionInitial = POSITION_PATTERNS[0][index] ?? { x: 0.5, y: 0.5 };
        return {
            getText,
            size: this.createTransition(sizeInitial),
            rotation: this.createTransition(rotationInitial),
            posX: this.createTransition(positionInitial.x),
            posY: this.createTransition(positionInitial.y),
        };
    }

    private createTransition(initial: number): TransitionState {
        return {
            current: initial,
            start: initial,
            target: initial,
            elapsed: 0,
            duration: 0,
            queue: [],
        };
    }

    // init はキャンバスサイズに合わせた描画用 Graphics を初期化する。
    init(p: p5): void {
        this.renderTexture = p.createGraphics(p.width, p.height);
    }

    // getTexture は初期化済みの描画バッファを返し、未初期化時はエラーとする。
    getTexture(): p5.Graphics {
        const texture = this.renderTexture;
        if (!texture) {
            throw new Error("Texture not initialized");
        }
        return texture;
    }

    // resize は現在の Graphics を最新のウィンドウサイズに追従させる。
    resize(p: p5): void {
        const texture = this.renderTexture;
        if (!texture) {
            throw new Error("Texture not initialized");
        }
        texture.resizeCanvas(p.width, p.height);
    }

    // update はシーンの更新前に MIDI 状態を反映させる。
    update(p: p5, getParamsLastRow: number[], bpm: number): void {
        const indices: [number, number, number] = [
            this.normalizePatternIndex(getParamsLastRow[0], SIZE_PATTERNS.length),
            this.normalizePatternIndex(getParamsLastRow[1], ROTATION_PATTERNS.length),
            this.normalizePatternIndex(getParamsLastRow[2], POSITION_PATTERNS.length),
        ];

        const transitionDuration = this.computeTransitionDuration(bpm);

        if (indices[0] !== this.patternIndices[0]) {
            this.patternIndices[0] = indices[0];
            const sizePattern = SIZE_PATTERNS[indices[0]];
            this.textStates.forEach((state, idx) => {
                const nextValue = sizePattern[idx] ?? sizePattern[sizePattern.length - 1];
                this.enqueueTransition(state.size, nextValue, transitionDuration);
            });
        }

        if (indices[1] !== this.patternIndices[1]) {
            this.patternIndices[1] = indices[1];
            const rotationPattern = ROTATION_PATTERNS[indices[1]];
            this.textStates.forEach((state, idx) => {
                const nextValue = rotationPattern[idx] ?? rotationPattern[rotationPattern.length - 1];
                this.enqueueTransition(state.rotation, nextValue, transitionDuration);
            });
        }

        if (indices[2] !== this.patternIndices[2]) {
            this.patternIndices[2] = indices[2];
            const positionPattern = POSITION_PATTERNS[indices[2]];
            this.textStates.forEach((state, idx) => {
                const nextPos = positionPattern[idx] ?? positionPattern[positionPattern.length - 1];
                this.enqueueTransition(state.posX, nextPos.x, transitionDuration);
                this.enqueueTransition(state.posY, nextPos.y, transitionDuration);
            });
        }

        const deltaMs = Number.isFinite(p.deltaTime) ? p.deltaTime : 16.67;

        this.textStates.forEach((state) => {
            this.updateTransitionState(state.size, deltaMs);
            this.updateTransitionState(state.rotation, deltaMs);
            this.updateTransitionState(state.posX, deltaMs);
            this.updateTransitionState(state.posY, deltaMs);
        });
    }

    // draw はシーン描画と MIDI デバッグオーバーレイを Graphics 上にまとめて描画する。
    draw(p: p5, font: p5.Font): void {
        const texture = this.renderTexture;
        if (!texture) {
            throw new Error("Texture not initialized");
        }

        texture.push();
        texture.clear();
        texture.textFont(font);
        texture.textAlign(p.CENTER, p.CENTER);
        texture.fill(255);
        texture.noStroke();

        const baseSize = Math.min(texture.width, texture.height) * 0.07;

        this.textStates.forEach((state) => {
            const textValue = state.getText();
            const textSize = baseSize * state.size.current;
            const posX = state.posX.current * texture.width;
            const posY = state.posY.current * texture.height;

            texture.push();
            texture.translate(posX, posY);
            texture.rotate(state.rotation.current);
            texture.textSize(textSize);
            texture.text(textValue, 0, 0);
            texture.pop();
        });

        texture.pop();
    }

    private normalizePatternIndex(value: number | undefined, length: number): number {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            return 0;
        }
        const clamped = Math.max(0, Math.floor(value));
        return Math.min(length - 1, clamped);
    }

    private computeTransitionDuration(bpm: number): number {
        const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 120;
        return (60 / safeBpm) * 1000;
    }

    private enqueueTransition(state: TransitionState, value: number, duration: number): void {
        if (Math.abs(state.current - value) < EPSILON && state.duration <= 0 && state.queue.length === 0) {
            return;
        }

        const lastQueuedValue = state.queue.length > 0 ? state.queue[state.queue.length - 1].value : state.target;
        if (Math.abs(lastQueuedValue - value) < EPSILON) {
            return;
        }

        state.queue.push({ value, duration });
        if (state.duration <= 0) {
            this.beginNextTransition(state);
        }
    }

    private beginNextTransition(state: TransitionState): void {
        const next = state.queue.shift();
        if (!next) {
            state.duration = 0;
            state.elapsed = 0;
            state.start = state.current;
            state.target = state.current;
            return;
        }
        state.start = state.current;
        state.target = next.value;
        state.duration = Math.max(1, next.duration);
        state.elapsed = 0;
    }

    private updateTransitionState(state: TransitionState, deltaMs: number): void {
        if (state.duration <= 0) {
            if (state.queue.length > 0) {
                this.beginNextTransition(state);
            }
            return;
        }

        state.elapsed = Math.min(state.elapsed + deltaMs, state.duration);
        const t = state.duration > 0 ? Math.min(state.elapsed / state.duration, 1) : 1;
        const eased = Easing.easeInOutQuad(t);
        state.current = state.start + (state.target - state.start) * eased;

        if (state.elapsed >= state.duration) {
            state.current = state.target;
            state.start = state.target;
            state.duration = 0;
            state.elapsed = 0;
            if (state.queue.length > 0) {
                this.beginNextTransition(state);
            }
        }
    }
}