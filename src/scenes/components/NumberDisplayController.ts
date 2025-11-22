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

    resolveNumberValue(lineIndex: number, beat: number): number {
        switch (this.settings.valueType) {
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

    resolveTargetPositionCenter(
        _p: p5,
        segmentCenter: Point,
        segmentId: number,
        segmentCount: number,
        baseSeed: number,
        beat: number,
    ): Point {
        const safeSegmentCount = Math.max(segmentCount, 1);

        switch (this.settings.arrangeType) {
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

    resolveMovingScale(_p: p5, beat: number): number {
        switch (this.settings.movingType) {
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

    resolveNumberMoveOffset(_p: p5, beat: number, lineIndex: number): number {
        switch (this.settings.moveType) {
            case "down":
                return ((Easing.easeOutQuad((_p.fract(beat)) % 1.0) + 0.5) % 1 - 0.5) * (_p.height * 1.25);
            case "wave":
                return Math.sin((beat + lineIndex) * Math.PI * 0.5) * 50;
            case "sequence":
                return (Math.floor(beat / this.settings.lineCount) % 2 === 0 ? -1 : 1) *
                    (Math.floor(beat) % this.settings.lineCount === lineIndex ? (beat % 1.0) : 0) *
                    (_p.height * 1.25);
            case "none":
            default:
                return 0;
        }
    }

    resolveRotationAngle(_p: p5, beat: number, segmentId: number): number {
        switch (this.settings.rotateType) {
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
