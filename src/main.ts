// main.ts は p5 スケッチのエントリーポイントとして描画ループを構成する。
import p5 from "p5";

import { TexManager } from "./core/texManager";
import { EffectManager } from "./core/effectManager";

const texManager = new TexManager();
const effectManager = new EffectManager();

// sketch は p5 インスタンスモードで実行されるエントリー関数。
const sketch = (p: p5) => {
  // setup は一度だけ呼ばれ、レンダーターゲットとシェーダーを初期化する。
  p.setup = async () => {
    p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
    texManager.init(p);

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

    effectManager.apply(p, texManager.getTexture());
  };

  // windowResized はブラウザのリサイズに追従してバッファを更新する。
  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    texManager.resize(p);
  };

  // keyPressed はスペースキーでフルスクリーンを切り替えるショートカットを提供。
  p.keyPressed = () => {
    if (p.keyCode === 32) {
      p.fullscreen(true);
    }
  };
};

// p5.js スケッチを起動する。
new p5(sketch);