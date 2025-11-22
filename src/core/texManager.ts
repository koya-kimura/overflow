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

    /**
     * TexManagerクラスのコンストラクタです。
     * ここでは、描画に使用するテクスチャの初期化（null設定）と、
     * リズム管理を行うBPMManager、バンド描画を行うBandManager、
     * そしてMIDIコントローラー（APC Mini MK2）との連携を行うAPCMiniMK2Managerの
     * インスタンス生成を行います。
     * これにより、アプリケーション全体の描画と制御の基盤を構築します。
     * 各マネージャーはそれぞれの責務（リズム、描画、入力制御）を独立して担います。
     */
    constructor() {
        this.renderTexture = null;
        this.bpmManager = new BPMManager();
        this.bandManager = new BandManager();
        this.sceneMatrix = new APCMiniMK2Manager();
    }

    /**
     * アプリケーションの初期化処理を行います。
     * p5.jsのインスタンスを受け取り、画面サイズに合わせた描画用Graphics（オフスクリーンキャンバス）を作成します。
     * また、APCMiniMK2Managerに対して、各シーン（行）ごとのパラメータの最大値を設定します。
     * これにより、MIDIコントローラーの各フェーダーやボタンが制御できる値の範囲を定義し、
     * シーンごとの挙動（バンドの数、色、動きなど）をカスタマイズ可能にします。
     * 特定のシーンインデックスに対して、配列形式で最大値を指定しています。
     *
     * @param p p5.jsのインスタンス。createGraphicsなどの描画機能を使用するために必要です。
     */
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

    /**
     * 現在の描画用テクスチャ（Graphicsオブジェクト）を取得します。
     * このテクスチャは、メインの描画ループで生成されたコンテンツを保持しており、
     * ポストエフェクトの適用や最終的なキャンバスへの描画に使用されます。
     * もしテクスチャが初期化されていない場合（initが呼ばれる前など）は、
     * エラーをスローして開発者に通知します。
     * これにより、未初期化状態での不正なアクセスを防ぎます。
     *
     * @returns 描画内容を含むp5.Graphicsオブジェクト。
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
     * ウィンドウサイズが変更された際に呼び出され、描画用テクスチャのサイズを更新します。
     * p5.jsのresizeCanvasメソッドを使用して、内部のGraphicsオブジェクトのサイズを
     * 新しいウィンドウの幅と高さに合わせます。
     * これにより、レスポンシブな描画が可能になり、ウィンドウサイズが変わっても
     * 描画内容が適切にスケーリングまたは再配置される準備を整えます。
     * テクスチャが未初期化の場合はエラーをスローします。
     *
     * @param p p5.jsのインスタンス。現在のウィンドウサイズ情報を含みます。
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
     * 主にリズム管理（BPMManager）とMIDI入力管理（APCMiniMK2Manager）の状態を更新します。
     * BPMManagerで現在の時間を進め、ビート情報を計算します。
     * その後、計算されたビート情報（整数部分）をAPCMiniMK2Managerに渡し、
     * MIDIコントローラーのLEDフィードバックや入力状態の同期を行います。
     * これにより、音楽的なタイミングとユーザー入力の同期を保ちます。
     *
     * @param _p p5.jsのインスタンス（現在は未使用ですが、将来的な拡張のために引数として保持）。
     */
    update(_p: p5): void {
        this.bpmManager.update()
        this.sceneMatrix.update(Math.floor(this.bpmManager.getBeat()))
    }

    /**
     * メインの描画処理を行います。
     * オフスクリーンキャンバス（renderTexture）に対して、背景のクリア、
     * 現在のビート情報の取得、MIDIコントローラーからのパラメータ取得を行います。
     * 取得したパラメータ（バンド設定、数値表示設定、カラーパレット）を用いて、
     * BandManagerを通じて実際のビジュアルを描画します。
     * 最後に、必要に応じてデバッグ情報の描画（コメントアウト中）も行える構造になっています。
     * push/popを使用することで、描画状態の汚染を防いでいます。
     *
     * @param p p5.jsのインスタンス。
     */
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

    /**
     * BandManagerのインスタンスを取得します。
     * BandManagerは、画面上のバンド（帯状のグラフィック）や数値表示などの
     * 主要なビジュアル要素を管理しています。
     * 外部のクラス（例えばデバッグUIや他のマネージャー）が、
     * BandManagerの状態にアクセスしたり、操作したりするために使用されます。
     *
     * @returns 現在のBandManagerインスタンス。
     */
    getBandManager(): BandManager {
        return this.bandManager;
    }

    /**
     * 現在設定されているカラーパレットを16進数カラーコードの配列として取得します。
     * MIDIコントローラーの特定の行（インデックス2）の設定値を読み取り、
     * それをブール値の配列に変換します（0ならtrue、それ以外ならfalseなど）。
     * このブール値配列をColorPaletteクラスの静的メソッドに渡すことで、
     * 現在有効な色の組み合わせ（パレット）を取得します。
     * これにより、ビジュアル全体の色調を動的に変更することができます。
     *
     * @returns カラーコード（例: "#FF0000"）の文字配列。
     */
    getColorPalette(): string[] {
        const colorPaletteBooleanArray = this.sceneMatrix.getParamValues(2).map(value => value == 0);
        return ColorPalette.getColorArray(colorPaletteBooleanArray);
    }

    /**
     * 現在設定されているカラーパレットをRGB値のフラットな配列として取得します。
     * getColorPaletteと同様にMIDIコントローラーの設定値に基づきますが、
     * こちらはシェーダーに渡すために適した形式（[R, G, B, R, G, B, ...]）で返します。
     * 各色成分は0〜1の範囲に正規化されていることが一般的です（ColorPaletteの実装依存）。
     * シェーダーのUniform変数としてカラーパレット情報を渡す際に使用されます。
     *
     * @returns RGB値が順に並んだ数値配列。
     */
    getColorPaletteRGB(): number[] {
        const colorPaletteBooleanArray = this.sceneMatrix.getParamValues(2).map(value => value == 0);
        return ColorPalette.getColorRGBArray(colorPaletteBooleanArray)
    }

    /**
     * キーボード入力イベントを処理します。
     * 特定のキー（現在はEnterキー、keyCode 13）が押された場合に、
     * BPMManagerのタップテンポ機能を呼び出します。
     * これにより、ユーザーがキーボードを叩くリズムに合わせてBPM（テンポ）を設定・調整することができます。
     * ライブパフォーマンス時などに、手動で楽曲のテンポに同期させるために便利です。
     *
     * @param keyCode 押されたキーのコード。
     */
    keyPressed(keyCode: number): void {
        if (keyCode == 13) {
            this.bpmManager.tapTempo();
        }
    }

    /**
     * MIDIコントローラーの特定の行（シーン）におけるパラメータ値の配列を取得します。
     * デフォルトでは7行目のパラメータを取得しますが、引数で任意の行を指定可能です。
     * これらの値は、エフェクトの強度、シーンの切り替え、その他のビジュアル制御に使用されます。
     * 各値は通常0〜127のMIDI値、または正規化された値、あるいはインデックス値など、
     * マネージャーの設定に依存した形式で返されます。
     *
     * @param row 取得したいパラメータの行インデックス（デフォルトは7）。
     * @returns 指定された行のパラメータ値の配列。
     */
    getParamsRow(row: number = 7): number[] {
        return this.sceneMatrix.getParamValues(row);
    }

    /**
     * 現在のBPM（Beats Per Minute）を取得します。
     * BPMManagerが管理している現在のテンポ設定を返します。
     * この値は、アニメーションの速度制御や、時間依存のエフェクト計算などに使用されます。
     * 外部のコンポーネントが現在のテンポを知るためのアクセサです。
     *
     * @returns 現在のBPM値。
     */
    getBPM(): number {
        return this.bpmManager.getBPM();
    }

    /**
     * 現在の累積ビート数を取得します。
     * BPMManagerによって計算された、曲の開始（またはリセット）からの総拍数です。
     * 小数点以下の値も含まれており、滑らかなアニメーション同期に使用できます。
     * 例えば、sin(beat)のように使用して、ビートに同期した周期的な動きを作ることができます。
     *
     * @returns 現在の累積ビート数。
     */
    getBeat(): number {
        return this.bpmManager.getBeat();
    }
}