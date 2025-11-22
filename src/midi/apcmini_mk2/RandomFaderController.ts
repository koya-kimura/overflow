import { randomDurationInRange, type NumericRange } from "../utils";

export type FaderButtonMode = "mute" | "random";

interface RandomFaderState {
    isActive: boolean;
    currentValue: number;
    nextSwitchTime: number;
    isHighPhase: boolean;
}

export class RandomFaderController {
    private readonly states: RandomFaderState[];
    private readonly lowDurationRange: NumericRange;
    private readonly highDurationRange: NumericRange;

    constructor(count: number, lowDurationRange: NumericRange, highDurationRange: NumericRange) {
        this.lowDurationRange = lowDurationRange;
        this.highDurationRange = highDurationRange;
        this.states = Array.from({ length: count }, () => ({
            isActive: false,
            currentValue: 0,
            nextSwitchTime: 0,
            isHighPhase: false,
        }));
    }

    public recomputeValue(index: number, mode: FaderButtonMode, toggleState: number, prevValue: number, now: number): number {
        if (mode === "mute") {
            this.deactivate(index);
            return toggleState ? 0 : prevValue;
        }

        if (toggleState) {
            this.activate(index, now);
            return this.states[index].currentValue;
        }

        this.deactivate(index);
        return prevValue;
    }

    public syncForMode(mode: FaderButtonMode, toggleStates: number[], prevValues: number[], targetValues: number[], now: number): void {
        for (let i = 0; i < toggleStates.length; i++) {
            targetValues[i] = this.recomputeValue(i, mode, toggleStates[i], prevValues[i], now);
        }
    }

    public process(now: number, mode: FaderButtonMode, targetValues: number[]): void {
        if (mode !== "random") {
            return;
        }

        for (let i = 0; i < this.states.length; i++) {
            const state = this.states[i];
            if (!state.isActive) {
                continue;
            }

            if (state.nextSwitchTime === 0) {
                state.nextSwitchTime = now + (state.isHighPhase ? this.getRandomHighDuration() : this.getRandomLowDuration());
            }

            if (now >= state.nextSwitchTime) {
                if (state.isHighPhase) {
                    state.isHighPhase = false;
                    state.currentValue = 0;
                    state.nextSwitchTime = now + this.getRandomLowDuration();
                } else {
                    state.isHighPhase = true;
                    state.currentValue = 1;
                    state.nextSwitchTime = now + this.getRandomHighDuration();
                }
            }

            targetValues[i] = state.currentValue;
        }
    }

    public activate(index: number, now: number): void {
        const state = this.states[index];
        if (state.isActive) {
            return;
        }

        state.isActive = true;
        state.isHighPhase = false;
        state.currentValue = 0;
        state.nextSwitchTime = now + this.getRandomLowDuration();
    }

    public deactivate(index: number): void {
        const state = this.states[index];
        if (!state.isActive && state.currentValue === 0) {
            return;
        }

        state.isActive = false;
        state.isHighPhase = false;
        state.currentValue = 0;
        state.nextSwitchTime = 0;
    }

    private getRandomLowDuration(): number {
        return randomDurationInRange(this.lowDurationRange);
    }

    private getRandomHighDuration(): number {
        return randomDurationInRange(this.highDurationRange);
    }
}
