export type NumericRange = { min: number; max: number };

// clampUnitRange は 0〜1 の範囲に数値を収める。
export function clampUnitRange(value: number): number {
    if (value < 0) {
        return 0;
    }
    if (value > 1) {
        return 1;
    }
    return value;
}

// clampGridSelection は 0〜maxOptions-1 の範囲にグリッド選択値を制限する。
export function clampGridSelection(value: number, maxOptions: number): number {
    const maxIndex = Math.max(0, Math.min(7, maxOptions - 1));
    if (value < 0) {
        return 0;
    }
    if (value > maxIndex) {
        return maxIndex;
    }
    return value;
}

// pseudoRandomFromSeed は簡易な擬似乱数を [0,1) で返す。
export function pseudoRandomFromSeed(seed: number): number {
    const x = Math.sin(seed * 99999 + 1) * 10000;
    return x - Math.floor(x);
}

// randomDurationInRange は指定した範囲内で乱数を返す。
export function randomDurationInRange(range: NumericRange): number {
    if (range.min >= range.max) {
        return range.min;
    }
    return range.min + Math.random() * (range.max - range.min);
}

// getCurrentTimestamp は performance.now を優先して現在時刻を取得する。
export function getCurrentTimestamp(): number {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
        return performance.now();
    }
    return Date.now();
}
