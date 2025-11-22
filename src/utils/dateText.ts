export class DateText {
    /**
     * 現在の日付を文字列として取得します。
     * デフォルトでは現在時刻を使用しますが、引数で任意のDateオブジェクトを指定することも可能です。
     * 年、月、日をそれぞれ取得し、月と日は2桁にゼロパディング（0埋め）します。
     * 最終的にそれらを結合して一つの文字列として返します。
     * 実装上の戻り値の形式は "MMDDYYYY" （月・日・年）の順序になっています。
     * （関数名はgetYYYYMMDDですが、実際の結合順序は米国式の日付表記に近い形です）
     * ビジュアル表現として日付を使用する際に利用されます。
     *
     * @param date 日付オブジェクト（省略時は現在時刻）。
     * @returns "MMDDYYYY" 形式の文字列（例: "11222025"）。
     */
    static getYYYYMMDD(date: Date = new Date()): string {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();

        const monthString = String(month).padStart(2, '0');
        const dayString = String(day).padStart(2, '0');

        return `${monthString}${dayString}${year}`;
    }

    /**
     * 現在の時刻を文字列として取得します。
     * 時、分、秒、およびミリ秒（の上位桁）を取得し、それぞれ2桁にゼロパディングします。
     * これらを結合して一つの文字列を生成します。
     * 戻り値の形式は "HHMMSSms" （時・分・秒・ミリ秒）となります。
     * ミリ秒部分は100で割った値を使用しているため、00〜09の範囲（実際には1桁ですが2桁パディング）
     * あるいは実装によっては異なる挙動をする可能性がありますが、
     * 基本的には高速に変化する数字列を生成するために使用されます。
     *
     * @param date 日付オブジェクト（省略時は現在時刻）。
     * @returns "HHMMSSms" 形式の文字列。
     */
    static getHHMMSS(date: Date = new Date()): string {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();
        const milliseconds = date.getMilliseconds();

        const hoursString = String(hours).padStart(2, '0');
        const minutesString = String(minutes).padStart(2, '0');
        const secondsString = String(seconds).padStart(2, '0');
        const millisecondsString = String(Math.floor(milliseconds / 100) * 100).padStart(2, '0');

        return `${hoursString}${minutesString}${secondsString}${millisecondsString}`;
    }

    /**
     * 現在の日時を一般的なフォーマットの文字列として取得します。
     * "YYYY/MM/DD HH:mm:ss" の形式で整形された文字列を返します。
     * デバッグ表示や、UI上の時計表示など、人間が読みやすい形式が必要な場合に使用されます。
     * 各要素（月、日、時、分、秒）は必ず2桁にゼロパディングされます。
     *
     * @param date 日付オブジェクト（省略時は現在時刻）。
     * @returns "YYYY/MM/DD HH:mm:ss" 形式の文字列。
     */
    static getYYYYMMDD_HHMMSS_format(date: Date = new Date()): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
    }
}