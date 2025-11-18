import p5 from "p5";

// Scene インターフェースは p5 スケッチ内の個別シーンが実装すべき契約を提供する。
export interface Scene {
    // update はシーンの状態遷移や入力処理を担当する。
    update(p: p5): void;

    // draw はシーンの視覚表現を受け取った Graphics に描画する。
    draw(p: p5, tex: p5.Graphics): void;
}
