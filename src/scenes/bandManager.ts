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
} from "../utils/bandGeometry";

type DrawMode = "none" | "all" | "sequence" | "random" | "speedSeqence" | "highSpeedSeqence";
// type numberValueType = "one" | "two" | "date" | "time" |"sequence" | "random" | "beat";

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
        const numberValueTypeOptions = ["one", "two", "date", "time", "sequence", "random", "beat"]
        const numberMoveTypeOptions = ["none", "down", "wave", "sequence"]
        const numberArrangeTypeOptions = ["simple", "center", "horizontal", "vertical", "grid", "circle", "random"];
        const numberMovingTypeOptions = ["none", "zigzag", "ramp", "period"];
        const numberRotateTypeOptions = ["none", "lap", "shake", "period"];

        this.mode = modeOptions[bandParamValues[0]] ?? "none";
        this.lineCount = countOptions[bandParamValues[1]] ?? 1.0;
        this.bandWidthHeightScale = bandWidthHeightScaleOptions[bandParamValues[2]] ?? { width: 1.0, height: 1.0 };
        this.topBottomWidthScaleX = topBottomWidthOptions[bandParamValues[3]] ?? { top: 1.0, bottom: 1.0 };
        this.topBotomCenterScaleX = centerOptions[bandParamValues[4]] ?? { top: 0.5, bottom: 0.5 };

        this.numberActiveType = modeOptions[NumberParamValues[0]] ?? "none";
        this.numberValueType = numberValueTypeOptions[NumberParamValues[1]] ?? "one";
        this.numberMoveType = numberMoveTypeOptions[NumberParamValues[2]] ?? "none";
        this.numberArrangeType = numberArrangeTypeOptions[NumberParamValues[3]] ?? "simple";
        this.numberMovingType = numberMovingTypeOptions[NumberParamValues[4]] ?? "none";
        this.numberRotateType = numberRotateTypeOptions[NumberParamValues[5]] ?? "none";

        this.colorPalette = colorPalette;
    }

    draw(_p: p5, tex: p5.Graphics, beat: number): void {
        this.ensureNumberDisplayCount(this.lineCount);

        const topLeftScaleX = this.topBotomCenterScaleX.top - this.topBottomWidthScaleX.top * 0.5;
        const topRightScaleX = this.topBotomCenterScaleX.top + this.topBottomWidthScaleX.top * 0.5;
        const bottomLeftScaleX = this.topBotomCenterScaleX.bottom - this.topBottomWidthScaleX.bottom * 0.5;
        const bottomRightScaleX = this.topBotomCenterScaleX.bottom + this.topBottomWidthScaleX.bottom * 0.5;

        for (let i = 0; i < this.lineCount; i++) {
            const baseBox = calculateSegmentBox({
                p: _p,
                count: this.lineCount,
                startTopIndex: i,
                endTopIndex: i,
                startBottomIndex: i,
                endBottomIndex: i,
                scale: this.bandWidthHeightScale.width,
                xStartTop: topLeftScaleX,
                xEndTop: topRightScaleX,
                xStartBottom: bottomLeftScaleX,
                xEndBottom: bottomRightScaleX,
            });

            tex.noStroke();
            tex.fill(this.colorPalette[i % this.colorPalette.length]);

            if (this.shouldDraw(this.mode, i, beat, this.lineCount)) {
                drawTrapezoidBand({
                    p: _p,
                    tex,
                    box: baseBox,
                    yscl1: 0.5 - this.bandWidthHeightScale.height * 0.5,
                    yscl2: 0.5 + this.bandWidthHeightScale.height * 0.5,
                });
            }

            const numberDisplay = this.numberDisplays[i];
            const numberValue = this.numberValueType === "one" ? (Math.floor(beat) % 10) :
                this.numberValueType === "two" ? ( i % 2 == 0 ? (Math.floor(beat) % 10) : ((Math.floor(beat) + 5) % 10)) :
                this.numberValueType === "date" ? [...DateText.getYYYYMMDD()][i % 8].charCodeAt(0) - '0'.charCodeAt(0) :
                this.numberValueType === "time" ? [...DateText.getHHMMSS()][i % 8].charCodeAt(0) - '0'.charCodeAt(0) :
                this.numberValueType === "sequence" ? ((i + Math.floor(beat)) % 10) :
                this.numberValueType === "random" ? Math.floor(UniformRandom.rand(Math.floor(beat), i) * 10) :
                this.numberValueType === "beat" ? [...Math.floor(beat).toString().padStart(8, '0')][i % 8].charCodeAt(0) - '0'.charCodeAt(0) :
                0;
            numberDisplay.setNumber(numberValue);

            if (this.shouldDraw(this.numberActiveType, i, beat, this.lineCount)) {
                tex.fill(255);

                numberDisplay.draw((segmentId, yscl1, yscl2, xscl, align) => {
                    const baseSeed = (i + 1) * 1000 + (segmentId + 1);

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
                    const targetPositionCenter = this.numberArrangeType === "simple" ? segmentCenter :
                        this.numberArrangeType === "center" ? { x: _p.width * 0.5, y: _p.height * 0.5 } :
                        this.numberArrangeType === "horizontal" ? { x: _p.width * (segmentId + 1) / (numberDisplay.getSegmentCount() + 1), y: _p.height * 0.5 } :
                        this.numberArrangeType === "vertical" ? { x: _p.width * 0.5, y: _p.height * (segmentId + 1) / (numberDisplay.getSegmentCount() + 1) } :
                        this.numberArrangeType === "grid" ? {
                            x: _p.width * ((segmentId % Math.ceil(Math.sqrt(numberDisplay.getSegmentCount()))) + 1) / (Math.ceil(Math.sqrt(numberDisplay.getSegmentCount())) + 1),
                            y: _p.height * (Math.floor(segmentId / Math.ceil(Math.sqrt(numberDisplay.getSegmentCount()))) + 1) / (Math.ceil(Math.sqrt(numberDisplay.getSegmentCount())) + 1),
                        } :
                        this.numberArrangeType === "circle" ? {
                            x: _p.width * 0.5 + Math.cos((segmentId / numberDisplay.getSegmentCount()) * Math.PI * 2 + beat * 0.5) * (_p.width * 0.25),
                            y: _p.height * 0.5 + Math.sin((segmentId / numberDisplay.getSegmentCount()) * Math.PI * 2 + beat * 0.5) * (_p.height * 0.25),
                        } :
                        this.numberArrangeType === "random" ? {
                            x: UniformRandom.rand(baseSeed , 1, Math.floor(beat * 0.5)) * _p.width,
                            y: UniformRandom.rand(baseSeed , 2, Math.floor(beat * 0.5)) * _p.height,
                        } :
                        segmentCenter;
                    
                    const moving = this.numberMovingType === "none" ? 1.0 :
                        this.numberMovingType === "zigzag" ? Math.abs((beat % 2.0) - 1.0) :
                        this.numberMovingType === "ramp" ? Easing.easeInOutQuad(_p.fract(beat)) :
                        this.numberMovingType === "period" ? GVM.leapRamp(beat, 4, 1, Easing.easeInOutQuad) :
                        1.0;

                    const xOffset = (targetPositionCenter.x - segmentCenter.x) * moving;
                    const yOffset = (targetPositionCenter.y - segmentCenter.y) * moving;

                    const yMoveOffset = 
                        this.numberMoveType === "down" ? ((Easing.easeOutQuad((_p.fract(beat)) % 1.0) + 0.5) % 1 - 0.5) * (_p.height * 1.25) :
                        this.numberMoveType === "wave" ? Math.sin((beat + i) * Math.PI * 0.5) * 50 :
                        this.numberMoveType === "sequence" ? (Math.floor(beat / this.lineCount) % 2 === 0 ? -1 : 1) * (Math.floor(beat) % this.lineCount === i ? (beat % 1.0) : 0) * (_p.height * 1.25):
                        0;


                    const rotationAngle = this.numberRotateType === "none" ? 0 :
                        this.numberRotateType === "lap" ? Easing.easeInOutSine( _p.fract(beat / 4) ) * Math.PI * 2 :
                        this.numberRotateType === "shake" ? Easing.zigzag(beat) * Math.PI / 10:
                        this.numberRotateType === "period" ? GVM.leapNoise(beat, 4, 1, Easing.easeInOutSine, segmentId) * Math.PI * 2:
                        0;
                    const translatedBox = translateBox(baseBox, xOffset);
                    const normalizedYOffset = (yOffset + yMoveOffset) / tex.height;

                    const span = yscl2 - yscl1;
                    const halfSpan = span * 0.5;
                    const targetCenter = (yscl1 + yscl2) * 0.5 + normalizedYOffset;
                    // const clampedCenter = Math.min(Math.max(targetCenter, halfSpan), 1 - halfSpan);
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

}