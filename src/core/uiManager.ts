import p5 from "p5";
import { DateText } from "../utils/dateText";
import { Easing } from "../utils/easing";

type UIDrawFunction = (p: p5, tex: p5.Graphics, font: p5.Font, beat: number, bpm: number) => void;

/**
 * UI描画関数その2（インデックス1）。
 * メインのビジュアルオーバーレイとして機能し、以下の要素を描画します：
 * 1. 中央にアーティスト名（TAKASHIMA & KIMURA）
 * 2. 上下に流れる「OVER!FLOW」のテキストアニメーション
 * 3. 右下に現在のBPMと日付・時刻
 * 4. ビートに合わせて動くインジケーター（矩形）
 * これらはすべてオフスクリーンキャンバス（tex）に描画され、
 * 最終的にメインキャンバスに合成されます。
 *
 * @param context 描画に必要なコンテキスト情報。
 */
const UIDraw01: UIDrawFunction = (p: p5, tex: p5.Graphics, font: p5.Font, beat: number, bpm: number): void => {
    tex.push();
    tex.textFont(font);

    tex.push();
    tex.noStroke();
    tex.textSize(tex.width * 0.015);
    tex.fill(255);
    tex.textAlign(p.LEFT, p.TOP)
    tex.text("DJ：TAKASHIMA", tex.width * 0.03, tex.height * 0.1);

    tex.textAlign(p.RIGHT, p.TOP)
    tex.text("KIMURA：VJ", tex.width * 0.97, tex.height * 0.1);
    tex.pop();

    const n = 50;
    for (let j of [-1, 1]) {
        for (let i = 0; i < n; i++) {
            const speed = 10;                   // 流れる速さはお好みで
            const span = tex.width * 1.2;       // ループさせたい幅
            const base = p.map(i, 0, n, -0.1, 1.1) * tex.width;

            const x = ((base - beat * speed) % span + span) % span - tex.width * 0.1;
            const y = tex.height * (0.5 + 0.45 * j);
            const str = [..."OVER!FLOW"][i % 9];

            tex.push();
            tex.fill(255);
            tex.noStroke();
            tex.textSize(tex.width / n * 0.95);
            tex.textAlign(p.CENTER, p.CENTER);
            tex.text(str, x, y);
            tex.pop();
        }
    }

    tex.push();
    tex.textAlign(p.RIGHT, p.BOTTOM);
    tex.fill(255);
    tex.noStroke();
    tex.textSize(tex.width * 0.015);
    const dateText = DateText.getYYYYMMDD_HHMMSS_format();
    tex.text(`BPM: ${bpm.toFixed(1)}`, tex.width * 0.97, tex.height * 0.86);
    tex.text(`DATE: ${dateText}`, tex.width * 0.97, tex.height * 0.9);
    tex.pop();

    tex.push();
    tex.noFill();
    tex.stroke(255);
    tex.rect(tex.width * 0.03, tex.height * 0.9, tex.width * 0.1, -tex.height * 0.04);

    const x = p.map(Easing.zigzag(beat / 2), 0, 1, 0, tex.width * 0.1 - tex.width * 0.01);
    tex.noStroke();
    tex.fill(255);
    tex.rect(tex.width * 0.03 + x, tex.height * 0.9, tex.width * 0.01, -tex.height * 0.04);
    tex.pop();

    tex.pop();
}

const UIDRAWERS: readonly UIDrawFunction[] = [
    UIDraw01,
];

// UIManager は単純なテキストオーバーレイの描画を担当する。
export class UIManager {
    private renderTexture: p5.Graphics | undefined;
    private activePatternIndex: number;

    /**
     * UIManagerクラスのコンストラクタです。
     * UI描画用のテクスチャ（Graphicsオブジェクト）の初期化状態を管理し、
     * 現在アクティブなUI描画パターンのインデックスを初期化します。
     * デフォルトではインデックス0（何も表示しないパターン）が選択されます。
     * このクラスは、複数のUIデザインを切り替えて表示するための管理機能を提供します。
     */
    constructor() {
        this.renderTexture = undefined;
        this.activePatternIndex = 0;
    }

    /**
     * UIマネージャーの初期化処理を行います。
     * p5.jsのインスタンスを使用して、画面サイズと同じ大きさの
     * オフスクリーンキャンバス（Graphicsオブジェクト）を作成します。
     * このキャンバスは、UI要素（テキスト、インジケーターなど）の描画先として使用され、
     * メインの描画ループで最終的な画面に重ね合わせられます。
     *
     * @param p p5.jsのインスタンス。
     */
    init(p: p5): void {
        this.renderTexture = p.createGraphics(p.width, p.height);
    }

    /**
     * 現在のUI描画用テクスチャを取得します。
     * このテクスチャには、現在選択されているUIパターンによって描画された
     * すべてのUI要素が含まれています。
     * テクスチャが未初期化の場合（init呼び出し前）はエラーをスローし、
     * 不正な状態での使用を防ぎます。
     *
     * @returns UI要素が描画されたp5.Graphicsオブジェクト。
     * @throws Error テクスチャが初期化されていない場合。
     */
    getTexture(): p5.Graphics {
        const texture = this.renderTexture;
        if (!texture) {
            throw new Error("Texture not initialized");
        }
        return texture;
    }

    /**
     * ウィンドウサイズ変更時に呼び出され、UI描画用テクスチャのサイズを更新します。
     * メインキャンバスのサイズ変更に合わせて、UI用のオフスクリーンキャンバスも
     * 同じサイズにリサイズします。
     * これにより、UI要素の配置やサイズが新しい画面サイズに対して
     * 適切に計算・描画されることを保証します。
     *
     * @param p p5.jsのインスタンス。
     */
    resize(p: p5): void {
        const texture = this.renderTexture;
        if (!texture) {
            throw new Error("Texture not initialized");
        }
        texture.resizeCanvas(p.width, p.height);
    }

    /**
     * 毎フレーム呼び出される更新処理です。
     * 外部からの入力パラメータ（主にMIDIコントローラーなどからの信号）を受け取り、
     * UIの状態を更新します。
     * 具体的には、パラメータ配列の最初の要素を使用して、
     * 表示すべきUIパターンのインデックスを決定・更新します。
     * これにより、演奏中に動的にUIのデザインを切り替えることが可能になります。
     *
     * @param _p p5.jsのインスタンス（現在未使用）。
     * @param params UI制御用のパラメータ配列。
     */
    update(_p: p5, params: number[]): void {
        const index = this.normalizePatternIndex(params?.[0]);
        this.activePatternIndex = index;
    }

    /**
     * UIの描画処理を実行します。
     * 現在アクティブなUIパターン（UIDRAWERS配列内の関数）を選択し、
     * 必要なリソース（テクスチャ、フォント、BPM情報など）を渡して実行します。
     * 描画前にはテクスチャのクリアとpush/popによる状態保存を行い、
     * 他の描画処理への影響を防ぎつつ、クリーンな状態でUIを描画します。
     *
     * @param p p5.jsのインスタンス。
     * @param font UI描画に使用するフォント。
     * @param resources その他の描画に必要なリソース群（BPM、ビート、カラーパレットなど）。
     */
    draw(p: p5, font: p5.Font, beat: number, bpm: number): void {
        const texture = this.renderTexture;
        if (!texture) {
            throw new Error("Texture not initialized");
        }

        texture.push();
        texture.clear();
        const drawer = UIDRAWERS[this.activePatternIndex] ?? UIDRAWERS[0];
        drawer(p, texture, font, beat, bpm);

        texture.pop();
    }

    /**
     * 入力されたパターンインデックスを正規化します。
     * 入力値が数値でない、または範囲外の場合に、
     * 安全なデフォルト値（0）や有効範囲内のインデックスに補正します。
     * これにより、不正な入力によるクラッシュやエラーを防ぎ、
     * 常に有効なUI描画関数が選択されることを保証します。
     *
     * @param value 正規化対象のインデックス値（undefinedの可能性あり）。
     * @returns 正規化された有効なインデックス整数。
     */
    private normalizePatternIndex(value: number | undefined): number {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            return 0;
        }
        const clamped = Math.max(0, Math.floor(value));
        return Math.min(UIDRAWERS.length - 1, clamped);
    }
}