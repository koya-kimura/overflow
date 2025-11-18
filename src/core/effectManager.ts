// EffectManager はポストエフェクト用のシェーダーを読み込み適用する責務を持つ。
import p5 from "p5";

export class EffectManager {
    private shader: p5.Shader | null;

    // constructor は空のシェーダー参照を初期化する。
    constructor() {
        this.shader = null;
    }

    // load は頂点・フラグメントシェーダーを読み込み、Promise を待機して保持する。
    async load(p: p5, vertPath: string, fragPath: string): Promise<void> {
        const shaderOrPromise = p.loadShader(vertPath, fragPath);

        if (shaderOrPromise instanceof Promise) {
            this.shader = await shaderOrPromise;
        } else {
            this.shader = shaderOrPromise;
        }
    }

    // apply は保持しているシェーダーをアクティブにし、各種 Uniform を設定して描画する。
    apply(p: p5, sourceTexture: p5.Graphics): void {
        if (!this.shader) {
            return;
        }

        p.shader(this.shader);
        this.shader.setUniform("u_tex", sourceTexture);
        this.shader.setUniform("u_resolution", [p.width, p.height]);
        this.shader.setUniform("u_time", p.millis() / 1000.0);
        p.rect(0, 0, p.width, p.height);
    }
}