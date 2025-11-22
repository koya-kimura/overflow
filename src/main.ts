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
// sketch は p5 インスタンスモードで実行されるエントリー関数。
// p5.jsのライフサイクルメソッド（setup, drawなど）を定義し、
// アプリケーション全体の初期化と更新ループを管理します。
const sketch = (p: p5) => {
  // setup は一度だけ呼ばれ、レンダーターゲットとシェーダーを初期化する。
  // キャンバスの作成、テクスチャ管理、UI管理、エフェクト管理の初期化、
  // および外部リソース（フォント、シェーダー）の非同期読み込みを行います。
  p.setup = async () => {
    const canvas = p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
    p.noCursor(); // カーソルを非表示にする
    p.pixelDensity(1); // 高解像度ディスプレイ対応
    canvas.parent("canvas-container");

    // 各マネージャーの初期化
    texManager.init(p);
    uiManager.init(p);

    // カメラキャプチャ用のバッファと要素の作成
    captureTexture = p.createGraphics(p.windowWidth, p.windowHeight);
    capture = p.createCapture((p as any).VIDEO);
    capture.hide(); // HTML要素としてのビデオは隠す

    // リソースの読み込み
    font = await p.loadFont("/font/Jost-Regular.ttf");
    await effectManager.load(
      p,
      "/shader/post.vert",
      "/shader/post.frag",
    );
  };

  // draw は毎フレームのループでシーン更新とポストエフェクトを適用する。
  // 1. カメラ入力の更新と描画
  // 2. テクスチャマネージャー（シーン描画）の更新
  // 3. UIマネージャー（オーバーレイ情報）の更新
  // 4. エフェクトマネージャーによるポストプロセスの適用（最終出力）
  p.draw = () => {
    // p.background(0);
    p.clear();

    // カメラ映像のアスペクト比維持とセンタリング
    const scl = Math.max(p.width / capture.width, p.height / capture.height);
    captureTexture.clear();
    captureTexture.push();
    captureTexture.translate(p.width / 2, p.height / 2);
    captureTexture.scale(-1 * scl, 1 * scl); // 左右反転とスケール調整
    captureTexture.imageMode(p.CENTER);
    captureTexture.image(capture, 0, 0);
    captureTexture.pop();

    // シーンの更新と描画
    texManager.update(p);
    texManager.draw(p);

    // UIの更新と描画
    uiManager.update(p, texManager.getParamsRow(7));
    uiManager.draw(p, font, texManager.getBeat(), texManager.getBPM());

    // ポストエフェクトの適用と画面への描画
    effectManager.apply(p, texManager.getTexture(), uiManager.getTexture(), captureTexture, texManager.sceneMatrix.faderValues, texManager.getParamsRow(6), texManager.getBeat(), texManager.getColorPaletteRGB());
  };

  // windowResized はブラウザのリサイズに追従してバッファを更新する。
  // キャンバスサイズをウィンドウサイズに合わせ、
  // テクスチャマネージャーとUIマネージャーにもリサイズを通知します。
  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    texManager.resize(p);
    uiManager.resize(p);
  };

  // keyPressed はキー入力イベントを処理する。
  // スペースキーでフルスクリーンモードの切り替えを行い、
  // その他のキー入力はテクスチャマネージャー（シーン切り替えなど）に伝播させます。
  p.keyPressed = () => {
    if (p.keyCode === 32) {
      p.fullscreen(true);
    }
    texManager.keyPressed(p.keyCode);
  };
};

// p5.js スケッチを起動する。
new p5(sketch);