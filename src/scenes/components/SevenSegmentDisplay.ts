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

    /**
     * 表示する数値を設定します。
     * 指定された数値（0-9）に基づいて、必要なセグメント（棒）の構成を再構築します。
     * レイアウトオプションが指定された場合は、それらも適用して形状を更新します。
     * 数値やレイアウトに変更がない場合は、再構築をスキップしてパフォーマンスを最適化します。
     *
     * @param number 表示したい数値（0-9）。範囲外の値は正規化されます。
     * @param options レイアウトオプション（太さや高さなど）のオーバーライド。
     * @param control 再構築や変形リセットを強制するための制御フラグ。
     */
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

    /**
     * 現在の数値に対応するすべてのセグメントを描画します。
     * 実際の描画処理はコールバック関数（drawSegment）に委譲されます。
     * これにより、描画ロジック（p5.jsへの依存など）をこのクラスから分離し、
     * 柔軟な描画実装（例えば、台形描画やエフェクト適用など）を可能にしています。
     *
     * @param drawSegment セグメントごとの描画を行うコールバック関数。
     */
    draw(drawSegment: DrawSegmentCallback): void {
        for (const segment of this.segments) {
            segment.draw(drawSegment);
        }
    }

    /**
     * すべてのセグメントの変形状態を初期状態（ベース状態）にリセットします。
     * アニメーションなどで一時的に変形された状態を元に戻すために使用されます。
     */
    resetSegments(): void {
        for (const segment of this.segments) {
            segment.resetTransform();
        }
    }

    /**
     * 指定された数値とレイアウトに基づいて、セグメントオブジェクトの配列を生成します。
     * 0-9の各数値に対応する点灯パターン（NUMBER_PATTERNS）を参照し、
     * 点灯すべきセグメントのみを作成します。
     * 各セグメントの座標や形状は、SEGMENT_BUILDERSを使用して計算されます。
     *
     * @param number 表示する数値。
     * @param layout レイアウト設定。
     * @returns 生成されたDigitSegmentの配列。
     */
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

    /**
     * レイアウトオプションから、セグメント生成に必要なコンテキスト情報（座標基準点など）を計算します。
     * 上端、下端、中間点のY座標や、セグメントの太さなどを算出します。
     *
     * @param layout レイアウトオプション。
     * @returns 計算されたSegmentContext。
     */
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

    /**
     * 入力された数値を0-9の範囲に正規化します。
     * 負の値や10以上の値が入力された場合でも、循環するように計算します。
     *
     * @param number 入力数値。
     * @returns 0-9の整数。
     */
    private normalizeNumber(number: number): number {
        const patternLength = NUMBER_PATTERNS.length;
        return ((number % patternLength) + patternLength) % patternLength;
    }

    /**
     * 2つのレイアウトオプションが等しいかどうかを判定します。
     * オブジェクトの各プロパティを比較し、すべて一致する場合にtrueを返します。
     * 不要な再構築を防ぐために使用されます。
     *
     * @param a 比較対象のレイアウトA。
     * @param b 比較対象のレイアウトB。
     * @returns 等しければtrue。
     */
    private areLayoutsEqual(a: SegmentLayoutOptions, b: SegmentLayoutOptions): boolean {
        return (
            a.stringAreaTopYScale === b.stringAreaTopYScale &&
            a.stringAreaBottomYScale === b.stringAreaBottomYScale &&
            a.stringWeight === b.stringWeight &&
            a.weightAspect === b.weightAspect
        );
    }

    /**
     * 現在アクティブなセグメントの数を取得します。
     * 例えば、数字の「1」なら2本、「8」なら7本となります。
     * アニメーションのエフェクト計算などで使用されます。
     *
     * @returns アクティブなセグメント数。
     */
    public getSegmentCount(): number {
        return this.segments.length;
    }
}
