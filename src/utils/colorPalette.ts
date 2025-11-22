export class ColorPalette {
    // カラーパレットの色を定義する。
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

    static getColorArray(booleanArray: boolean[] = new Array(this.colors.length).fill(true)): string[] {
        const colorArray: string[] = [];
        for(let i=0; i<booleanArray.length; i++){
            if(booleanArray[i]){
                colorArray.push(this.colors[i % this.colors.length]);
            }
        }
        if(colorArray.length === 0){
            colorArray.push("#FFFFFF");
        }
        return colorArray;
    }

    static getColorRGBArray(booleanArray: boolean[] = new Array(this.colors.length).fill(true)): number[] {
        const rgbArray: number[] = [];
        for(let i=0; i<booleanArray.length; i++){
            if(booleanArray[i]){
                const r = parseInt(this.colors[i % this.colors.length].substring(1,3),16) / 255;
                const g = parseInt(this.colors[i % this.colors.length].substring(3,5),16) / 255;
                const b = parseInt(this.colors[i % this.colors.length].substring(5,7),16) / 255;
                rgbArray.push(r);
                rgbArray.push(g);
                rgbArray.push(b);
            }
        }
        if(rgbArray.length === 0){
            rgbArray.push(1.0);
            rgbArray.push(1.0);
            rgbArray.push(1.0);
        }
        return rgbArray;
    }
}