// main.ts は p5 スケッチのエントリーポイントとして描画ループを構成する。
import p5 from "p5";

import { TexManager } from "./core/texManager";
import { UIManager } from "./core/uiManager";
import { EffectManager } from "./core/effectManager";

const texManager = new TexManager();
const uiManager = new UIManager();
const effectManager = new EffectManager();

let capture: p5.Element;
let captureTexture: p5.Graphics;
let font: p5.Font;

// sketch は p5 インスタンスモードで実行されるエントリー関数。
const sketch = (p: p5) => {
  // setup は一度だけ呼ばれ、レンダーターゲットとシェーダーを初期化する。
  p.setup = async () => {
    const canvas = p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
    p.noCursor();
    p.pixelDensity(2);
    canvas.parent("canvas-container");
    texManager.init(p);
    uiManager.init(p);

    captureTexture = p.createGraphics(p.windowWidth, p.windowHeight);
    capture = p.createCapture((p as any).VIDEO);
    capture.hide();

    font = await p.loadFont("/font/Jost-Regular.ttf");
    await effectManager.load(
      p,
      "/shader/post.vert",
      "/shader/post.frag",
    );
  };

  // draw は毎フレームのループでシーン更新とポストエフェクトを適用する。
  p.draw = () => {
    // p.background(0);
    p.clear();

    const scl = Math.max(p.width / capture.width, p.height / capture.height);
    captureTexture.clear();
    captureTexture.push();
    captureTexture.translate(p.width/2, p.height/2);
    captureTexture.scale(-1 * scl, 1 * scl);
    captureTexture.imageMode(p.CENTER);
    captureTexture.image(capture, 0, 0);
    captureTexture.pop();

    texManager.update(p);
    texManager.draw(p);

    uiManager.update(p, texManager.getParamsRow(7), texManager.getBPM());
    uiManager.draw(p, font);

    effectManager.apply(p, texManager.getTexture(), uiManager.getTexture(), captureTexture, texManager.sceneMatrix.faderValues, texManager.getParamsRow(6), texManager.getBeat(), texManager.getColorPaletteRGB());
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