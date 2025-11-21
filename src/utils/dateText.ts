export class DateText {
    static getYYYYMMDD(date: Date = new Date()): string {
        // 1. 年を取得 (YYYY)
        const year = date.getFullYear();

        // 2. 月を取得し、1を足す (MM, 0-indexedのため+1)
        // 例: 1月は0なので、1にする
        const month = date.getMonth() + 1;

        // 3. 日を取得 (DD)
        const day = date.getDate();

        // 4. 月と日を2桁にゼロパディングする
        // String(month).padStart(2, '0') は、'1' -> '01'、'12' -> '12' に変換します
        const monthString = String(month).padStart(2, '0');
        const dayString = String(day).padStart(2, '0');

        // 5. すべてを結合してYYYYMMDD形式の文字列を返す
        return `${monthString}${dayString}${year}`;
    }

    static getHHMMSS(date: Date = new Date()): string {
        // 1. 時を取得 (HH)
        const hours = date.getHours();
        
        // 2. 分を取得 (MM)
        const minutes = date.getMinutes();
        
        // 3. 秒を取得 (SS)
        const seconds = date.getSeconds();

        // ミリビョウを含めたい場合は以下を使用
        const milliseconds = date.getMilliseconds();
        
        // 4. 時、分、秒を2桁にゼロパディングする
        const hoursString = String(hours).padStart(2, '0');
        const minutesString = String(minutes).padStart(2, '0');
        const secondsString = String(seconds).padStart(2, '0');
        const millisecondsString = String(Math.floor(milliseconds/100)*100).padStart(2, '0'); // ミリビョウを含めたい場合
        
        // 5. すべてを結合してHHMMSS形式の文字列を返す
        return `${hoursString}${minutesString}${secondsString}${millisecondsString}`;
    } 
}