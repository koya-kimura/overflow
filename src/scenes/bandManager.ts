import p5 from "p5";
import type { Scene } from "./Scene";
import { ColorPalette } from "../utils/colorPalette";
import { UniformRandom } from "../utils/uniformRandom";
import { GVM } from "../utils/gvm";
import { Easing } from "../utils/easing";

type BoxCoordinates = {
    topX1: number;
    topX2: number;
    bottomX1: number;
    bottomX2: number;
    noiseSeed: number;
}

// 7セグメントディスプレイのパターン定義 (0-9)
const NUMBER_PATTERNS = [
    [true, true, false, true, true, true, true], // 0
    [false, false, false, false, true, false, true], // 1
    [true, true, true, false, true, true, false], // 2
    [true, true, true, false, true, false, true], // 3
    [false, false, true, true, true, false, true], // 4
    [true, true, true, true, false, false, true], // 5
    [true, true, true, true, false, true, true], // 6
    [true, false, false, false, true, false, true], // 7
    [true, true, true, true, true, true, true], // 8
    [true, true, true, true, true, false, true], // 9
];

type AlignX = "CENTER" | "LEFT" | "RIGHT";

type SegmentLayoutOptions = {
    stringAreaTopYScale: number;
    stringAreaBottomYScale: number;
    stringWeight: number;
    weightAspect: number;
};

type SegmentContext = {
    topY: number;
    midY: number;
    bottomY: number;
    hWeight: number;
    stringWeight: number;
    weightAspect: number;
};

type SegmentConfig = {
    y1: number;
    y2: number;
    xscl: number;
    align: AlignX;
};

type DrawSegmentCallback = (segmentId: number, yscl1: number, yscl2: number, xscl: number, align: AlignX) => void;

const SEGMENT_BUILDERS: ReadonlyArray<(ctx: SegmentContext) => SegmentConfig> = [
    (ctx) => ({ y1: ctx.topY, y2: ctx.topY + ctx.hWeight, xscl: 1.0, align: "CENTER" }),
    (ctx) => ({ y1: ctx.bottomY - ctx.hWeight, y2: ctx.bottomY, xscl: 1.0, align: "CENTER" }),
    (ctx) => ({ y1: ctx.midY - ctx.hWeight * 0.5, y2: ctx.midY + ctx.hWeight * 0.5, xscl: 1.0, align: "CENTER" }),
    (ctx) => ({ y1: ctx.topY, y2: ctx.midY, xscl: ctx.stringWeight * ctx.weightAspect, align: "LEFT" }),
    (ctx) => ({ y1: ctx.topY, y2: ctx.midY, xscl: ctx.stringWeight * ctx.weightAspect, align: "RIGHT" }),
    (ctx) => ({ y1: ctx.midY, y2: ctx.bottomY, xscl: ctx.stringWeight * ctx.weightAspect, align: "LEFT" }),
    (ctx) => ({ y1: ctx.midY, y2: ctx.bottomY, xscl: ctx.stringWeight * ctx.weightAspect, align: "RIGHT" }),
];

class DigitSegment {
    private readonly base: SegmentConfig;
    private current: SegmentConfig;
    public readonly id: number;

    constructor(id: number, base: SegmentConfig) {
        this.id = id;
        this.base = base;
        this.current = { ...this.base };
    }

    resetTransform(): void {
        this.current = { ...this.base };
    }

    draw(drawSegment: DrawSegmentCallback): void {
        drawSegment(this.id, this.current.y1, this.current.y2, this.current.xscl, this.current.align);
    }
}

class SevenSegmentDigit {
    private segments: DigitSegment[] = [];
    private currentNumber: number | null = null;
    private layout: SegmentLayoutOptions = {
        stringAreaTopYScale: 0.3,
        stringAreaBottomYScale: 0.7,
        stringWeight: 0.15,
        weightAspect: 2,
    };

    setNumber(number: number, options?: Partial<SegmentLayoutOptions>, control?: { forceRebuild?: boolean; resetTransforms?: boolean }): void {
        const mergedLayout: SegmentLayoutOptions = {
            ...this.layout,
            ...options,
        };

        const normalizedNumber = this.normalizeNumber(number);
        const forceRebuild = control?.forceRebuild ?? false;
        const resetTransforms = control?.resetTransforms ?? false;
        const layoutChanged = !this.areLayoutsEqual(this.layout, mergedLayout);
        const numberChanged = this.currentNumber !== normalizedNumber;

        if (forceRebuild || layoutChanged || numberChanged) {
            this.layout = mergedLayout;
            this.currentNumber = normalizedNumber;
            this.segments = this.createSegments(normalizedNumber, this.layout);
            return;
        }

        if (resetTransforms) {
            this.resetSegments();
        }
    }

    draw(drawSegment: DrawSegmentCallback): void {
        for (const segment of this.segments) {
            segment.draw(drawSegment);
        }
    }

    resetSegments(): void {
        for (const segment of this.segments) {
            segment.resetTransform();
        }
    }

    private createSegments(number: number, layout: SegmentLayoutOptions): DigitSegment[] {
        const context = this.createContext(layout);
        const pattern = NUMBER_PATTERNS[number];
        const segments: DigitSegment[] = [];

        pattern.forEach((isActive, index) => {
            if (!isActive) return;
            const config = SEGMENT_BUILDERS[index](context);
            segments.push(new DigitSegment(index, config));
        });

        return segments;
    }

    private createContext(layout: SegmentLayoutOptions): SegmentContext {
        const stringAreaHeightScale = layout.stringAreaBottomYScale - layout.stringAreaTopYScale;
        const topY = layout.stringAreaTopYScale;
        const bottomY = layout.stringAreaBottomYScale;
        const midY = layout.stringAreaTopYScale + stringAreaHeightScale * 0.5;
        const hWeight = stringAreaHeightScale * layout.stringWeight;

        return {
            topY,
            midY,
            bottomY,
            hWeight,
            stringWeight: layout.stringWeight,
            weightAspect: layout.weightAspect,
        };
    }

    private normalizeNumber(number: number): number {
        const patternLength = NUMBER_PATTERNS.length;
        return ((number % patternLength) + patternLength) % patternLength;
    }

    private areLayoutsEqual(a: SegmentLayoutOptions, b: SegmentLayoutOptions): boolean {
        return (
            a.stringAreaTopYScale === b.stringAreaTopYScale &&
            a.stringAreaBottomYScale === b.stringAreaBottomYScale &&
            a.stringWeight === b.stringWeight &&
            a.weightAspect === b.weightAspect
        );
    }
}

type DrawMode = "none" | "all" | "sequence" | "random" | "speedSeqence" | "highSpeedSeqence";

export class bandManager implements Scene {
    private mode: DrawMode = "all";
    private bandWidthHeightScale: { width: number, height: number } = { width: 1.0, height: 1.0 };
    private topBotomCenterScaleX: { top: number, bottom: number } = { top: 1.0, bottom: 1.0 };
    private topBottomWidthScaleX: { top: number, bottom: number } = { top: 1.0, bottom: 1.0 };
    private lineCount: number = 1.0;
    private numberActiveType: DrawMode = "none";
    private numberDisplays: SevenSegmentDigit[] = [];

    update(_p: p5, beat: number, bandParamValues: number[], NumberParamValues: number[]): void {
        const zigzag = Math.abs(beat % 2 - 1.0);
        const noiseVal = GVM.leapNoise(beat, 1, 1, Easing.easeInOutQuad);
        const easeZigzag1 = Easing.easeInOutQuad(zigzag);
        const easeZigzag2 = Easing.easeInOutQuint(zigzag);

        // パラメータマッピング
        const bandWidthHeightScaleOptions = [
            { width: 0.3, height: 0.3 *  _p.width / _p.height },
            { width: 0.1, height: 1.0 },
            { width: 0.5, height: 1.0 },
            { width: 1.0, height: 0.5 },
            { width: 0.5, height: 0.5 },
            { width: 1.0, height: 1.0 },
            { width: easeZigzag1, height: 0.5 + _p.map(easeZigzag2, 0, 1, -0.05, 0.05) },
        ];
        const countOptions = [1.0, 2.0, 4.0, 8.0, 16.0, 24.0, 32.0];
        const modeOptions: DrawMode[] = ["none", "all", "sequence", "random", "speedSeqence", "highSpeedSeqence"];
        const topBottomWidthOptions = [
            { top: 1.0, bottom: 1.0 },
            { top: 0.5, bottom: 1.0 },
            { top: 0.2, bottom: 1.0 },
            { top: 0.1, bottom: 0.1 },
            { top: easeZigzag1, bottom: 1.0 },
            { top: easeZigzag1, bottom: easeZigzag2 },
            { top: easeZigzag1, bottom: Math.abs(1.0 - easeZigzag1) },
        ];
        const centerOptions = [
            { top: 0.5, bottom: 0.5 },
            { top: easeZigzag1, bottom:  easeZigzag2},
            { top: easeZigzag1, bottom: 0.5 },
            { top: 0.5, bottom: noiseVal },
        ];

        this.mode = modeOptions[bandParamValues[0]] ?? "none";
        this.lineCount = countOptions[bandParamValues[1]] ?? 1.0;
        this.bandWidthHeightScale = bandWidthHeightScaleOptions[bandParamValues[2]] ?? { width: 1.0, height: 1.0 };
        this.topBottomWidthScaleX = topBottomWidthOptions[bandParamValues[3]] ?? { top: 1.0, bottom: 1.0 };
        this.topBotomCenterScaleX = centerOptions[bandParamValues[4]] ?? { top: 0.5, bottom: 0.5 };

        this.numberActiveType = modeOptions[NumberParamValues[0]] ?? "none";
    }

    draw(_p: p5, tex: p5.Graphics, beat: number): void {
        this.ensureNumberDisplayCount(this.lineCount);

        const topLeftScaleX = this.topBotomCenterScaleX.top - this.topBottomWidthScaleX.top * 0.5;
        const topRightScaleX = this.topBotomCenterScaleX.top + this.topBottomWidthScaleX.top * 0.5;
        const bottomLeftScaleX = this.topBotomCenterScaleX.bottom - this.topBottomWidthScaleX.bottom * 0.5;
        const bottomRightScaleX = this.topBotomCenterScaleX.bottom + this.topBottomWidthScaleX.bottom * 0.5;

        for (let i = 0; i < this.lineCount; i++) {
            const segmentData = this.calculateSegmentData(
                _p, this.lineCount, i, i, i, i,
                this.bandWidthHeightScale.width, topLeftScaleX, topRightScaleX, bottomLeftScaleX, bottomRightScaleX
            );

            tex.noStroke();
            tex.fill(ColorPalette.colors[i % ColorPalette.colors.length]);

            if (this.shouldDraw(this.mode, i, beat, this.lineCount)) {
                this.drawBand(_p, tex, segmentData, 0.5 - this.bandWidthHeightScale.height * 0.5, 0.5 + this.bandWidthHeightScale.height * 0.5);
            }

            const numberDisplay = this.numberDisplays[i];
            const numberValue = Math.floor(beat / this.lineCount) + i;
            numberDisplay.setNumber(numberValue);

            if (this.shouldDraw(this.numberActiveType, i, beat, this.lineCount)) {
                tex.fill(255);

                numberDisplay.draw((segmentId, yscl1, yscl2, xscl, align) => {
                    const baseSeed = (i + 1) * 1000 + (segmentId + 1);

                    const phase = UniformRandom.rand(baseSeed, 1) * Math.PI * 2;
                    const speed = 0.6 + UniformRandom.rand(baseSeed, 2) * 1.4;
                    const freqScale = 0.8 + UniformRandom.rand(baseSeed, 3) * 1.2;

                    const amplitudeX = 220 + UniformRandom.rand(baseSeed, 4) * 380;
                    const amplitudeY = 90 + UniformRandom.rand(baseSeed, 5) * 210;

                    const xOffset = Math.sin(beat * speed + phase) * amplitudeX;
                    const yOffset = Math.sin(beat * speed * freqScale + phase * 1.3) * amplitudeY;

                    const rotationAmplitude = UniformRandom.rand(baseSeed, 6) * Math.PI * 0.6;
                    const rotationSpeed = 0.4 + UniformRandom.rand(baseSeed, 7) * 1.6;
                    const rotationPhase = UniformRandom.rand(baseSeed, 8) * Math.PI * 2;
                    const rotationAngle = Math.sin(beat * rotationSpeed + rotationPhase) * rotationAmplitude;

                    const translatedData = this.translateBox(segmentData, xOffset);
                    const normalizedYOffset = yOffset / tex.height;

                    const span = yscl2 - yscl1;
                    const halfSpan = span * 0.5;
                    const targetCenter = (yscl1 + yscl2) * 0.5 + normalizedYOffset;
                    const clampedCenter = Math.min(Math.max(targetCenter, halfSpan), 1 - halfSpan);
                    const newY1 = clampedCenter - halfSpan;
                    const newY2 = clampedCenter + halfSpan;

                    this.drawBand(_p, tex, translatedData, newY1, newY2, xscl, align, {
                        rotationAngle,
                    });
                });
            }
        }
    }

    private ensureNumberDisplayCount(count: number): void {
        while (this.numberDisplays.length < count) {
            this.numberDisplays.push(new SevenSegmentDigit());
        }
        if (this.numberDisplays.length > count) {
            this.numberDisplays.length = count;
        }
    }

    private shouldDraw(mode: DrawMode, index: number, beat: number, count: number): boolean {
        switch (mode) {
            case "all": return true;
            case "sequence": return index === Math.floor(beat % count);
            case "speedSeqence": return index === Math.floor((beat * 4) % count);
            case "highSpeedSeqence": return index === Math.floor((beat * 8) % count);
            case "random": return Math.floor(UniformRandom.rand(Math.floor(beat)) * count) === index;
            case "none": return false;
            default: return false;
        }
    }

    private translateBox(data: BoxCoordinates, xOffset: number): BoxCoordinates {
        return {
            topX1: data.topX1 + xOffset,
            topX2: data.topX2 + xOffset,
            bottomX1: data.bottomX1 + xOffset,
            bottomX2: data.bottomX2 + xOffset,
            noiseSeed: data.noiseSeed,
        };
    }

    private getTrapezoidX(p: p5, y: number, xTop: number, xBottom: number) {
        return p.map(y, 0, p.height, xTop, xBottom);
    }

    private calculateSegmentData(
        p: p5,
        count: number,
        startTopIndex: number,
        endTopIndex: number = startTopIndex,
        startBottomIndex: number = startTopIndex,
        endBottomIndex: number = startBottomIndex,
        scl: number = 1.0,
        xStartTop: number = 0.2,
        xEndTop: number = 0.8,
        xStartBottom: number = 0.1,
        xEndBottom: number = 0.9
    ) {
        const scalePerUnit = scl / count;
        const marginPerUnit = (1.0 - scl) / count;

        const segmentStartTop = (startTopIndex * scalePerUnit) + ((startTopIndex + 0.5) * marginPerUnit);
        const segmentEndTop = ((endTopIndex + 1) * scalePerUnit) + ((endTopIndex + 0.5) * marginPerUnit);

        const segmentStartBottom = (startBottomIndex * scalePerUnit) + ((startBottomIndex + 0.5) * marginPerUnit);
        const segmentEndBottom = ((endBottomIndex + 1) * scalePerUnit) + ((endBottomIndex + 0.5) * marginPerUnit);

        const topX1 = p.map(segmentStartTop, 0, 1, xStartTop, xEndTop) * p.width;
        const topX2 = p.map(segmentEndTop, 0, 1, xStartTop, xEndTop) * p.width;
        const bottomX1 = p.map(segmentStartBottom, 0, 1, xStartBottom, xEndBottom) * p.width;
        const bottomX2 = p.map(segmentEndBottom, 0, 1, xStartBottom, xEndBottom) * p.width;

        const noiseSeed = ((startTopIndex + endTopIndex + startBottomIndex + endBottomIndex) / 2) * 0.1;

        return { topX1, topX2, bottomX1, bottomX2, noiseSeed };
    }

    private drawBand(
        p: p5,
        tex: p5.Graphics,
        data: BoxCoordinates,
        yscl1: number = 0,
        yscl2: number = 1,
        xscl: number = 1,
        alignX: "CENTER" | "LEFT" | "RIGHT" = "CENTER",
        options?: { rotationAngle?: number; rotationCenter?: { x: number; y: number } }
    ) {
        const y1 = yscl1 * tex.height;
        const y2 = yscl2 * tex.height;

        const topX3 = this.getTrapezoidX(p, y1, data.topX1, data.bottomX1);
        const topX4 = this.getTrapezoidX(p, y1, data.topX2, data.bottomX2);
        const bottomX3 = this.getTrapezoidX(p, y2, data.topX1, data.bottomX1);
        const bottomX4 = this.getTrapezoidX(p, y2, data.topX2, data.bottomX2);

        const topWidth = topX4 - topX3;
        const bottomWidth = bottomX4 - bottomX3;

        let currentTopX1 = topX3;
        let currentTopX2 = topX4;
        let currentBottomX1 = bottomX3;
        let currentBottomX2 = bottomX4;

        if (alignX === "CENTER") {
            currentTopX1 = topX3 + topWidth * 0.5 * (1 - xscl);
            currentTopX2 = topX4 - topWidth * 0.5 * (1 - xscl);
            currentBottomX1 = bottomX3 + bottomWidth * 0.5 * (1 - xscl);
            currentBottomX2 = bottomX4 - bottomWidth * 0.5 * (1 - xscl);
        } else if (alignX === "LEFT") {
            currentTopX2 = topX3 + topWidth * xscl;
            currentBottomX2 = bottomX3 + bottomWidth * xscl;
        } else if (alignX === "RIGHT") {
            currentTopX1 = topX4 - topWidth * xscl;
            currentBottomX1 = bottomX4 - bottomWidth * xscl;
        }

        let vertices = [
            { x: currentTopX1, y: y1 },
            { x: currentTopX2, y: y1 },
            { x: currentBottomX2, y: y2 },
            { x: currentBottomX1, y: y2 },
        ];

        const rotationAngle = options?.rotationAngle ?? 0;
        if (Math.abs(rotationAngle) > 1e-6) {
            const center = options?.rotationCenter ?? this.computePolygonCenter(vertices);
            const sinTheta = Math.sin(rotationAngle);
            const cosTheta = Math.cos(rotationAngle);
            vertices = vertices.map((vertex) => this.rotateVertex(vertex, center, sinTheta, cosTheta));
        }

        tex.beginShape();
        for (const vertex of vertices) {
            tex.vertex(vertex.x, vertex.y);
        }
        tex.endShape(tex.CLOSE);
    }

    private computePolygonCenter(points: { x: number; y: number }[]): { x: number; y: number } {
        const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
        return { x: sum.x / points.length, y: sum.y / points.length };
    }

    private rotateVertex(
        vertex: { x: number; y: number },
        center: { x: number; y: number },
        sinTheta: number,
        cosTheta: number
    ): { x: number; y: number } {
        const translatedX = vertex.x - center.x;
        const translatedY = vertex.y - center.y;
        const rotatedX = translatedX * cosTheta - translatedY * sinTheta;
        const rotatedY = translatedX * sinTheta + translatedY * cosTheta;
        return { x: rotatedX + center.x, y: rotatedY + center.y };
    }
}