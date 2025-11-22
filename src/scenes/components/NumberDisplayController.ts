import p5 from "p5";
import { UniformRandom } from "../../utils/uniformRandom";
import { Easing } from "../../utils/easing";
import { GVM } from "../../utils/gvm";
import { DateText } from "../../utils/dateText";

export type NumberValueType = "one" | "two" | "date" | "time" | "sequence" | "random" | "beat";
export type NumberMoveType = "none" | "down" | "wave" | "sequence";
export type NumberArrangeType = "simple" | "center" | "horizontal" | "vertical" | "grid" | "circle" | "random";
export type NumberMovingType = "none" | "zigzag" | "ramp" | "period";
export type NumberRotateType = "none" | "lap" | "shake" | "period";

export type NumberDisplaySettings = {
    valueType: NumberValueType;
    moveType: NumberMoveType;
    arrangeType: NumberArrangeType;
    movingType: NumberMovingType;
    rotateType: NumberRotateType;
    lineCount: number;
};

export type Point = { x: number; y: number };

export class NumberDisplayController {
    private readonly settings: NumberDisplaySettings;

    constructor(settings: NumberDisplaySettings) {
        this.settings = settings;
    }

    /**
     * 指定された行インデックスとビートに基づいて、表示すべき数値を決定します。
     * 設定された `valueType` に応じて、固定値、時間経過、ランダム、ビート同期などの
     * 異なるロジックで数値を算出します。
     *
     * @param lineIndex 行のインデックス（複数の数値が表示される場合の位置識別子）。
     * @param beat 現在のビート数（音楽的なタイミング）。
     * @returns 表示すべき数値（0-9）。
     */
    resolveNumberValue(lineIndex: number, beat: number): number {
        switch (this.settings.valueType) {
            case "one":
                // 単純にビートの整数部分を10で割った余りを表示（0-9のカウントアップ）
                return Math.floor(beat) % 10;
            case "two": {
                // 偶数行と奇数行で異なる数値を表示（5ずらす）
                const base = Math.floor(beat) % 10;
                const shifted = (Math.floor(beat) + 5) % 10;
                return lineIndex % 2 === 0 ? base : shifted;
            }
            case "date":
                // 現在の日付（YYYYMMDD）から対応する桁の数字を取得
                return this.digitFromText(DateText.getYYYYMMDD(), lineIndex);
            case "time":
                // 現在の時刻（HHMMSS）から対応する桁の数字を取得
                return this.digitFromText(DateText.getHHMMSS(), lineIndex);
            case "sequence":
                // 行インデックスとビートを組み合わせて、波打つような数列を生成
                return (lineIndex + Math.floor(beat)) % 10;
            case "random":
                // ビートと行インデックスをシードとして、決定論的なランダム値を生成
                return Math.floor(UniformRandom.rand(Math.floor(beat), lineIndex) * 10);
            case "beat":
                // ビート数を8桁の文字列として扱い、対応する桁を表示
                return this.digitFromText(Math.floor(beat).toString().padStart(8, "0"), lineIndex);
            default:
                return 0;
        }
    }

    /**
     * セグメントのターゲット位置（中心座標）を計算します。
     * `arrangeType` 設定に基づいて、グリッド配置、円形配置、ランダム配置など、
     * 様々なレイアウトパターンを提供します。
     *
     * @param p p5.jsのインスタンス。
     * @param segmentCenter デフォルトの中心座標。
     * @param segmentId セグメントの識別子（通し番号）。
     * @param segmentCount 全セグメント数。
     * @param baseSeed ランダム配置用のベースシード値。
     * @param beat 現在のビート数（アニメーション用）。
     * @returns 計算されたターゲット座標（Point）。
     */
    resolveTargetPositionCenter(
        p: p5,
        segmentCenter: Point,
        segmentId: number,
        segmentCount: number,
        baseSeed: number,
        beat: number,
    ): Point {
        const safeSegmentCount = Math.max(segmentCount, 1);

        switch (this.settings.arrangeType) {
            case "center":
                // 画面中央に配置
                return { x: p.width * 0.5, y: p.height * 0.5 };
            case "horizontal":
                // 水平方向に等間隔で配置
                return {
                    x: p.width * (segmentId + 1) / (safeSegmentCount + 1),
                    y: p.height * 0.5,
                };
            case "vertical":
                // 垂直方向に等間隔で配置
                return {
                    x: p.width * 0.5,
                    y: p.height * (segmentId + 1) / (safeSegmentCount + 1),
                };
            case "grid": {
                // グリッド状（格子状）に配置
                const gridSize = Math.ceil(Math.sqrt(safeSegmentCount));
                const column = segmentId % gridSize;
                const row = Math.floor(segmentId / gridSize);
                return {
                    x: p.width * (column + 1) / (gridSize + 1),
                    y: p.height * (row + 1) / (gridSize + 1),
                };
            }
            case "circle": {
                // 円周上に配置し、ビートに合わせて回転させる
                const angle = (segmentId / safeSegmentCount) * Math.PI * 2 + beat * 0.5;
                return {
                    x: p.width * 0.5 + Math.cos(angle) * (p.width * 0.25),
                    y: p.height * 0.5 + Math.sin(angle) * (p.height * 0.25),
                };
            }
            case "random":
                // 画面内のランダムな位置に配置（ビートごとに位置が変わる）
                return {
                    x: UniformRandom.rand(baseSeed, 1, Math.floor(beat * 0.5)) * p.width,
                    y: UniformRandom.rand(baseSeed, 2, Math.floor(beat * 0.5)) * p.height,
                };
            case "simple":
            default:
                // デフォルト位置（変更なし）
                return segmentCenter;
        }
    }

    /**
     * アニメーションの移動スケール（動きの大きさや進行度）を計算します。
     * `movingType` に応じて、ジグザグ、ランプ（鋸波）、周期的などの動きを生成します。
     *
     * @param p p5.jsのインスタンス。
     * @param beat 現在のビート数。
     * @returns スケール値（通常は0.0〜1.0、またはそれに準ずる値）。
     */
    resolveMovingScale(p: p5, beat: number): number {
        switch (this.settings.movingType) {
            case "zigzag":
                // 0 -> 1 -> 0 を繰り返すジグザグ波形
                return Math.abs((beat % 2.0) - 1.0);
            case "ramp":
                // 0 -> 1 へイージングしながら変化し、リセットされる鋸波形
                return Easing.easeInOutQuad(p.fract(beat));
            case "period":
                // 周期的なノイズのような動き
                return GVM.leapRamp(beat, 4, 1, Easing.easeInOutQuad);
            case "none":
            default:
                return 1.0;
        }
    }

    /**
     * 数値全体の移動オフセット（Y軸方向のずれなど）を計算します。
     * `moveType` に応じて、落下、波打ち、シーケンス的な移動などを生成します。
     *
     * @param p p5.jsのインスタンス。
     * @param beat 現在のビート数。
     * @param lineIndex 行インデックス。
     * @returns Y軸方向のオフセット値。
     */
    resolveNumberMoveOffset(p: p5, beat: number, lineIndex: number): number {
        switch (this.settings.moveType) {
            case "down":
                // 上から下へ落下するような動き
                return ((Easing.easeOutQuad((p.fract(beat)) % 1.0) + 0.5) % 1 - 0.5) * (p.height * 1.25);
            case "wave":
                // サイン波による波打ち動作
                return Math.sin((beat + lineIndex) * Math.PI * 0.5) * 50;
            case "sequence":
                // 行ごとに順番に上下するシーケンス動作
                return (Math.floor(beat / this.settings.lineCount) % 2 === 0 ? -1 : 1) *
                    (Math.floor(beat) % this.settings.lineCount === lineIndex ? (beat % 1.0) : 0) *
                    (p.height * 1.25);
            case "none":
            default:
                return 0;
        }
    }

    /**
     * セグメントまたは数値全体の回転角度を計算します。
     * `rotateType` に応じて、回転、振動、周期的変化などを生成します。
     *
     * @param p p5.jsのインスタンス。
     * @param beat 現在のビート数。
     * @param segmentId セグメントID（個別の回転用）。
     * @returns 回転角度（ラジアン）。
     */
    resolveRotationAngle(p: p5, beat: number, segmentId: number): number {
        switch (this.settings.rotateType) {
            case "lap":
                // 4ビートで1回転するような動き
                return Easing.easeInOutSine(p.fract(beat / 4)) * Math.PI * 2;
            case "shake":
                // 小刻みに震える動き
                return Easing.zigzag(beat) * Math.PI / 10;
            case "period":
                // ノイズ的に不規則に回転する動き
                return GVM.leapNoise(beat, 4, 1, Easing.easeInOutSine, segmentId) * Math.PI * 2;
            case "none":
            default:
                return 0;
        }
    }

    /**
     * 文字列から指定されたインデックスの数字を取り出します。
     * 文字列の長さを超えるインデックスが指定された場合は、循環して文字を取得します。
     * 数字以外の文字が含まれている場合は0を返します。
     *
     * @param text 数字を含む文字列（日付や時刻など）。
     * @param index 取得したい文字のインデックス。
     * @returns 抽出された数値（0-9）。
     */
    private digitFromText(text: string, index: number): number {
        if (text.length === 0) {
            return 0;
        }
        const normalizedIndex = index % text.length;
        const safeIndex = normalizedIndex < 0 ? normalizedIndex + text.length : normalizedIndex;
        const char = text[safeIndex];
        const digit = Number.parseInt(char, 10);
        return Number.isNaN(digit) ? 0 : digit;
    }
}
