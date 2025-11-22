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
    apply(p: p5, sourceTexture: p5.Graphics, uiTexture: p5.Graphics, captureTexture: p5.Graphics, faderValues: number[], gridValues: number[], beat: number = 0, colorPaletteRGBArray: number[]): void {
        if (!this.shader) {
            return;
        }

        p.shader(this.shader);
        this.shader.setUniform("u_beat", beat);
        this.shader.setUniform("u_tex", sourceTexture);
        this.shader.setUniform("u_uiTex", uiTexture);
        this.shader.setUniform("u_captureTex", captureTexture);
        this.shader.setUniform("u_resolution", [p.width, p.height]);
        this.shader.setUniform("u_time", p.millis() / 1000.0);
        this.shader.setUniform("u_colorPalette", colorPaletteRGBArray);
        this.shader.setUniform("u_colorPaletteLength", Math.floor(colorPaletteRGBArray.length / 3));

        this.shader.setUniform("u_mosaic", faderValues[0]);
        this.shader.setUniform("u_wave", faderValues[1]);
        this.shader.setUniform("u_invert", faderValues[2]);
        this.shader.setUniform("u_jitter", faderValues[3]);

        this.shader.setUniform("u_mainOpacity", faderValues[4]);
        this.shader.setUniform("u_bgOpacity", faderValues[5]);
        this.shader.setUniform("u_captureOpacity", faderValues[6]);
        this.shader.setUniform("u_uiOpacity", faderValues[7]);
        this.shader.setUniform("u_masterOpacity", faderValues[8]);

        this.shader.setUniform("u_bgSceneIndex", gridValues[0]);
        this.shader.setUniform("u_bgSceneRotateType", gridValues[1]);

        p.rect(0, 0, p.width, p.height);
    }
}