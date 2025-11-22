/**
 * 文字が漢字または小さい仮名（捨て仮名）であるかを判定するためのユーティリティクラス。
 * すべてのメソッドは静的メソッドとして提供されます。
 */
export class CharacterChecker {

    // --- 漢字判定 ---

    /**
     * 指定された文字が漢字（CJK統合漢字）の主要な範囲に含まれるかどうかを判定します。
     * Unicodeの範囲 U+4E00 から U+9FFF をチェックすることで、
     * 一般的な日本語の文章で使用される漢字の大部分をカバーします。
     * ただし、拡張領域の漢字や、一部の記号的な漢字は含まれない場合があります。
     * テキストのレイアウト調整や、フォントの切り替え、
     * あるいは特定の文字種に対するエフェクトの適用などに使用されます。
     *
     * @param char 判定対象の文字（1文字の文字列）。
     * @returns 漢字の範囲内であれば true、そうでなければ false。
     */
    static isKanji(char: string): boolean {
        if (char.length !== 1) {
            return false;
        }

        const code = char.charCodeAt(0);

        // CJK統合漢字の主要な範囲 (U+4E00 から U+9FFF)
        return code >= 0x4E00 && code <= 0x9FFF;
    }

    // --- 小さい仮名（捨て仮名）判定 ---

    /**
     * 日本語の「小さい文字」（拗音、促音、捨て仮名）のリスト。
     * ぁぃぅぇぉゃゅょっ (ひらがな)
     * ァィゥェォヵヶッャュョ (カタカナ)
     * NOTE: これは静的なプロパティとして保持し、パフォーマンスを向上させます。
     */
    private static readonly SMALL_KANA_CHARS: string = "ぁぃぅぇぉゃゅょっァィゥェォヵヶッャュョ";

    /**
     * 指定された文字が日本語の「小さい文字」（捨て仮名、拗音、促音）かどうかを判定します。
     * ひらがなの「ぁぃぅぇぉゃゅょっ」およびカタカナの「ァィゥェォヵヶッャュョ」が対象です。
     * これらの文字は、通常の文字とは異なる配置やサイズ調整が必要な場合があります。
     * 例えば、縦書き時の位置調整や、リズムに合わせたタイポグラフィアニメーションにおいて、
     * 特別な扱いをするためにこの判定が使用されます。
     * 判定は事前に定義された文字列リスト（SMALL_KANA_CHARS）への包含チェックで行われます。
     *
     * @param char 判定対象の文字（1文字の文字列）。
     * @returns 小さい文字（捨て仮名など）であれば true、そうでなければ false。
     */
    static isSmallKana(char: string): boolean {
        if (char.length !== 1) {
            return false;
        }

        // 定義済みの小さい文字リストにcharが含まれるかチェックする
        return CharacterChecker.SMALL_KANA_CHARS.includes(char);
    }
}

// --- 利用例 ---

// console.log(`'花' は漢字か: ${CharacterChecker.isKanji('花')}`); // true
// console.log(`'ほ' は漢字か: ${CharacterChecker.isKanji('ほ')}`); // false
// console.log(`'ゃ' は小さい仮名か: ${CharacterChecker.isSmallKana('ゃ')}`); // true
// console.log(`'や' は小さい仮名か: ${CharacterChecker.isSmallKana('や')}`); // false