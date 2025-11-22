import p5 from "p5";

import { BPMManager } from "../rhythm/BPMManager";
import { BandManager } from "../scenes/bandManager";
import { APCMiniMK2Manager } from "../midi/apcmini_mk2/APCMiniMK2Manager";
import { ColorPalette } from "../utils/colorPalette";

// TexManager は描画用の p5.Graphics とシーン、MIDI デバッグ描画のハブを担当する。
export class TexManager {
    private renderTexture: p5.Graphics | null;
    private bpmManager: BPMManager;
    private bandManager: BandManager;
    public sceneMatrix: APCMiniMK2Manager

    // コンストラクタではデバッグ用シーン管理と MIDI ハンドラをセットアップする。
    constructor() {
        this.renderTexture = null;
        this.bpmManager = new BPMManager();
        this.bandManager = new BandManager();
        // this.midiFallback = new APCMiniMK2ToggleMatrix();
        this.sceneMatrix = new APCMiniMK2Manager();
    }

    // init はキャンバスサイズに合わせた描画用 Graphics を初期化する。
    init(p: p5): void {
        this.renderTexture = p.createGraphics(p.width, p.height);

        this.sceneMatrix.setMaxOptionsForScene(0, [6, 5, 7, 7, 4, 0, 0, 0]);
        this.sceneMatrix.setMaxOptionsForScene(1, [6, 7, 4, 7, 4, 4, 0, 0]);
        this.sceneMatrix.setMaxOptionsForScene(2, [2, 2, 2, 2, 2, 2, 2, 2]);
        this.sceneMatrix.setMaxOptionsForScene(3, [0, 0, 0, 0, 0, 0, 0, 0]);
        this.sceneMatrix.setMaxOptionsForScene(4, [0, 0, 0, 0, 0, 0, 0, 0]);
        this.sceneMatrix.setMaxOptionsForScene(5, [0, 0, 0, 0, 0, 0, 0, 0]);
        this.sceneMatrix.setMaxOptionsForScene(6, [3, 5, 0, 0, 0, 0, 0, 0]);
        this.sceneMatrix.setMaxOptionsForScene(7, [2, 0, 0, 0, 0, 0, 0, 0]);
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

        const beat = this.bpmManager.getBeat();
        const bandParams = this.sceneMatrix.getParamValues(0);
        const numberParams = this.sceneMatrix.getParamValues(1);
        const palette = this.getColorPalette();

        this.bandManager.update(p, beat, bandParams, numberParams, palette);
        this.bandManager.draw(p, texture, beat);
        texture.pop();

        // this.sceneMatrix.drawDebug(p, texture, 24, 24);
    }

    getBandManager(): BandManager {
        return this.bandManager;
    }

    getColorPalette(): string[] {
        const colorPaletteBooleanArray = this.sceneMatrix.getParamValues(2).map(value => value == 0);
        return ColorPalette.getColorArray(colorPaletteBooleanArray);
    }

    getColorPaletteRGB(): number[] {
        const colorPaletteBooleanArray = this.sceneMatrix.getParamValues(2).map(value => value == 0);
        return ColorPalette.getColorRGBArray(colorPaletteBooleanArray)
    }

    keyPressed(keyCode: number): void {
        if (keyCode == 13) {
            this.bpmManager.tapTempo();
        }
    }

    getParamsRow(row: number = 7): number[] {
        return this.sceneMatrix.getParamValues(row);
    }

    getBPM(): number {
        return this.bpmManager.getBPM();
    }

    getBeat(): number {
        return this.bpmManager.getBeat();
    }
}