import p5 from "p5";
import { ColorPalette } from "../utils/colorPalette";
import { UniformRandom } from "../utils/uniformRandom";
import { GVM } from "../utils/gvm";
import { Easing } from "../utils/easing";
import { SevenSegmentDigit } from "./components/SevenSegmentDisplay";
import {
    NumberDisplayController,
    type NumberArrangeType,
    type NumberMoveType,
    type NumberMovingType,
    type NumberRotateType,
    type NumberValueType,
} from "./components/NumberDisplayController";
import {
    calculateSegmentBox,
    translateBox,
    drawTrapezoidBand,
    resolveTrapezoidVertices,
    computePolygonCenter,
    type BoxCoordinates,
} from "../utils/bandGeometry";

type DrawMode = "none" | "all" | "sequence" | "random" | "speedSeqence" | "highSpeedSeqence";
// type numberValueType = "one" | "two" | "date" | "time" |"sequence" | "random" | "beat";

type BandParameterSet = {
    mode: DrawMode;
    lineCount: number;
    bandWidthHeightScale: { width: number; height: number };
    topBottomWidthScaleX: { top: number; bottom: number };
    topBotomCenterScaleX: { top: number; bottom: number };
};

type NumberParameterSet = {
    numberActiveType: DrawMode;
    numberValueType: NumberValueType;
    numberMoveType: NumberMoveType;
    numberArrangeType: NumberArrangeType;
    numberMovingType: NumberMovingType;
    numberRotateType: NumberRotateType;
};

type ResolvedParameters = {
    band: BandParameterSet;
    number: NumberParameterSet;
    colorPalette: string[];
};

export class BandManager {
    /**
     * シーンごとの最大オプション数（TexManager/MIDI連携用）を定義します。
     * 各シーン（0-7）に対して、8つのパラメータスロットがそれぞれいくつの選択肢を持つかを配列で返します。
     * 例えば、シーン0の最初のパラメータは6つの選択肢を持ち、2番目は5つの選択肢を持つ、といった具合です。
     * この情報はMIDIコントローラー（APCMiniMK2Manager）が、
     * グリッドパッドの選択範囲を制限したり、LED表示を制御したりするために使用されます。
     *
     * @returns シーンIDをキーとし、最大オプション数の配列を値とするオブジェクト。
     */
    public static getParameterSchema(): { [sceneId: number]: number[] } {
        return {
            0: [6, 5, 7, 7, 4, 0, 0, 0],
            1: [6, 7, 4, 7, 4, 4, 0, 0],
            2: [2, 2, 2, 2, 2, 2, 2, 2],
            3: [0, 0, 0, 0, 0, 0, 0, 0],
            4: [0, 0, 0, 0, 0, 0, 0, 0],
            5: [0, 0, 0, 0, 0, 0, 0, 0],
            6: [3, 5, 0, 0, 0, 0, 0, 0],
            7: [2, 0, 0, 0, 0, 0, 0, 0],
        };
    }
    private mode: DrawMode = "all";
    private bandWidthHeightScale: { width: number, height: number } = { width: 1.0, height: 1.0 };
    private topBotomCenterScaleX: { top: number, bottom: number } = { top: 1.0, bottom: 1.0 };
    private topBottomWidthScaleX: { top: number, bottom: number } = { top: 1.0, bottom: 1.0 };
    private lineCount: number = 1.0;

    private numberActiveType: DrawMode = "none";
    private numberDisplays: SevenSegmentDigit[] = [];
    private numberValueType: NumberValueType = "one";
    private numberMoveType: NumberMoveType = "none";
    private numberArrangeType: NumberArrangeType = "simple";
    private numberMovingType: NumberMovingType = "none";
    private numberRotateType: NumberRotateType = "none";

    private colorPalette: string[] = ColorPalette.colors;
    private numberDisplayController: NumberDisplayController | null = null;

    /**
     * シーンの状態を更新します。
     * MIDIコントローラーから受け取った生のパラメータインデックス（bandParams, numberParams）を
     * 実際の描画パラメータ（座標スケール、モード、数値タイプなど）に変換（resolve）します。
     * また、BPMに基づいたイージング計算や、カラーパレットの更新もここで行います。
     *
     * @param p p5.jsのインスタンス。
     * @param beat 現在のビート数。
     * @param bandParams バンドエフェクト用のパラメータインデックス配列。
     * @param numberParams 数値表示エフェクト用のパラメータインデックス配列。
     * @param colorPalette 現在のカラーパレット。
     */
    update(p: p5, beat: number, bandParams: number[], numberParams: number[], colorPalette: string[]): void {
        const resolved = this.resolveParameters(p, beat, bandParams, numberParams, colorPalette);
        this.applyBandParameters(resolved.band);
        this.applyNumberParameters(resolved.number);
        this.colorPalette = resolved.colorPalette;
    }

    /**
     * シーンを描画します。
     * 設定されたパラメータ（lineCountなど）に基づいて、複数のライン（バンドと数値）を描画します。
     * 各ラインについて、台形の座標計算（createSegmentBoxForLine）を行い、
     * その座標に基づいて背景のバンド（drawBandForLine）と前面の数値（drawNumberDisplay）を描画します。
     *
     * @param p p5.jsのインスタンス。
     * @param tex 描画対象のGraphicsオブジェクト。
     * @param beat 現在のビート数。
     */
    draw(p: p5, tex: p5.Graphics, beat: number): void {
        this.ensureNumberDisplayCount(this.lineCount);
        const displayController = this.ensureNumberDisplayController();

        const topLeftScaleX = this.topBotomCenterScaleX.top - this.topBottomWidthScaleX.top * 0.5;
        const topRightScaleX = this.topBotomCenterScaleX.top + this.topBottomWidthScaleX.top * 0.5;
        const bottomLeftScaleX = this.topBotomCenterScaleX.bottom - this.topBottomWidthScaleX.bottom * 0.5;
        const bottomRightScaleX = this.topBotomCenterScaleX.bottom + this.topBottomWidthScaleX.bottom * 0.5;

        for (let i = 0; i < this.lineCount; i++) {
            const baseBox = this.createSegmentBoxForLine(
                p,
                i,
                topLeftScaleX,
                topRightScaleX,
                bottomLeftScaleX,
                bottomRightScaleX,
            );

            this.drawBandForLine(p, tex, baseBox, i, beat);
            this.drawNumberDisplay(p, tex, baseBox, i, beat, displayController);
        }
    }

    /**
     * 数値表示用オブジェクト（SevenSegmentDigit）の配列サイズを調整します。
     * 必要な数（count）より少ない場合は新しく生成して追加し、
     * 多い場合は切り詰めます。
     * これにより、ライン数が動的に変化しても適切な数のディスプレイオブジェクトが維持されます。
     *
     * @param count 必要な数値表示オブジェクトの数。
     */
    private ensureNumberDisplayCount(count: number): void {
        while (this.numberDisplays.length < count) {
            this.numberDisplays.push(new SevenSegmentDigit());
        }
        if (this.numberDisplays.length > count) {
            this.numberDisplays.length = count;
        }
    }

    /**
     * 現在の描画モード（mode）とビートに基づいて、特定のインデックスを描画すべきかどうかを判定します。
     * - all: 常に描画。
     * - sequence: ビートに合わせて順番に1つずつ描画。
     * - speedSeqence: sequenceの4倍速。
     * - highSpeedSeqence: sequenceの8倍速。
     * - random: ビートごとにランダムに1つ選んで描画。
     * - none: 描画しない。
     *
     * @param mode 描画モード。
     * @param index 判定対象のラインインデックス。
     * @param beat 現在のビート数。
     * @param count ラインの総数。
     * @returns 描画すべきであれば true。
     */
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

    /**
     * 指定されたラインインデックスに対応する台形（セグメントボックス）の座標を計算します。
     * 画面全体を分割し、指定されたスケール（topLeftScaleXなど）に基づいて
     * 各ラインの四隅の座標（topX1, topX2, bottomX1, bottomX2）を決定します。
     *
     * @param p p5.jsのインスタンス。
     * @param lineIndex ラインのインデックス。
     * @param topLeftScaleX 上辺左側のX座標スケール。
     * @param topRightScaleX 上辺右側のX座標スケール。
     * @param bottomLeftScaleX 下辺左側のX座標スケール。
     * @param bottomRightScaleX 下辺右側のX座標スケール。
     * @returns 計算されたボックス座標（BoxCoordinates）。
     */
    private createSegmentBoxForLine(
        p: p5,
        lineIndex: number,
        topLeftScaleX: number,
        topRightScaleX: number,
        bottomLeftScaleX: number,
        bottomRightScaleX: number,
    ): BoxCoordinates {
        return calculateSegmentBox({
            p,
            count: this.lineCount,
            startTopIndex: lineIndex,
            endTopIndex: lineIndex,
            startBottomIndex: lineIndex,
            endBottomIndex: lineIndex,
            scale: this.bandWidthHeightScale.width,
            xStartTop: topLeftScaleX,
            xEndTop: topRightScaleX,
            xStartBottom: bottomLeftScaleX,
            xEndBottom: bottomRightScaleX,
        });
    }

    /**
     * 指定されたラインの背景バンド（台形）を描画します。
     * カラーパレットから色を選択し、`drawTrapezoidBand` を使用して描画します。
     * `shouldDraw` による表示判定もここで行われます。
     *
     * @param p p5.jsのインスタンス。
     * @param tex 描画対象のGraphicsオブジェクト。
     * @param baseBox 描画する台形の基本座標。
     * @param lineIndex ラインのインデックス。
     * @param beat 現在のビート数。
     */
    private drawBandForLine(p: p5, tex: p5.Graphics, baseBox: BoxCoordinates, lineIndex: number, beat: number): void {
        tex.noStroke();
        tex.fill(this.colorPalette[lineIndex % this.colorPalette.length]);

        if (!this.shouldDraw(this.mode, lineIndex, beat, this.lineCount)) {
            return;
        }

        drawTrapezoidBand({
            p,
            tex,
            box: baseBox,
            yscl1: 0.5 - this.bandWidthHeightScale.height * 0.5,
            yscl2: 0.5 + this.bandWidthHeightScale.height * 0.5,
        });
    }

    /**
     * 指定されたラインに数値（7セグメントディスプレイ風）を描画します。
     * `NumberDisplayController` を使用して表示すべき数値やアニメーションパラメータを決定し、
     * `SevenSegmentDigit` クラスを用いて実際の描画を行います。
     * 各セグメント（棒）ごとに座標変換（移動、回転、変形）を行い、
     * 複雑なモーショングラフィックスを実現しています。
     *
     * @param p p5.jsのインスタンス。
     * @param tex 描画対象のGraphicsオブジェクト。
     * @param baseBox 描画基準となる台形の座標。
     * @param lineIndex ラインのインデックス。
     * @param beat 現在のビート数。
     * @param displayController 数値表示の制御ロジックを持つコントローラー。
     */
    private drawNumberDisplay(
        p: p5,
        tex: p5.Graphics,
        baseBox: BoxCoordinates,
        lineIndex: number,
        beat: number,
        displayController: NumberDisplayController,
    ): void {
        const numberDisplay = this.numberDisplays[lineIndex];
        numberDisplay.setNumber(displayController.resolveNumberValue(lineIndex, beat));

        if (!this.shouldDraw(this.numberActiveType, lineIndex, beat, this.lineCount)) {
            return;
        }

        tex.fill(255);

        numberDisplay.draw((segmentId, yscl1, yscl2, xscl, align) => {
            const segmentCount = numberDisplay.getSegmentCount();
            const baseSeed = (lineIndex + 1) * 1000 + (segmentId + 1);

            const vertices = resolveTrapezoidVertices({
                p,
                box: baseBox,
                texHeight: tex.height,
                yscl1,
                yscl2,
                xscl,
                align,
            });
            const segmentCenter = computePolygonCenter(vertices);
            const targetPositionCenter = displayController.resolveTargetPositionCenter(
                p,
                segmentCenter,
                segmentId,
                segmentCount,
                baseSeed,
                beat,
            );

            const moving = displayController.resolveMovingScale(p, beat);
            const xOffset = (targetPositionCenter.x - segmentCenter.x) * moving;
            const yOffset = (targetPositionCenter.y - segmentCenter.y) * moving;

            const yMoveOffset = displayController.resolveNumberMoveOffset(p, beat, lineIndex);
            const rotationAngle = displayController.resolveRotationAngle(p, beat, segmentId);
            const translatedBox = translateBox(baseBox, xOffset);
            const normalizedYOffset = (yOffset + yMoveOffset) / tex.height;

            const span = yscl2 - yscl1;
            const halfSpan = span * 0.5;
            const targetCenter = (yscl1 + yscl2) * 0.5 + normalizedYOffset;
            const newY1 = targetCenter - halfSpan;
            const newY2 = targetCenter + halfSpan;

            drawTrapezoidBand({
                p,
                tex,
                box: translatedBox,
                yscl1: newY1,
                yscl2: newY2,
                xscl,
                align,
                rotationAngle,
            });
        });
    }

    /**
     * MIDIパラメータインデックスを、実際の描画パラメータオブジェクトに解決（変換）します。
     * インデックスに基づいて、事前に定義されたオプション配列（width/height, count, modeなど）から
     * 具体的な値を選択します。
     * また、イージング関数やノイズ関数を使用して、動的に変化するパラメータ（zigzag, noiseVal）も計算し、
     * オプションの選択ロジックに組み込んでいます。
     *
     * @param p p5.jsのインスタンス。
     * @param beat 現在のビート数。
     * @param bandParams バンドパラメータのインデックス配列。
     * @param numberParams 数値パラメータのインデックス配列。
     * @param colorPalette カラーパレット。
     * @returns 解決されたパラメータセット（ResolvedParameters）。
     */
    private resolveParameters(
        p: p5,
        beat: number,
        bandParams: number[],
        numberParams: number[],
        colorPalette: string[],
    ): ResolvedParameters {
        const zigzag = Math.abs(beat % 2 - 1.0);
        const noiseVal = GVM.leapNoise(beat, 1, 1, Easing.easeInOutQuad);
        const easeZigzag1 = Easing.easeInOutQuad(zigzag);
        const easeZigzag2 = Easing.easeInOutQuint(zigzag);

        const bandWidthHeightScaleOptions = [
            { width: 0.3, height: 0.3 * p.width / p.height },
            { width: 0.1, height: 1.0 },
            { width: 0.5, height: 1.0 },
            { width: 1.0, height: 0.5 },
            { width: 0.5, height: 0.5 },
            { width: 1.0, height: 1.0 },
            { width: easeZigzag1, height: 0.5 + p.map(easeZigzag2, 0, 1, -0.05, 0.05) },
        ];
        const countOptions = [1.0, 2.0, 4.0, 8.0, 16.0];
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
            { top: easeZigzag1, bottom: easeZigzag2 },
            { top: easeZigzag1, bottom: 0.5 },
            { top: 0.5, bottom: noiseVal },
        ];
        const numberValueTypeOptions: NumberValueType[] = ["one", "two", "date", "time", "sequence", "random", "beat"];
        const numberMoveTypeOptions: NumberMoveType[] = ["none", "down", "wave", "sequence"];
        const numberArrangeTypeOptions: NumberArrangeType[] = ["simple", "center", "horizontal", "vertical", "grid", "circle", "random"];
        const numberMovingTypeOptions: NumberMovingType[] = ["none", "zigzag", "ramp", "period"];
        const numberRotateTypeOptions: NumberRotateType[] = ["none", "lap", "shake", "period"];

        const bandParameters: BandParameterSet = {
            mode: modeOptions[bandParams[0]] ?? "none",
            lineCount: countOptions[bandParams[1]] ?? 1.0,
            bandWidthHeightScale: bandWidthHeightScaleOptions[bandParams[2]] ?? { width: 1.0, height: 1.0 },
            topBottomWidthScaleX: topBottomWidthOptions[bandParams[3]] ?? { top: 1.0, bottom: 1.0 },
            topBotomCenterScaleX: centerOptions[bandParams[4]] ?? { top: 0.5, bottom: 0.5 },
        };

        const numberParameters: NumberParameterSet = {
            numberActiveType: modeOptions[numberParams[0]] ?? "none",
            numberValueType: numberValueTypeOptions[numberParams[1]] ?? "one",
            numberMoveType: numberMoveTypeOptions[numberParams[2]] ?? "none",
            numberArrangeType: numberArrangeTypeOptions[numberParams[3]] ?? "simple",
            numberMovingType: numberMovingTypeOptions[numberParams[4]] ?? "none",
            numberRotateType: numberRotateTypeOptions[numberParams[5]] ?? "none",
        };

        return {
            band: bandParameters,
            number: numberParameters,
            colorPalette,
        };
    }

    /**
     * 解決されたバンドパラメータをクラスのメンバ変数に適用します。
     * パラメータが変更された場合、数値表示コントローラー（numberDisplayController）をリセットし、
     * 次回の描画時に再生成されるようにします。
     *
     * @param band バンドパラメータセット。
     */
    private applyBandParameters(band: BandParameterSet): void {
        this.mode = band.mode;
        this.lineCount = band.lineCount;
        this.bandWidthHeightScale = band.bandWidthHeightScale;
        this.topBottomWidthScaleX = band.topBottomWidthScaleX;
        this.topBotomCenterScaleX = band.topBotomCenterScaleX;
        this.numberDisplayController = null;
    }

    /**
     * 解決された数値パラメータをクラスのメンバ変数に適用します。
     * パラメータが変更された場合、数値表示コントローラーをリセットします。
     *
     * @param number 数値パラメータセット。
     */
    private applyNumberParameters(number: NumberParameterSet): void {
        this.numberActiveType = number.numberActiveType;
        this.numberValueType = number.numberValueType;
        this.numberMoveType = number.numberMoveType;
        this.numberArrangeType = number.numberArrangeType;
        this.numberMovingType = number.numberMovingType;
        this.numberRotateType = number.numberRotateType;
        this.numberDisplayController = null;
    }

    /**
     * 数値表示コントローラーのインスタンスを取得します。
     * 存在しない場合は新規作成し、存在する場合は既存のものを返します（遅延初期化）。
     * パラメータ変更時にnullにリセットされるため、常に最新のパラメータに基づいたコントローラーが使用されます。
     *
     * @returns NumberDisplayControllerインスタンス。
     */
    private ensureNumberDisplayController(): NumberDisplayController {
        this.numberDisplayController ??= this.createNumberDisplayController();
        return this.numberDisplayController;
    }

    /**
     * 現在のパラメータ設定に基づいて、新しいNumberDisplayControllerインスタンスを作成します。
     *
     * @returns 新しいNumberDisplayControllerインスタンス。
     */
    private createNumberDisplayController(): NumberDisplayController {
        return new NumberDisplayController({
            valueType: this.numberValueType,
            moveType: this.numberMoveType,
            arrangeType: this.numberArrangeType,
            movingType: this.numberMovingType,
            rotateType: this.numberRotateType,
            lineCount: this.lineCount,
        });
    }
}