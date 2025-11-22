import p5 from "p5";

export class SpaceText {
    /**
     * 文字間隔（トラッキング/カーニング）を調整してテキストを描画します。
     * 通常のtext関数では文字間隔の制御が難しい場合がありますが、
     * この関数は文字列を1文字ずつ分解し、指定されたスケール（spaceScale）に基づいて
     * 手動で配置することで、広がりや凝縮感のあるテキスト表現を可能にします。
     * "W"の文字幅を基準として間隔を計算しており、等幅フォントに近い配置になります。
     * CENTERモードを指定すると、テキスト全体の中央揃えも自動的に計算されます。
     *
     * @param tex 描画対象のGraphicsオブジェクト。
     * @param text 描画する文字列。
     * @param x 描画開始位置（または中心位置）のX座標。
     * @param y 描画位置のY座標。
     * @param spaceScale 文字間隔のスケール係数（1.0が標準、大きいほど広がる）。
     * @param mode 描画モード。"CORNER"（左揃え）または"CENTER"（中央揃え）。
     */
    static spaceText(tex: p5.Graphics, text: string, x: number, y: number, spaceScale: number, mode: string = "CORNER"): void {
        const characters = text.split("");
        const space = tex.textWidth("W") * 0.9;
        let currentX = x;

        if (mode === "CENTER") {
            const totalWidth = space * spaceScale * (characters.length - 1);
            currentX = x - totalWidth / 2;
        }

        characters.forEach((char) => {
            tex.text(char, currentX, y);
            const charWidth = space;
            currentX += charWidth * spaceScale;
        });
    }
}