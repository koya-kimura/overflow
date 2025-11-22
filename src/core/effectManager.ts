// EffectManager はポストエフェクト用のシェーダーを読み込み適用する責務を持つ。
import p5 from "p5";
export class EffectManager {
    private shader: p5.Shader | null;

    // constructor は空のシェーダー参照を初期化する。
    constructor() {
        this.shader = null;
    }

    /**
     * 指定されたパスから頂点シェーダーとフラグメントシェーダーを非同期で読み込みます。
     * p5.jsのloadShader関数を使用し、シェーダーオブジェクトを作成してクラス内部に保持します。
     * 読み込み処理がPromiseを返す場合（特定のp5.jsのバージョンや環境など）にも対応しており、
     * async/awaitを用いてシェーダーのロード完了を確実に待機します。
     * これにより、描画ループが開始される前にシェーダーリソースが確実に利用可能な状態になることを保証します。
     *
     * @param p p5.jsのインスタンス。シェーダーのロード機能を提供します。
     * @param vertPath 頂点シェーダーファイルのパス（.vert）。
     * @param fragPath フラグメントシェーダーファイルのパス（.frag）。
     * @returns シェーダーの読み込みが完了した後に解決されるPromise。
     */
    async load(p: p5, vertPath: string, fragPath: string): Promise<void> {
        const shaderOrPromise = p.loadShader(vertPath, fragPath);

        if (shaderOrPromise instanceof Promise) {
            this.shader = await shaderOrPromise;
        } else {
            this.shader = shaderOrPromise;
        }
    }

    /**
     * 現在のフレームに対してポストエフェクトシェーダーを適用し、最終的な描画を行います。
     * 複数のテクスチャ（ソース、UI、キャプチャ）と、MIDIコントローラーなどからの入力値（フェーダー、グリッド）を
     * シェーダーのUniform変数として設定します。
     * これにより、モザイク、波形歪み、色反転、ジッターなどのエフェクトを動的に制御します。
     * また、全体の不透明度や背景シーンの回転タイプなどもここで反映されます。
     * 最後に画面全体を覆う矩形を描画することで、シェーダーの効果をキャンバス全体に適用します。
     *
     * @param p p5.jsのインスタンス。
     * @param sourceTexture メインの描画内容が含まれるグラフィックスオブジェクト。
     * @param uiTexture UI要素（テキストなど）が含まれるグラフィックスオブジェクト。
     * @param captureTexture 以前のフレームやカメラ入力などのキャプチャ用テクスチャ。
     * @param faderValues MIDIフェーダーからの入力値配列。エフェクトの強度制御に使用。
     * @param gridValues MIDIグリッドボタンからの入力値配列。シーン切り替えなどに使用。
     * @param beat 現在のビート情報。リズムに合わせたエフェクト同期に使用。
     * @param colorPaletteRGBArray カラーパレットのRGB値がフラットに並んだ配列。
     */
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
        this.shader.setUniform("u_right", faderValues[4]);

        this.shader.setUniform("u_captureOpacity", faderValues[5]);
        this.shader.setUniform("u_mainOpacity", faderValues[6]);
        this.shader.setUniform("u_bgOpacity", faderValues[7]);
        this.shader.setUniform("u_uiOpacity", faderValues[8]);

        this.shader.setUniform("u_bgSceneIndex", gridValues[0]);
        this.shader.setUniform("u_bgSceneRotateType", gridValues[1]);

        p.rect(0, 0, p.width, p.height);
    }
}