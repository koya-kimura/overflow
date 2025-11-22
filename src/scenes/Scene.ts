import p5 from "p5";

// Scene は p5 ベースのシーン実装が満たすべき最小契約を定義する。
export interface Scene {
    update(p: p5, beat: number, bandParams: number[], numberParams: number[], colorPalette: string[]): void;
    draw(p: p5, target: p5.Graphics, beat: number): void;
}
