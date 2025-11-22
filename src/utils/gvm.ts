export class GVM {
    /**
     * シームレスにループする補間ノイズを生成します。
     * 通常のランダム値やノイズ関数は時間経過とともに不連続に変化したり、ループしなかったりしますが、
     * この関数は指定された周期（loop）で滑らかに値がつながるように設計されています。
     * 内部的に2つの乱数シード（現在の区間と次の区間）を生成し、
     * それらをイージング関数（easeFunc）を用いて滑らかに補間します。
     * これにより、一定周期で繰り返される自然な揺らぎや動きを作ることができます。
     *
     * @param x 現在の時間や進行度。
     * @param loop ループの周期（長さ）。
     * @param move 遷移にかける時間（長さ）。
     * @param easeFunc 補間に使用するイージング関数（デフォルトは線形）。
     * @param seed1 乱数生成のためのシード値1。
     * @param seed2 乱数生成のためのシード値2。
     * @returns 補間されたノイズ値。
     */
    static leapNoise(x: number, loop: number, move: number, easeFunc: Function = linear, seed1: number = 0, seed2: number = 0): number {
        const count = Math.floor(x / loop);
        const t = GVM.leapRamp(x, loop, move, easeFunc);

        const x1 = GVM.uniformRandom(seed1, seed2, count);
        const x2 = GVM.uniformRandom(seed1, seed2, count + 1);

        return GVM.map(t, 0, 1, x1, x2);
    }

    /**
     * leapNoiseのための補間係数（0.0〜1.0）を計算します。
     * ループ周期内の現在の位置に基づいて、次の値への遷移進行度を算出します。
     * 指定された遷移期間（move）の間だけ値が変化し、それ以外の期間は固定値（または変化完了状態）となります。
     * これにより、断続的な動きや、特定のタイミングでのみ変化するアニメーション制御が可能になります。
     *
     * @param x 現在の時間や進行度。
     * @param loop ループの周期。
     * @param move 遷移にかける時間。
     * @param easeFunc イージング関数。
     * @returns 補間係数（0.0〜1.0）。
     */
    static leapRamp(x: number, loop: number, move: number, easeFunc: Function = linear) {
        return easeFunc(GVM.clamp((x % loop - (loop - move)) / move, 0, 1));
    }

    /**
     * 数値をある範囲から別の範囲へ線形変換（マッピング）します。
     * p5.mapと同様の機能ですが、p5インスタンスに依存せずに使用できる静的メソッドです。
     * 入力値（value）が入力範囲（inMin〜inMax）の中でどの位置にあるかを計算し、
     * それを出力範囲（outMin〜outMax）の対応する位置に変換して返します。
     * データの正規化や、座標変換、パラメータのスケール調整などに頻繁に使用されます。
     *
     * @param value 変換したい値。
     * @param inMin 入力範囲の最小値。
     * @param inMax 入力範囲の最大値。
     * @param outMin 出力範囲の最小値。
     * @param outMax 出力範囲の最大値。
     * @returns 変換後の値。
     */
    static map(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
        return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    }

    /**
     * 数値を指定された最小値と最大値の範囲内に制限（クランプ）します。
     * 値がminより小さい場合はminを、maxより大きい場合はmaxを返します。
     * 範囲内の場合はそのままの値を返します。
     * アニメーションの進行度が0〜1を超えないようにしたり、
     * 座標が画面外に出ないように制限したりする際に使用します。
     *
     * @param value 制限したい値。
     * @param min 最小値。
     * @param max 最大値。
     * @returns 範囲内に制限された値。
     */
    static clamp(value: number, min: number, max: number): number {
        return Math.min(Math.max(value, min), max);
    }

    /**
     * 決定論的な疑似乱数を生成します。
     * 与えられたシード値（seed1, seed2, seed3）に基づいて、常に同じ結果を返す乱数生成器です。
     * Math.sinを利用した簡易的なハッシュ関数のような動作をし、結果は0.0〜1.0の範囲に正規化されます。
     * アートワークやジェネラティブアートにおいて、再現性のあるランダム性が必要な場合に非常に有用です。
     * 同じシード値を渡せば、常に同じ「ランダムな」値が得られます。
     *
     * @param seed1 シード値1。
     * @param seed2 シード値2（省略可）。
     * @param seed3 シード値3（省略可）。
     * @returns 0.0〜1.0の範囲の疑似乱数。
     */
    static uniformRandom(seed1: number, seed2: number = 0, seed3: number = 0): number {
        const x = Math.sin(seed1 * 123 + seed2 * 456 + seed3 * 789) * 10000000;
        return x - Math.floor(x);
    }
}

const linear = (x: number): number => {
    return x;
};