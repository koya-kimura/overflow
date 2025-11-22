export class UniformRandom {
    /**
     * 決定論的な疑似乱数を生成します。
     * GVM.uniformRandomと同様のロジックを使用しており、
     * 与えられたシード値（seed1, seed2, seed3）に基づいて常に同じ結果を返します。
     * Math.sinを利用した簡易的なハッシュ関数のような動作をし、結果は0.0〜1.0の範囲に正規化されます。
     * アートワークやジェネラティブアートにおいて、再現性のあるランダム性が必要な場合に非常に有用です。
     *
     * @param seed1 シード値1。
     * @param seed2 シード値2（省略可）。
     * @param seed3 シード値3（省略可）。
     * @returns 0.0〜1.0の範囲の疑似乱数。
     */
    static rand(seed1: number, seed2: number = 0, seed3: number = 0): number {
        const x = Math.sin(seed1 * 123 + seed2 * 456 + seed3 * 789) * 10000000;
        return x - Math.floor(x);
    }

    /**
     * 任意の文字列を数値のシード値に変換します。
     * 文字列の各文字コードを用いてハッシュ値を計算し、それを正の整数として返します。
     * このシード値をrand関数などに渡すことで、特定の文字列（例えばユーザー名やキーワード）に基づいた
     * 一意な乱数生成が可能になります。
     * 同じ文字列からは常に同じシード値が生成されるため、
     * 文字列を入力パラメータとするジェネラティブアートなどに適しています。
     *
     * @param text シード値の元となる文字列。
     * @returns 計算されたハッシュ値（整数）。
     */
    static text2Seed(text: string): number {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = text.charCodeAt(i) + ((hash << 5) - hash);
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }
}