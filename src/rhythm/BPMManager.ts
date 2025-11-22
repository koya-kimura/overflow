// BPMManager はビート単位のタイミング制御とタップテンポ機能を提供する。

/**
 * BPM（Beats Per Minute）に基づいてカウントとテンポ同期を管理するクラス。
 * メインループのデルタタイムに基づいてビートを正確に計測します。
 */
export class BPMManager {
    private bpm: number;          // 現在のBPM値
    private interval: number;     // 1ビートあたりのミリ秒間隔 (60000 / BPM)
    private lastUpdateTime: number; // 最後に update が実行された時刻
    private elapsed: number;      // 現在のビート内で経過したミリ秒
    private beatCount: number;    // 経過したビートの総数 (整数)
    private isPlaying: boolean;   // 再生中フラグ
    private isBeatUpdated: boolean = false; // 直前の update でビートが更新されたか

    private pendingBPM: number | null = null;   // 次のビートで適用される予定のBPM
    private pendingBPMChange: boolean = false; // BPM変更が予約されたか

    private tapTimes: number[] = [];           // タップされた時刻の履歴
    private readonly TAP_HISTORY_SIZE: number = 4; // テンポ計算に使うタップ数の最大値
    private readonly TAP_TIMEOUT: number = 2000;   // 連続タップが途切れるまでのミリ秒

    /**
     * BPMManagerクラスのコンストラクタです。
     * 初期BPMを設定し、それに基づいた1ビートあたりの時間間隔（ミリ秒）を計算します。
     * また、ビートカウントや再生状態などの内部変数を初期化し、
     * 即座にstartメソッドを呼び出して計測を開始します。
     * デフォルトのBPMは120ですが、引数で任意の値を指定可能です。
     * アプリケーションの起動と同時にリズム管理が始まるように設計されています。
     *
     * @param initialBPM 初期BPM値（デフォルト: 120）。
     */
    constructor(initialBPM: number = 120) {
        this.bpm = initialBPM;
        this.interval = 60000 / initialBPM;
        this.beatCount = 0;
        this.isPlaying = false;
        this.lastUpdateTime = 0;
        this.elapsed = 0;

        this.start();
    }

    // --- BPM管理機能 ---

    /**
     * 新しいBPM値を設定します。
     * ただし、即座に変更を適用するのではなく、次のビートのタイミングまで変更を保留します。
     * これは、演奏中やアニメーション中に急激にリズムが変わることで生じる
     * 視覚的・聴覚的な違和感（グリッチ）を防ぐためです。
     * 変更は `pendingBPM` に保存され、`update` メソッド内で適切なタイミングで適用されます。
     * 既に同じBPMが設定されている場合は何もしません。
     *
     * @param newBPM 設定したい新しいBPM値。
     */
    public setBPM(newBPM: number): void {
        if (newBPM !== this.bpm) {
            this.pendingBPM = newBPM;
            this.pendingBPMChange = true;
            console.log(`BPM change to ${newBPM} scheduled for the next beat.`);
        }
    }

    /**
     * ビートの計測（再生）を開始します。
     * 停止状態から再開する場合や、初期化時に呼び出されます。
     * 内部のタイマー基準点（lastUpdateTime）を現在時刻にリセットし、
     * ビートカウントを0に戻します。
     * これにより、曲の頭出しのような挙動になります。
     * 既に再生中の場合は何もしません。
     */
    public start(): void {
        if (!this.isPlaying) {
            this.isPlaying = true;
            this.lastUpdateTime = performance.now();
            this.beatCount = 0;
            console.log("BPM Manager started.");
        }
    }

    /**
     * ビートの計測を停止します。
     * isPlayingフラグをfalseに設定し、updateメソッドでの計算をスキップさせます。
     * 一時停止機能として使用されます。
     * 再度 start() を呼ぶと、カウントはリセットされて再開されます。
     */
    public stop(): void {
        this.isPlaying = false;
        console.log("BPM Manager stopped.");
    }

    /**
     * 毎フレーム呼び出される更新処理です。
     * 現在時刻と前回の更新時刻の差分（デルタタイム）を計算し、経過時間（elapsed）に加算します。
     * 経過時間が1ビートの間隔（interval）を超えた場合、ビートカウントを増やし、
     * 経過時間をリセット（剰余演算）します。
     * また、このタイミングで保留されていたBPM変更があれば適用します。
     * これにより、フレームレートに依存せず、実時間に基づいた正確なリズム管理を実現します。
     * ビートが更新されたフレームでは isBeatUpdated フラグを true にします。
     */
    public update(): void {
        const currentTime = performance.now();
        if (!this.isPlaying) {
            this.isBeatUpdated = false;
            return;
        }

        const delta = currentTime - this.lastUpdateTime;
        this.elapsed += delta;
        this.lastUpdateTime = currentTime;

        this.isBeatUpdated = false;

        // 経過時間がインターバルを超えたかチェック
        if (this.elapsed >= this.interval) {
            const beatIncrements = Math.floor(this.elapsed / this.interval);
            this.beatCount += beatIncrements;
            this.elapsed %= this.interval; // 次のビート開始までの残り時間を計算

            // 予約されたBPM変更を適用
            if (this.pendingBPMChange && this.pendingBPM !== null) {
                this.bpm = this.pendingBPM;
                this.interval = 60000 / this.bpm;
                this.pendingBPM = null;
                this.pendingBPMChange = false;
                console.log(`BPM successfully changed to ${this.bpm}`);
            }

            this.isBeatUpdated = true;
        }
    }

    /**
     * 現在の累積ビート数を浮動小数点数で取得します。
     * 整数部分はこれまでに経過した総ビート数、小数部分は現在のビート内の進行度（0.0〜1.0未満）を表します。
     * この値を使用することで、ビートに同期した滑らかなアニメーション
     * （例えば、sin(beat * PI) での点滅や移動など）を実装することができます。
     *
     * @returns 現在の累積ビート数（浮動小数点数）。
     */
    public getBeat(): number {
        return this.beatCount + (this.elapsed / this.interval);
    }

    /**
     * 直前のフレームでビートが更新された（整数カウントが増加した）かどうかを取得します。
     * 「ジャスト」のタイミングでイベントを発火させたい場合（例：シーンの切り替え、効果音の再生）に便利です。
     * このフラグは update() が呼ばれるたびにリセット・再計算されるため、
     * 1フレームの間だけ true になります。
     *
     * @returns ビート更新フレームであれば true。
     */
    public isBeatUpdatedNow(): boolean {
        return this.isBeatUpdated;
    }

    /**
     * 現在設定されているBPM値を取得します。
     * UI表示や、他のコンポーネントが現在のテンポを知るために使用します。
     * 保留中の変更がある場合でも、現在適用されている値を返します。
     *
     * @returns 現在のBPM値。
     */
    public getBPM(): number {
        return this.bpm;
    }

    // --- タップテンポ機能 ---

    /**
     * タップテンポ機能のエントリーポイントです。
     * ユーザー入力（キー押下やボタンクリックなど）があったタイミングで呼び出されます。
     * 現在時刻を記録し、過去のタップ履歴に追加します。
     * 一定時間（TAP_TIMEOUT）以上間隔が空いた場合は、新しいセッションとして履歴をリセットします。
     * 履歴が2回以上蓄積されると、calculateBPMFromTapsを呼び出してBPMを再計算します。
     * これにより、直感的な操作で楽曲のテンポに合わせることができます。
     */
    public tapTempo(): void {
        const currentTime = performance.now();

        // タイムアウトした場合は履歴をリセット
        if (this.tapTimes.length > 0 && currentTime - this.tapTimes[this.tapTimes.length - 1] > this.TAP_TIMEOUT) {
            console.log('Tap tempo history reset due to timeout.');
            this.tapTimes = [];
        }

        this.tapTimes.push(currentTime);

        // 履歴を最大サイズに維持
        if (this.tapTimes.length > this.TAP_HISTORY_SIZE) {
            this.tapTimes.shift();
        }

        // 2回以上のタップがあればBPMを計算
        if (this.tapTimes.length >= 2) {
            this.calculateBPMFromTaps();
        }
    }

    /**
     * 蓄積されたタップ履歴に基づいて平均BPMを計算し、適用します。
     * 隣り合うタップ時刻の差分（インターバル）を計算し、それらの平均値を求めます。
     * その平均インターバルからBPM（1分間の拍数）を算出し、setBPMメソッドを通じて設定します。
     * 履歴の数が多いほど平均化されて安定しますが、TAP_HISTORY_SIZEで制限することで
     * テンポの変化に対する追従性も確保しています。
     */
    private calculateBPMFromTaps(): void {
        if (this.tapTimes.length < 2) return;

        const intervals: number[] = [];
        for (let i = 1; i < this.tapTimes.length; i++) {
            intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
        }

        const sum = intervals.reduce((a, b) => a + b, 0);
        const averageInterval = sum / intervals.length;

        // BPM = 60000ms / 平均インターバル(ms)
        const newBPM = Math.round(60000 / averageInterval);

        console.log(`Calculated new BPM: ${newBPM}`);
        this.setBPM(newBPM);
    }
}