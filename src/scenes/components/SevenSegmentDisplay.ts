import type { AlignX } from "../../utils/bandGeometry.ts";

export type SegmentLayoutOptions = {
    stringAreaTopYScale: number;
    stringAreaBottomYScale: number;
    stringWeight: number;
    weightAspect: number;
};

export type DrawSegmentCallback = (
    segmentId: number,
    yscl1: number,
    yscl2: number,
    xscl: number,
    align: AlignX
) => void;

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

export class SevenSegmentDigit {
    private segments: DigitSegment[] = [];
    private currentNumber: number | null = null;
    private layout: SegmentLayoutOptions = {
        stringAreaTopYScale: 0.3,
        stringAreaBottomYScale: 0.7,
        stringWeight: 0.15,
        weightAspect: 2,
    };

    setNumber(
        number: number,
        options?: Partial<SegmentLayoutOptions>,
        control?: { forceRebuild?: boolean; resetTransforms?: boolean }
    ): void {
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
