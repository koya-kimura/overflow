import p5 from "p5";

export class VertText {
    /**
     * 文字列を縦書きで描画します。
     * 通常のtext関数は横書きのみ対応しているため、この関数では1文字ずつ位置を計算して
     * 縦方向に並べることで縦書きを実現しています。
     * 特筆すべき点として、「ー」（長音記号）が含まれる場合、
     * 単に縦に並べるだけでは不自然になるため、90度回転させて縦書き用の表記に変換しています。
     * CENTERモードを指定すると、文字列全体の中心が指定座標に来るようにオフセット調整されます。
     * 日本語の縦書き表現や、サイバーパンク的なUIデザインなどで使用されます。
     *
     * @param p p5.jsのインスタンス（定数やtextAlignモードの使用に必要）。
     * @param tex 描画対象のGraphicsオブジェクト。
     * @param text 描画する文字列。
     * @param x 描画開始位置（または中心位置）のX座標。
     * @param y 描画開始位置（または中心位置）のY座標。
     * @param mode 描画モード。"CORNER"（上揃え）または"CENTER"（中央揃え）。
     */
    static vertText(p: p5, tex: p5.Graphics, text: string, x: number, y: number, mode: string = "CORNER"): void {
        const characters = text.split("");
        const space = tex.textWidth("W") * 1.2;

        tex.push();
        if (mode === "CENTER") {
            const totalHeight = space * (characters.length - 1);
            tex.translate(0, -totalHeight * 0.5);
        }
        for (let i = 0; i < characters.length; i++) {
            const tx = x + (mode == "CENTER" ? 0 : space * 0.5);
            const ty = y + i * space;
            const char = characters[i];
            tex.push();
            tex.textAlign(p.CENTER, p.CENTER);
            tex.translate(tx, ty);
            if (char === "ー") {
                tex.rotate(Math.PI / 2);
            }
            tex.text(char, 0, 0);
            tex.pop();
        }
        tex.pop();
    }
}