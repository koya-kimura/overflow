export class UniformRandom {
    // uniformRandom は簡易な疑似乱数を生成して 0〜1 に正規化する。
    static rand(seed1: number, seed2: number = 0, seed3: number = 0): number {
        const x = Math.sin(seed1 * 123 + seed2 * 456 + seed3 * 789) * 10000000;
        return x - Math.floor(x);
    }

    static text2Seed(text: string): number {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = text.charCodeAt(i) + ((hash << 5) - hash);
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }
}