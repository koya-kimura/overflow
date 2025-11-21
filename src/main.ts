// main.ts は p5 スケッチのエントリーポイントとして描画ループを構成する。
import p5 from "p5";

import { TexManager } from "./core/texManager";
import { UIManager } from "./core/uiManager";
import { EffectManager } from "./core/effectManager";

const texManager = new TexManager();
const uiManager = new UIManager();
const effectManager = new EffectManager();

let font: p5.Font;

// sketch は p5 インスタンスモードで実行されるエントリー関数。
const sketch = (p: p5) => {
  // setup は一度だけ呼ばれ、レンダーターゲットとシェーダーを初期化する。
  p.setup = async () => {
    const canvas = p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
    canvas.parent("canvas-container");
    texManager.init(p);
    uiManager.init(p);

    font = await p.loadFont("/font/Jost-Regular.ttf");
    await effectManager.load(
      p,
      "/shader/post.vert",
      "/shader/post.frag",
    );
  };

  // draw は毎フレームのループでシーン更新とポストエフェクトを適用する。
  p.draw = () => {
    p.background(0);

    texManager.update(p);
    texManager.draw(p);

    uiManager.update(p, texManager.getParamsLastRow(), texManager.getBPM());
    uiManager.draw(p, font);

    effectManager.apply(p, texManager.getTexture(), uiManager.getTexture(), texManager.sceneMatrix.faderValues);
  };

  // windowResized はブラウザのリサイズに追従してバッファを更新する。
  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    texManager.resize(p);
    uiManager.resize(p);
  };

  // keyPressed はスペースキーでフルスクリーンを切り替えるショートカットを提供。
  p.keyPressed = () => {
    if (p.keyCode === 32) {
      p.fullscreen(true);
    }
    texManager.keyPressed(p.keyCode);
  };
};

// p5.js スケッチを起動する。
new p5(sketch);