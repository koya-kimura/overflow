import p5 from "p5";

import { BPMManager } from "../rhythm/BPMManager";
import { bandManager } from "../scenes/bandManager";
import { APCMiniMK2ToggleMatrix } from "../midi/apcmini_mk2/APCMiniMK2ToggleMatrix";
// import type { Scene } from "../scenes/Scene";
import { APCMiniMK2SceneMatrix } from "../midi/apcmini_mk2/APCMiniMK2SceneMatrix";

// TexManager は描画用の p5.Graphics とシーン、MIDI デバッグ描画のハブを担当する。
export class TexManager {
    private renderTexture: p5.Graphics | null;
    private bpmManager: BPMManager;
    private bandManager: bandManager;
    private readonly midiFallback: APCMiniMK2ToggleMatrix;
    private readonly sceneMatrix: APCMiniMK2SceneMatrix;

    // コンストラクタではデバッグ用シーン管理と MIDI ハンドラをセットアップする。
    constructor() {
        this.renderTexture = null;
        this.bpmManager = new BPMManager();
        this.bandManager = new bandManager();
        this.midiFallback = new APCMiniMK2ToggleMatrix();
        this.sceneMatrix = new APCMiniMK2SceneMatrix();
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
        this.bpmManager.update();
        this.sceneMatrix.update();
        this.midiFallback.update();
    }

    // draw はシーン描画と MIDI デバッグオーバーレイを Graphics 上にまとめて描画する。
    draw(p: p5): void {
        const texture = this.renderTexture;
        if (!texture) {
            throw new Error("Texture not initialized");
        }

        texture.push();
        texture.clear();

        this.bandManager.update(p);
        this.bandManager.draw(p, texture, this.bpmManager.getBeat());
        texture.pop();

        this.sceneMatrix.drawDebug(p, texture, 24, 24);
    }

    keyPressed(keyCode: number): void {
        if (keyCode == 13){
            this.bpmManager.tapTempo();
        }
    }
}