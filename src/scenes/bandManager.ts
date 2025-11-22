import p5 from "p5";
import type { Scene } from "./Scene";
import { ColorPalette } from "../utils/colorPalette";
import { UniformRandom } from "../utils/uniformRandom";
import { GVM } from "../utils/gvm";
import { Easing } from "../utils/easing";
import { DateText } from "../utils/dateText";
import { SevenSegmentDigit } from "./components/SevenSegmentDisplay";
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

type Point = { x: number; y: number };

type BandParameterSet = {
    mode: DrawMode;
    lineCount: number;
    bandWidthHeightScale: { width: number; height: number };
    topBottomWidthScaleX: { top: number; bottom: number };
    topBotomCenterScaleX: { top: number; bottom: number };
};

type NumberParameterSet = {
    numberActiveType: DrawMode;
    numberValueType: string;
    numberMoveType: string;
    numberArrangeType: string;
    numberMovingType: string;
    numberRotateType: string;
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
    private numberValueType = "one";
    private numberMoveType: string = "none";
    private numberArrangeType: string = "simple";
    private numberMovingType: string = "none";
    private numberRotateType: string = "none";

    private colorPalette: string[] = ColorPalette.colors;

    update(_p: p5, beat: number, bandParamValues: number[], NumberParamValues: number[], colorPalette: string[]): void {
        const resolved = this.resolveParameters(_p, beat, bandParamValues, NumberParamValues, colorPalette);
        this.applyBandParameters(resolved.band);
        this.applyNumberParameters(resolved.number);
        this.colorPalette = resolved.colorPalette;
    }

    draw(_p: p5, tex: p5.Graphics, beat: number): void {
        this.ensureNumberDisplayCount(this.lineCount);

        const topLeftScaleX = this.topBotomCenterScaleX.top - this.topBottomWidthScaleX.top * 0.5;
        const topRightScaleX = this.topBotomCenterScaleX.top + this.topBottomWidthScaleX.top * 0.5;
        const bottomLeftScaleX = this.topBotomCenterScaleX.bottom - this.topBottomWidthScaleX.bottom * 0.5;
        const bottomRightScaleX = this.topBotomCenterScaleX.bottom + this.topBottomWidthScaleX.bottom * 0.5;

        for (let i = 0; i < this.lineCount; i++) {
            const baseBox = this.createSegmentBoxForLine(
                _p,
                i,
                topLeftScaleX,
                topRightScaleX,
                bottomLeftScaleX,
                bottomRightScaleX,
            );

            this.drawBandForLine(_p, tex, baseBox, i, beat);
            this.drawNumberDisplay(_p, tex, baseBox, i, beat);
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
        _p: p5,
        lineIndex: number,
        topLeftScaleX: number,
        topRightScaleX: number,
        bottomLeftScaleX: number,
        bottomRightScaleX: number,
    ): BoxCoordinates {
        return calculateSegmentBox({
            p: _p,
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

    private drawBandForLine(_p: p5, tex: p5.Graphics, baseBox: BoxCoordinates, lineIndex: number, beat: number): void {
        tex.noStroke();
        tex.fill(this.colorPalette[lineIndex % this.colorPalette.length]);

        if (!this.shouldDraw(this.mode, lineIndex, beat, this.lineCount)) {
            return;
        }

        drawTrapezoidBand({
            p: _p,
            tex,
            box: baseBox,
            yscl1: 0.5 - this.bandWidthHeightScale.height * 0.5,
            yscl2: 0.5 + this.bandWidthHeightScale.height * 0.5,
        });
    }

    private drawNumberDisplay(_p: p5, tex: p5.Graphics, baseBox: BoxCoordinates, lineIndex: number, beat: number): void {
        const numberDisplay = this.numberDisplays[lineIndex];
        numberDisplay.setNumber(this.resolveNumberValue(lineIndex, beat));

        if (!this.shouldDraw(this.numberActiveType, lineIndex, beat, this.lineCount)) {
            return;
        }

        tex.fill(255);

        numberDisplay.draw((segmentId, yscl1, yscl2, xscl, align) => {
            const segmentCount = numberDisplay.getSegmentCount();
            const baseSeed = (lineIndex + 1) * 1000 + (segmentId + 1);

            const vertices = resolveTrapezoidVertices({
                p: _p,
                box: baseBox,
                texHeight: tex.height,
                yscl1,
                yscl2,
                xscl,
                align,
            });
            const segmentCenter = computePolygonCenter(vertices);
            const targetPositionCenter = this.resolveTargetPositionCenter(
                _p,
                segmentCenter,
                segmentId,
                segmentCount,
                baseSeed,
                beat,
            );

            const moving = this.resolveMovingScale(_p, beat);
            const xOffset = (targetPositionCenter.x - segmentCenter.x) * moving;
            const yOffset = (targetPositionCenter.y - segmentCenter.y) * moving;

            const yMoveOffset = this.resolveNumberMoveOffset(_p, beat, lineIndex);
            const rotationAngle = this.resolveRotationAngle(_p, beat, segmentId);
            const translatedBox = translateBox(baseBox, xOffset);
            const normalizedYOffset = (yOffset + yMoveOffset) / tex.height;

            const span = yscl2 - yscl1;
            const halfSpan = span * 0.5;
            const targetCenter = (yscl1 + yscl2) * 0.5 + normalizedYOffset;
            const newY1 = targetCenter - halfSpan;
            const newY2 = targetCenter + halfSpan;

            drawTrapezoidBand({
                p: _p,
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

    private resolveNumberValue(lineIndex: number, beat: number): number {
        switch (this.numberValueType) {
            case "one":
                return Math.floor(beat) % 10;
            case "two": {
                const base = Math.floor(beat) % 10;
                const shifted = (Math.floor(beat) + 5) % 10;
                return lineIndex % 2 === 0 ? base : shifted;
            }
            case "date":
                return this.digitFromText(DateText.getYYYYMMDD(), lineIndex);
            case "time":
                return this.digitFromText(DateText.getHHMMSS(), lineIndex);
            case "sequence":
                return (lineIndex + Math.floor(beat)) % 10;
            case "random":
                return Math.floor(UniformRandom.rand(Math.floor(beat), lineIndex) * 10);
            case "beat":
                return this.digitFromText(Math.floor(beat).toString().padStart(8, "0"), lineIndex);
            default:
                return 0;
        }
    }

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

    private resolveTargetPositionCenter(
        _p: p5,
        segmentCenter: Point,
        segmentId: number,
        segmentCount: number,
        baseSeed: number,
        beat: number,
    ): Point {
        const safeSegmentCount = Math.max(segmentCount, 1);

        switch (this.numberArrangeType) {
            case "center":
                return { x: _p.width * 0.5, y: _p.height * 0.5 };
            case "horizontal":
                return {
                    x: _p.width * (segmentId + 1) / (safeSegmentCount + 1),
                    y: _p.height * 0.5,
                };
            case "vertical":
                return {
                    x: _p.width * 0.5,
                    y: _p.height * (segmentId + 1) / (safeSegmentCount + 1),
                };
            case "grid": {
                const gridSize = Math.ceil(Math.sqrt(safeSegmentCount));
                const column = segmentId % gridSize;
                const row = Math.floor(segmentId / gridSize);
                return {
                    x: _p.width * (column + 1) / (gridSize + 1),
                    y: _p.height * (row + 1) / (gridSize + 1),
                };
            }
            case "circle": {
                const angle = (segmentId / safeSegmentCount) * Math.PI * 2 + beat * 0.5;
                return {
                    x: _p.width * 0.5 + Math.cos(angle) * (_p.width * 0.25),
                    y: _p.height * 0.5 + Math.sin(angle) * (_p.height * 0.25),
                };
            }
            case "random":
                return {
                    x: UniformRandom.rand(baseSeed, 1, Math.floor(beat * 0.5)) * _p.width,
                    y: UniformRandom.rand(baseSeed, 2, Math.floor(beat * 0.5)) * _p.height,
                };
            case "simple":
            default:
                return segmentCenter;
        }
    }

    private resolveMovingScale(_p: p5, beat: number): number {
        switch (this.numberMovingType) {
            case "zigzag":
                return Math.abs((beat % 2.0) - 1.0);
            case "ramp":
                return Easing.easeInOutQuad(_p.fract(beat));
            case "period":
                return GVM.leapRamp(beat, 4, 1, Easing.easeInOutQuad);
            case "none":
            default:
                return 1.0;
        }
    }

    private resolveNumberMoveOffset(_p: p5, beat: number, lineIndex: number): number {
        switch (this.numberMoveType) {
            case "down":
                return ((Easing.easeOutQuad((_p.fract(beat)) % 1.0) + 0.5) % 1 - 0.5) * (_p.height * 1.25);
            case "wave":
                return Math.sin((beat + lineIndex) * Math.PI * 0.5) * 50;
            case "sequence":
                return (Math.floor(beat / this.lineCount) % 2 === 0 ? -1 : 1) *
                    (Math.floor(beat) % this.lineCount === lineIndex ? (beat % 1.0) : 0) *
                    (_p.height * 1.25);
            case "none":
            default:
                return 0;
        }
    }

    private resolveRotationAngle(_p: p5, beat: number, segmentId: number): number {
        switch (this.numberRotateType) {
            case "lap":
                return Easing.easeInOutSine(_p.fract(beat / 4)) * Math.PI * 2;
            case "shake":
                return Easing.zigzag(beat) * Math.PI / 10;
            case "period":
                return GVM.leapNoise(beat, 4, 1, Easing.easeInOutSine, segmentId) * Math.PI * 2;
            case "none":
            default:
                return 0;
        }
    }

    private resolveParameters(
        _p: p5,
        beat: number,
        bandParamValues: number[],
        numberParamValues: number[],
        colorPalette: string[],
    ): ResolvedParameters {
        const zigzag = Math.abs(beat % 2 - 1.0);
        const noiseVal = GVM.leapNoise(beat, 1, 1, Easing.easeInOutQuad);
        const easeZigzag1 = Easing.easeInOutQuad(zigzag);
        const easeZigzag2 = Easing.easeInOutQuint(zigzag);

        const bandWidthHeightScaleOptions = [
            { width: 0.3, height: 0.3 * _p.width / _p.height },
            { width: 0.1, height: 1.0 },
            { width: 0.5, height: 1.0 },
            { width: 1.0, height: 0.5 },
            { width: 0.5, height: 0.5 },
            { width: 1.0, height: 1.0 },
            { width: easeZigzag1, height: 0.5 + _p.map(easeZigzag2, 0, 1, -0.05, 0.05) },
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
        const numberValueTypeOptions = ["one", "two", "date", "time", "sequence", "random", "beat"];
        const numberMoveTypeOptions = ["none", "down", "wave", "sequence"];
        const numberArrangeTypeOptions = ["simple", "center", "horizontal", "vertical", "grid", "circle", "random"];
        const numberMovingTypeOptions = ["none", "zigzag", "ramp", "period"];
        const numberRotateTypeOptions = ["none", "lap", "shake", "period"];

        const bandParameters: BandParameterSet = {
            mode: modeOptions[bandParamValues[0]] ?? "none",
            lineCount: countOptions[bandParamValues[1]] ?? 1.0,
            bandWidthHeightScale: bandWidthHeightScaleOptions[bandParamValues[2]] ?? { width: 1.0, height: 1.0 },
            topBottomWidthScaleX: topBottomWidthOptions[bandParamValues[3]] ?? { top: 1.0, bottom: 1.0 },
            topBotomCenterScaleX: centerOptions[bandParamValues[4]] ?? { top: 0.5, bottom: 0.5 },
        };

        const numberParameters: NumberParameterSet = {
            numberActiveType: modeOptions[numberParamValues[0]] ?? "none",
            numberValueType: numberValueTypeOptions[numberParamValues[1]] ?? "one",
            numberMoveType: numberMoveTypeOptions[numberParamValues[2]] ?? "none",
            numberArrangeType: numberArrangeTypeOptions[numberParamValues[3]] ?? "simple",
            numberMovingType: numberMovingTypeOptions[numberParamValues[4]] ?? "none",
            numberRotateType: numberRotateTypeOptions[numberParamValues[5]] ?? "none",
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
    }

    private applyNumberParameters(number: NumberParameterSet): void {
        this.numberActiveType = number.numberActiveType;
        this.numberValueType = number.numberValueType;
        this.numberMoveType = number.numberMoveType;
        this.numberArrangeType = number.numberArrangeType;
        this.numberMovingType = number.numberMovingType;
        this.numberRotateType = number.numberRotateType;
    }
}