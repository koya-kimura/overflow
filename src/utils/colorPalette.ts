export class ColorPalette {
    /**
     * アプリケーション全体で使用可能な基本カラーパレットの定義です。
     * 以下の8色が定義されています：
     * 1. 赤 (#FF0000)
     * 2. オレンジ (#FFA500)
     * 3. 黄色 (#d8d813ff)
     * 4. 緑 (#008000)
     * 5. 青 (#0000FF)
     * 6. インディゴ (#4B0082)
     * 7. 紫 (#800080)
     * 8. シアン (#00FFFF)
     * これらの色は、MIDIコントローラーの入力などに基づいて選択的に使用されます。
     */
    static readonly colors: string[] = [
        "#FF0000",
        "#FFA500",
        "#d8d813ff",
        "#008000",
        "#0000FF",
        "#4B0082",
        "#800080",
        "#00FFFF"
    ];

    /**
     * 指定されたブール値の配列に基づいて、有効な色のリスト（16進数文字列）を取得します。
     * 引数のbooleanArrayの各要素がtrueの場合、対応するインデックスの色が選択されます。
     * 配列の長さが定義済みの色数を超える場合は、モジュロ演算（%）により色が循環して割り当てられます。
     * もし有効な色が1つも選択されなかった場合（すべてfalseの場合など）は、
     * デフォルトとして白（#FFFFFF）を含む配列を返します。
     * これにより、描画時に色が全くない状態を防ぎます。
     *
     * @param booleanArray 各色が有効かどうかを示すブール値の配列。省略時は全色が有効になります。
     * @returns 有効な色の16進数カラーコード文字列の配列。
     */
    static getColorArray(booleanArray: boolean[] = new Array(this.colors.length).fill(true)): string[] {
        const colorArray: string[] = [];
        for (let i = 0; i < booleanArray.length; i++) {
            if (booleanArray[i]) {
                colorArray.push(this.colors[i % this.colors.length]);
            }
        }
        if (colorArray.length === 0) {
            colorArray.push("#FFFFFF");
        }
        return colorArray;
    }

    /**
     * 指定されたブール値の配列に基づいて、有効な色のリストをRGB値（0.0〜1.0）のフラットな配列として取得します。
     * シェーダー（GLSL）のUniform変数としてカラーパレットを渡す際に使用されます。
     * 16進数のカラーコードを解析し、R, G, Bそれぞれの成分を0〜255から0.0〜1.0の範囲に正規化します。
     * 戻り値の配列は [R1, G1, B1, R2, G2, B2, ...] のような形式になります。
     * 有効な色が選択されなかった場合は、白（1.0, 1.0, 1.0）を返します。
     *
     * @param booleanArray 各色が有効かどうかを示すブール値の配列。省略時は全色が有効になります。
     * @returns RGB値が順に並んだ数値配列。
     */
    static getColorRGBArray(booleanArray: boolean[] = new Array(this.colors.length).fill(true)): number[] {
        const rgbArray: number[] = [];
        for (let i = 0; i < booleanArray.length; i++) {
            if (booleanArray[i]) {
                const r = parseInt(this.colors[i % this.colors.length].substring(1, 3), 16) / 255;
                const g = parseInt(this.colors[i % this.colors.length].substring(3, 5), 16) / 255;
                const b = parseInt(this.colors[i % this.colors.length].substring(5, 7), 16) / 255;
                rgbArray.push(r);
                rgbArray.push(g);
                rgbArray.push(b);
            }
        }
        if (rgbArray.length === 0) {
            rgbArray.push(1.0);
            rgbArray.push(1.0);
            rgbArray.push(1.0);
        }
        return rgbArray;
    }
}