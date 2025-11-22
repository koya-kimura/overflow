// src/midi/midiManager.ts

/**
 * MIDIデバイスの管理を行う基底クラス
 */
export class MIDIManager {
    private midiOutput: WebMidi.MIDIOutput | null = null;
    public onMidiMessageCallback: ((message: WebMidi.MIDIMessageEvent) => void) | null = null;

    /**
     * MIDIManagerクラスのコンストラクタです。
     * インスタンス生成時に自動的に `initialize` メソッドを呼び出し、
     * ブラウザのMIDIアクセス権限の取得と初期設定を開始します。
     * これにより、アプリケーション起動時にスムーズにMIDIデバイスとの接続を試みることができます。
     */
    constructor() {
        this.initialize();
    }

    /**
     * Web MIDI APIの初期化を非同期で行います。
     * まず、ブラウザがWeb MIDI APIをサポートしているかを確認します。
     * サポートされていない場合は警告を出力し、利用不可として処理します。
     * 安定性のために短い待機時間を設けた後、`navigator.requestMIDIAccess` を呼び出して
     * ユーザーにMIDIデバイスへのアクセス許可を求めます。
     * 成功すれば `setupMidi` を呼び出して入出力ポートの設定を行い、
     * 失敗した場合はエラーログを出力して利用不可状態を通知します。
     */
    private async initialize(): Promise<void> {
        // ブラウザのMIDIサポート確認と初期化待ち
        if (!navigator.requestMIDIAccess) {
            console.warn("Web MIDI API is not supported.");
            this.onMidiAvailabilityChanged(false);
            return;
        }

        // 安定性のために少し待機
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            const access = await navigator.requestMIDIAccess();
            this.setupMidi(access);
        } catch (err) {
            console.error("MIDI Access Failed:", err);
            this.onMidiAvailabilityChanged(false);
        }
    }

    /**
     * 取得したMIDIAccessオブジェクトを使用して、MIDI入出力ポートの設定を行います。
     * 現在の実装では、最初に見つかった入力ポートと出力ポートを自動的に選択して接続します。
     * 入力ポートが見つかった場合は、`onmidimessage` イベントハンドラを設定し、
     * 受信したMIDIメッセージを `onMidiMessageCallback` に転送するようにします。
     * 出力ポートが見つかった場合は、それを `midiOutput` プロパティに保存し、
     * MIDI送信が可能な状態になったことを `onMidiAvailabilityChanged(true)` で通知します。
     * 出力ポートが見つからない場合は警告を出力し、利用不可状態を通知します。
     *
     * @param access requestMIDIAccessから取得したMIDIAccessオブジェクト。
     */
    private setupMidi(access: WebMidi.MIDIAccess): void {
        const input = Array.from(access.inputs.values())[0];
        const output = Array.from(access.outputs.values())[0];

        if (input) {
            console.log(`MIDI Input: ${input.name}`);
            input.onmidimessage = (msg) => {
                this.onMidiMessageCallback?.(msg);
            };
        }

        if (output) {
            console.log(`MIDI Output: ${output.name}`);
            this.midiOutput = output;
            this.onMidiAvailabilityChanged(true);
        } else {
            console.warn("MIDI Output not found.");
            this.onMidiAvailabilityChanged(false);
        }
    }

    /**
     * MIDIメッセージを送信します。
     * 接続されたMIDI出力ポートに対して、指定されたバイト配列（MIDIデータ）を送信します。
     * MIDI出力ポートが未接続の場合は何もしません。
     * ノートオン/オフ、コントロールチェンジなどのMIDIコマンドを送信するために使用されます。
     *
     * @param data 送信するMIDIデータの配列（例: [0x90, 60, 127]）。
     */
    public sendMessage(data: number[]): void {
        if (this.midiOutput) {
            this.midiOutput.send(data);
        }
    }

    /**
     * MIDIデバイスの利用可能性が変化した際に呼び出されるフックメソッドです。
     * サブクラスでオーバーライドして、接続状態に応じた処理（UIの更新、初期化シーケンスの実行など）
     * を実装することを想定しています。
     * デフォルトでは何もしません。
     *
     * @param _available MIDIデバイスが利用可能になった場合は true、そうでなければ false。
     */
    protected onMidiAvailabilityChanged(_available: boolean): void {
        // Override in subclass
    }
}