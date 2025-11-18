import p5 from "p5";
import type { Scene } from "./Scene";

// SampleScene はテンプレート用の最小シーン実装を提供する。
export class SampleScene implements Scene {
    // update はこのシーン固有のアニメーションや入力処理を記述する場所。
    update(_p: p5): void {
        // シーンの状態を更新するロジックをここに実装
    }

    // draw は受け取った Graphics にシーンのビジュアルを描画する。
    draw(_p: p5, tex: p5.Graphics): void {
        tex.fill(255, 0, 0);
        tex.ellipse(tex.width / 2, tex.height / 2, 100, 100);
    }
}