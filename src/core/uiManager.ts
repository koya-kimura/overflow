import p5 from "p5";

// TexManager は描画用の p5.Graphics とシーン、MIDI デバッグ描画のハブを担当する。
export class UIManager {
    private renderTexture: p5.Graphics | null;

    // コンストラクタではデバッグ用シーン管理と MIDI ハンドラをセットアップする。
    constructor() {
        this.renderTexture = null;
    }

    // init はキャンバスサイズに合わせた描画用 Graphics を初期化する。
    init(p: p5): void {
        this.renderTexture = p.createGraphics(p.width, p.height);
    }

    // getTexture は初期化済みの描画バッファを返し、未初期化時はエラーとする。
    getTexture(): p5.Graphics {
        const texture = this.renderTexture;
        if (!texture) {
            throw new Error("Texture not initialized");
        }
        return texture;
    }

    // resize は現在の Graphics を最新のウィンドウサイズに追従させる。
    resize(p: p5): void {
        const texture = this.renderTexture;
        if (!texture) {
            throw new Error("Texture not initialized");
        }
        texture.resizeCanvas(p.width, p.height);
    }

    // update はシーンの更新前に MIDI 状態を反映させる。
    update(_p: p5): void {
    }

    // draw はシーン描画と MIDI デバッグオーバーレイを Graphics 上にまとめて描画する。
    draw(p: p5, font: p5.Font): void {
        const texture = this.renderTexture;
        if (!texture) {
            throw new Error("Texture not initialized");
        }

        texture.push();
        texture.clear();
        texture.textFont(font);
        texture.textAlign(p.CENTER, p.CENTER);
        texture.fill(255);
        texture.textSize(32);
        texture.text("UI Manager Placeholder", texture.width / 2, texture.height / 2);
        texture.pop();
    }
}