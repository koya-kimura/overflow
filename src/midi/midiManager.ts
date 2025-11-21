// src/midi/midiManager.ts

/**
 * MIDIデバイスの管理を行う基底クラス
 */
export class MIDIManager {
    private midiOutput: WebMidi.MIDIOutput | null = null;
    public onMidiMessageCallback: ((message: WebMidi.MIDIMessageEvent) => void) | null = null;

    constructor() {
        this.initialize();
    }

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

    public sendMessage(data: number[]): void {
        if (this.midiOutput) {
            this.midiOutput.send(data);
        }
    }

    protected onMidiAvailabilityChanged(_available: boolean): void {
        // Override in subclass
    }
}