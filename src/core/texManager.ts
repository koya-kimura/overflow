import p5 from "p5";

import { BPMManager } from "../rhythm/BPMManager";
import { bandManager } from "../scenes/bandManager";
import { APCMiniMK2Manager } from "../midi/apcmini_mk2/APCMiniMK2Manager";

// TexManager は描画用の p5.Graphics とシーン、MIDI デバッグ描画のハブを担当する。
export class TexManager {
    private renderTexture: p5.Graphics | null;
    private bpmManager: BPMManager;
    private bandManager: bandManager;
    public sceneMatrix: APCMiniMK2Manager

    // コンストラクタではデバッグ用シーン管理と MIDI ハンドラをセットアップする。
    constructor() {
        this.renderTexture = null;
        this.bpmManager = new BPMManager();
        this.bandManager = new bandManager();
        // this.midiFallback = new APCMiniMK2ToggleMatrix();
        this.sceneMatrix = new APCMiniMK2Manager();
    }

    // init はキャンバスサイズに合わせた描画用 Graphics を初期化する。
    init(p: p5): void {
        this.renderTexture = p.createGraphics(p.width, p.height);

        this.sceneMatrix.setMaxOptionsForScene(0, [7, 7, 7, 7, 7, 7, 7, 7]);
        this.sceneMatrix.setMaxOptionsForScene(1, [7, 7, 7, 7, 7, 7, 7, 7]);
        this.sceneMatrix.setMaxOptionsForScene(2, [7, 7, 7, 7, 7, 7, 7, 7]);
        this.sceneMatrix.setMaxOptionsForScene(3, [7, 7, 7, 7, 7, 7, 7, 7]);
        this.sceneMatrix.setMaxOptionsForScene(4, [7, 7, 7, 7, 7, 7, 7, 7]);
        this.sceneMatrix.setMaxOptionsForScene(5, [7, 7, 7, 7, 7, 7, 7, 7]);
        this.sceneMatrix.setMaxOptionsForScene(6, [7, 7, 7, 7, 7, 7, 7, 7]);
        this.sceneMatrix.setMaxOptionsForScene(7, [7, 7, 7, 7, 7, 7, 7, 7]);
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
        this.bpmManager.update()
        this.sceneMatrix.update(Math.floor(this.bpmManager.getBeat()))
        // this.midiFallback.update();
    }

    // draw はシーン描画と MIDI デバッグオーバーレイを Graphics 上にまとめて描画する。
    draw(p: p5): void {
        const texture = this.renderTexture;
        if (!texture) {
            throw new Error("Texture not initialized");
        }

        texture.push();
        texture.clear();

        this.bandManager.update(p, this.bpmManager.getBeat(), this.sceneMatrix.getParamValues(0), this.sceneMatrix.getParamValues(1));
        this.bandManager.draw(p, texture, this.bpmManager.getBeat());
        texture.pop();

        // this.sceneMatrix.drawDebug(p, texture, 24, 24);
    }

    keyPressed(keyCode: number): void {
        if (keyCode == 13) {
            this.bpmManager.tapTempo();
        }
    }
}