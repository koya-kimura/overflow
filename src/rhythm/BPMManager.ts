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

    // constructor は初期 BPM を設定しカウントを開始する。
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
     * 新しいBPM値を設定し、次のビートの開始時に適用されるように予約します。
     */
    public setBPM(newBPM: number): void {
        if (newBPM !== this.bpm) {
            this.pendingBPM = newBPM;
            this.pendingBPMChange = true;
            console.log(`BPM change to ${newBPM} scheduled for the next beat.`);
        }
    }

    /**
     * カウントを開始します。
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
     * カウントを停止します。
     */
    public stop(): void {
        this.isPlaying = false;
        console.log("BPM Manager stopped.");
    }

    /**
     * メインループから毎フレーム呼び出され、ビートを更新します。
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
     * 現在のビートを連続的な値で取得します。
     */
    public getBeat(): number {
        return this.beatCount + (this.elapsed / this.interval);
    }

    /**
     * 直前の update() でビート更新（整数値のカウントアップ）があったかを取得します。
     */
    public isBeatUpdatedNow(): boolean {
        return this.isBeatUpdated;
    }

    /**
     * 現在のBPM値を取得します。
     */
    public getBPM(): number {
        return this.bpm;
    }

    // --- タップテンポ機能 ---

    /**
     * テンポをタップします。
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
     * タップ履歴から平均インターバルを計算し、新しいBPMを設定します。
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