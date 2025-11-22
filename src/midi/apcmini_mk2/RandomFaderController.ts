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

    /**
     * RandomFaderControllerクラスのコンストラクタです。
     * 指定された数のフェーダー（count）に対して、個別の状態管理オブジェクト（states）を初期化します。
     * また、ランダム動作時の「Low状態（0）」と「High状態（1）」の持続時間を決定するための
     * 範囲設定（lowDurationRange, highDurationRange）を保存します。
     * 初期状態ではすべてのフェーダーは非アクティブ（ランダム動作なし）に設定されます。
     *
     * @param count 管理するフェーダーの数。
     * @param lowDurationRange Low状態の持続時間の範囲（ミリ秒）。
     * @param highDurationRange High状態の持続時間の範囲（ミリ秒）。
     */
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

    /**
     * 指定されたフェーダーの値を再計算します。
     * 現在のモード（mute/random）、ボタンのトグル状態、前回の値、現在時刻に基づいて、
     * そのフェーダーが出力すべき値を決定します。
     * - muteモード: ボタンがONなら0（ミュート）、OFFなら前回の値を維持。
     * - randomモード: ボタンがONならランダム制御を有効化（activate）して現在のランダム値を返す。
     *                 OFFならランダム制御を無効化（deactivate）して前回の値を維持。
     *
     * @param index フェーダーのインデックス。
     * @param mode 現在のフェーダーボタンモード。
     * @param toggleState ボタンのトグル状態（1: ON, 0: OFF）。
     * @param prevValue 前回のフェーダー値。
     * @param now 現在のタイムスタンプ。
     * @returns 計算された新しいフェーダー値。
     */
    public recomputeValue(index: number, mode: FaderButtonMode, toggleState: number, prevValue: number, now: number): number {
        // index範囲外ガード
        if (index < 0 || index >= this.states.length) {
            return prevValue;
        }
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

    /**
     * モード変更時にすべてのフェーダーの状態を同期させます。
     * 新しいモードに基づいて、すべてのフェーダーに対して `recomputeValue` を実行し、
     * 結果を `targetValues` 配列に格納します。
     * これにより、モード切替時に一括して正しい状態に遷移させることができます。
     *
     * @param mode 新しいフェーダーボタンモード。
     * @param toggleStates 全フェーダーのボタントグル状態配列。
     * @param prevValues 全フェーダーの前回の値の配列。
     * @param targetValues 結果を格納する配列（参照渡し）。
     * @param now 現在のタイムスタンプ。
     */
    public syncForMode(mode: FaderButtonMode, toggleStates: number[], prevValues: number[], targetValues: number[], now: number): void {
        for (let i = 0; i < toggleStates.length; i++) {
            targetValues[i] = this.recomputeValue(i, mode, toggleStates[i], prevValues[i], now);
        }
    }

    /**
     * ランダムフェーダーの時間経過による更新処理を行います。
     * randomモードの場合のみ動作します。
     * アクティブなフェーダーについて、次の切り替え時刻（nextSwitchTime）に達しているかをチェックし、
     * 達していればHigh/Lowの状態を反転させ、値を更新し、次の切り替え時刻を設定します。
     * High状態は短く（フラッシュ的）、Low状態は長く（待機的）設定されることが一般的です。
     *
     * @param now 現在のタイムスタンプ。
     * @param mode 現在のフェーダーボタンモード。
     * @param targetValues 結果を格納する配列（参照渡し）。
     */
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

    /**
     * 指定されたフェーダーのランダム制御を有効化（アクティブ化）します。
     * 既にアクティブな場合は何もしません。
     * アクティブ化されると、初期状態としてLow（0）から開始し、
     * ランダムな待機時間後にHigh（1）へ遷移するようにスケジュールされます。
     *
     * @param index フェーダーのインデックス。
     * @param now 現在のタイムスタンプ。
     */
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

    /**
     * 指定されたフェーダーのランダム制御を無効化（非アクティブ化）します。
     * 既に非アクティブで、かつ値が0に戻っている場合は何もしません。
     * 強制的に非アクティブ状態にし、値を0にリセットします。
     *
     * @param index フェーダーのインデックス。
     */
    public deactivate(index: number): void {
        const state = this.states[index];
        if (!state) {
            return;
        }
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
