export type NumericRange = { min: number; max: number };

/**
 * 数値を 0.0 から 1.0 の範囲に制限（クランプ）します。
 * MIDIのコントロール値（0-127）を正規化して使用する場合や、
 * アニメーションの進行度、不透明度などのパラメータが
 * 意図しない範囲外の値にならないようにするために使用します。
 *
 * @param value 制限したい数値。
 * @returns 0.0 以上 1.0 以下の数値。
 */
export function clampUnitRange(value: number): number {
    if (value < 0) {
        return 0;
    }
    if (value > 1) {
        return 1;
    }
    return value;
}

/**
 * グリッド選択値を有効な範囲内に制限します。
 * APC Mini MK2などのグリッドコントローラーにおいて、
 * 選択可能なオプション数（maxOptions）に基づいてインデックスを制限します。
 * ハードウェアの制約上、最大値は7（8番目のボタン）に固定されています。
 * これにより、配列外参照のエラーを防ぎ、UI上の選択状態を整合させます。
 *
 * @param value 制限したいインデックス値。
 * @param maxOptions 選択可能なオプションの総数。
 * @returns 0 以上 Math.min(7, maxOptions - 1) 以下の整数。
 */
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

/**
 * 与えられたシード値に基づいて、簡易的な疑似乱数を生成します。
 * 0.0 以上 1.0 未満の値を返します。
 * Math.sinを利用した決定論的な計算を行うため、同じシード値からは常に同じ結果が得られます。
 * 再現性が必要なエフェクトや、ランダムに見えるが制御されたパターン生成に使用されます。
 *
 * @param seed シード値（任意の数値）。
 * @returns 0.0 以上 1.0 未満の疑似乱数。
 */
export function pseudoRandomFromSeed(seed: number): number {
    const x = Math.sin(seed * 99999 + 1) * 10000;
    return x - Math.floor(x);
}

/**
 * 指定された数値範囲内でランダムな値を生成します。
 * アニメーションの持続時間や、パーティクルの寿命など、
 * 一定の幅を持たせたランダムなパラメータが必要な場合に使用します。
 * min >= max の場合は min を返します。
 *
 * @param range 最小値(min)と最大値(max)を持つオブジェクト。
 * @returns min 以上 max 未満のランダムな数値。
 */
export function randomDurationInRange(range: NumericRange): number {
    if (range.min >= range.max) {
        return range.min;
    }
    return range.min + Math.random() * (range.max - range.min);
}

/**
 * 現在の高精度なタイムスタンプを取得します。
 * ブラウザが `performance.now()` をサポートしている場合はそれを使用し、
 * そうでない場合は `Date.now()` を使用します。
 * アニメーションのタイミング制御や、経過時間の計測など、
 * 正確な時間管理が必要な場面で使用されます。
 *
 * @returns 現在のタイムスタンプ（ミリ秒）。
 */
export function getCurrentTimestamp(): number {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
        return performance.now();
    }
    return Date.now();
}
