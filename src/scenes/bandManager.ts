import p5 from "p5";
import type { Scene } from "./Scene";
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

export class bandManager implements Scene {
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

    update(p: p5, beat: number, bandParams: number[], numberParams: number[], colorPalette: string[]): void {
        const resolved = this.resolveParameters(p, beat, bandParams, numberParams, colorPalette);
        this.applyBandParameters(resolved.band);
        this.applyNumberParameters(resolved.number);
        this.colorPalette = resolved.colorPalette;
    }

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

    private applyBandParameters(band: BandParameterSet): void {
        this.mode = band.mode;
        this.lineCount = band.lineCount;
        this.bandWidthHeightScale = band.bandWidthHeightScale;
        this.topBottomWidthScaleX = band.topBottomWidthScaleX;
        this.topBotomCenterScaleX = band.topBotomCenterScaleX;
        this.numberDisplayController = null;
    }

    private applyNumberParameters(number: NumberParameterSet): void {
        this.numberActiveType = number.numberActiveType;
        this.numberValueType = number.numberValueType;
        this.numberMoveType = number.numberMoveType;
        this.numberArrangeType = number.numberArrangeType;
        this.numberMovingType = number.numberMovingType;
        this.numberRotateType = number.numberRotateType;
        this.numberDisplayController = null;
    }

    private ensureNumberDisplayController(): NumberDisplayController {
        this.numberDisplayController ??= this.createNumberDisplayController();
        return this.numberDisplayController;
    }

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