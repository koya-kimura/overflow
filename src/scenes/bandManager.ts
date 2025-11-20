import p5 from "p5";
import type { Scene } from "./Scene";
import { ColorPalette } from "../utils/colorPalette";
import { UniformRandom } from "../utils/uniformRandom";
import { Easing } from "../utils/easing";

type BoxCoordinates = {
    topX1: number;
    topX2: number;
    bottomX1: number;
    bottomX2: number;
    noiseSeed: number;
}

// SampleScene はテンプレート用の最小シーン実装を提供する。
export class bandManager implements Scene {
    // update はこのシーン固有のアニメーションや入力処理を記述する場所。
    update(_p: p5, beat: number, paramValues: number[]): void {
        // シーンの状態を更新するロジックをここに実装
    }
    // draw は受け取った Graphics にシーンのビジュアルを描画する。
    draw(_p: p5, tex: p5.Graphics): void {
        const beat = _p.millis() / 500; // 仮のビート計算。実際には BPMManager から取得する。

        const lineCount = 8;
        const bandWidthScale = 0.9; // 0.8 + 0.2 * Easing.easeInOutQuad(Math.abs(beat % 2 - 1))
        const bandHeightScale = 1.0; // 0.8 + 0.2 * Easing.easeInOutQuad(Math.abs(beat % 2 - 1))

        const topCeneterScaleX = 0.5; // Math.sin(beat * 0.5 * Math.PI) * 0.5 + 0.5
        const topWidthScaleX = 0.8;

        const bottomCenterScaleX = 0.5; // Math.cos(beat * 0.5 * Math.PI) * 0.5 + 0.5
        const bottomWidthScaleX = 0.8;

        // 変更なし
        const topLeftScaleX = topCeneterScaleX - topWidthScaleX * 0.5;
        const topRightScaleX = topCeneterScaleX + topWidthScaleX * 0.5;
        const bottomLeftScaleX = bottomCenterScaleX - bottomWidthScaleX * 0.5;
        const bottomRightScaleX = bottomCenterScaleX + bottomWidthScaleX * 0.5;

        const mode = ["all", "sequence", "random"][1];

        // const stringAreaTopYScale = 0.3;
        // const stringAreaBottomYScale = 0.7;
        // const stringAreaHeightScale = stringAreaBottomYScale - stringAreaTopYScale;
        // const stringWeight = 0.1;


        for (let i = 0; i < lineCount; i++) {
            const segmentData = this.calculateSegmentData(_p, lineCount, i, i, i, i, bandWidthScale, topLeftScaleX, topRightScaleX, bottomLeftScaleX, bottomRightScaleX);
            tex.noStroke();
            tex.fill(ColorPalette.colors[i % ColorPalette.colors.length]);

            switch(mode){
                case "all":
                    break;
                case "sequence":
                    if (i !== Math.floor((beat) % lineCount)) continue;
                    break;
                case "random":
                    if (Math.floor(UniformRandom.rand(Math.floor(beat)) * lineCount) != i) continue;
                    break;
            }
            this.drawBand(_p, tex, segmentData, 0.5 - bandHeightScale * 0.5, 0.5 + bandHeightScale * 0.5);

            // tex.fill(0);
            // this.drawBand(_p, tex, segmentData, stringAreaTopYScale, stringAreaBottomYScale);

            tex.fill(255);
            this.drawNumber(_p, tex, segmentData, Math.floor(beat / lineCount) + i);
            // this.drawBand(_p, tex, segmentData, stringAreaTopYScale, stringAreaTopYScale + stringAreaHeightScale * stringWeight, 1.0, "CENTER");
            // this.drawBand(_p, tex, segmentData, stringAreaBottomYScale - stringAreaHeightScale * stringWeight, stringAreaBottomYScale, 1.0, "CENTER");
            // this.drawBand(_p, tex, segmentData, stringAreaTopYScale + stringAreaHeightScale * 0.5 - stringAreaHeightScale * stringWeight * 0.5, stringAreaTopYScale + stringAreaHeightScale * 0.5 + stringAreaHeightScale * stringWeight * 0.5, 1.0, "CENTER");

            // // widthとheightの比率出かける必要ある
            // const weightAspect = 2;
            // this.drawBand(_p, tex, segmentData, stringAreaTopYScale + stringAreaHeightScale * stringWeight, stringAreaTopYScale + stringAreaHeightScale * 0.5 - stringAreaHeightScale * stringWeight * 0.5, stringWeight * weightAspect, "LEFT");
            // this.drawBand(_p, tex, segmentData, stringAreaTopYScale + stringAreaHeightScale * stringWeight, stringAreaTopYScale + stringAreaHeightScale * 0.5 - stringAreaHeightScale * stringWeight * 0.5, stringWeight * weightAspect, "RIGHT");
            // this.drawBand(_p, tex, segmentData, stringAreaTopYScale + stringAreaHeightScale * 0.5 + stringAreaHeightScale * stringWeight * 0.5, stringAreaBottomScale - stringAreaHeightScale * stringWeight, stringWeight * weightAspect, "LEFT");
            // this.drawBand(_p, tex, segmentData, stringAreaTopYScale + stringAreaHeightScale * 0.5 + stringAreaHeightScale * stringWeight * 0.5, stringAreaBottomScale - stringAreaHeightScale * stringWeight, stringWeight * weightAspect, "RIGHT");
        }
    }

    private getTrapezoidX(p: p5, y: number, xTop: number, xBottom: number) {
        return p.map(y, 0, p.height, xTop, xBottom);
    }

    /**
         * 指定されたインデックス（または範囲）の台形座標とノイズシードを計算します。
         * endIndex を省略した場合は、単一のセグメントとして計算されます。
         */
    private calculateSegmentData(
        p: p5,
        count: number,
        startTopIndex: number,
        endTopIndex: number = startTopIndex,
        startBottomIndex: number = startTopIndex,
        endBottomIndex: number = startBottomIndex,
        scl: number = 1.0,
        xStartTop: number = 0.2,
        xEndTop: number = 0.8,
        xStartBottom: number = 0.1,
        xEndBottom: number = 0.9
    ) {
        // マージン計算用定数 (全体の余白をcountで割る)
        const scalePerUnit = scl / count;
        const marginPerUnit = (1.0 - scl) / count;

        // 描画開始位置: startIndex の左端から計算
        // 式: (index * widthRatio) + (index * marginRatio)
        const segmentStartTop = (startTopIndex * scalePerUnit) + ((startTopIndex + 0.5) * marginPerUnit);
        const segmentEndTop = ((endTopIndex + 1) * scalePerUnit) + ((endTopIndex + 0.5) * marginPerUnit);

        const segmentStartBottom = (startBottomIndex * scalePerUnit) + ((startBottomIndex + 0.5) * marginPerUnit);
        const segmentEndBottom = ((endBottomIndex + 1) * scalePerUnit) + ((endBottomIndex + 0.5) * marginPerUnit);

        // 座標計算 (map関数)
        const topX1 = p.map(segmentStartTop, 0, 1, xStartTop, xEndTop) * p.width;
        const topX2 = p.map(segmentEndTop, 0, 1, xStartTop, xEndTop) * p.width;
        const bottomX1 = p.map(segmentStartBottom, 0, 1, xStartBottom, xEndBottom) * p.width;
        const bottomX2 = p.map(segmentEndBottom, 0, 1, xStartBottom, xEndBottom) * p.width;

        // ノイズシード: 範囲の中心インデックスを使用 (単一の場合は startIndex と等しくなる)
        const noiseSeed = ((startTopIndex + endTopIndex + startBottomIndex + endBottomIndex) / 2) * 0.1;

        return { topX1, topX2, bottomX1, bottomX2, noiseSeed };
    }

    private drawBand(p: p5, tex: p5.Graphics, data: BoxCoordinates, yscl1: number = 0, yscl2: number = 1, xscl: number = 1, alignX: string = "CENTER") {
        const y1 = yscl1 * tex.height;
        const y2 = yscl2 * tex.height;

        const topX3 = this.getTrapezoidX(p, y1, data.topX1, data.bottomX1);
        const topX4 = this.getTrapezoidX(p, y1, data.topX2, data.bottomX2);
        const bottomX3 = this.getTrapezoidX(p, y2, data.topX1, data.bottomX1);
        const bottomX4 = this.getTrapezoidX(p, y2, data.topX2, data.bottomX2);

        let currentTopX1 = topX3;
        if (alignX == "CENTER") currentTopX1 = topX3 + (topX4 - topX3) * 0.5 - (topX4 - topX3) * 0.5 * xscl;
        if (alignX == "RIGHT") currentTopX1 = topX4 - (topX4 - topX3) * xscl;


        let currentTopX2 = topX4;
        if(alignX == "CENTER") currentTopX2 = topX4 - (topX4 - topX3) * 0.5 + (topX4 - topX3) * 0.5 * xscl;
        if(alignX == "LEFT") currentTopX2 = topX3 + (topX4 - topX3) * xscl;

        let currentBottomX1 = bottomX3;
        if(alignX == "CENTER") currentBottomX1 = bottomX3 + (bottomX4 - bottomX3) * 0.5 - (bottomX4 - bottomX3) * 0.5 * xscl;
        if(alignX == "RIGHT") currentBottomX1 = bottomX4 - (bottomX4 - bottomX3) * xscl;

        let currentBottomX2 = bottomX4;
        if(alignX == "CENTER") currentBottomX2 = bottomX4 - (bottomX4 - bottomX3) * 0.5 + (bottomX4 - bottomX3) * 0.5 * xscl;
        if(alignX == "LEFT") currentBottomX2 = bottomX3 + (bottomX4 - bottomX3) * xscl;

        tex.beginShape();
        tex.vertex(currentTopX1, y1);
        tex.vertex(currentTopX2, y1);
        tex.vertex(currentBottomX2, y2);
        tex.vertex(currentBottomX1, y2);
        tex.endShape(tex.CLOSE);
    }

    drawNumber(p: p5, tex: p5.Graphics, data: BoxCoordinates, number: number = 0, stringAreaTopYScale=0.3, stringAreaBottomYScale=0.7) {
        const numberCompArray = [
            [true, true, false, true, true, true, true], // 0
            [false, false, false, false, true, false, true], // 1
            [true, true, true, false, true, true, false], // 2
            [true, true, true, false, true, false, true], // 3
            [false, false, true, true, true, false, true], // 4
            [true, true, true, true, false, false, true], // 5
            [true, true, true, true, false, true, true], // 6
            [true, false, false, false, true, false, true], // 7
            [true, true, true, true, true, true, true], // 8
            [true, true, true, true, true, false, true], // 9
        ];
        const numberComp = numberCompArray[number % numberCompArray.length];
        const stringAreaHeightScale = stringAreaBottomYScale - stringAreaTopYScale;
        const stringWeight = 0.15;
        const weightAspect = 2;

        if (numberComp[0]) this.drawBand(p, tex, data, stringAreaTopYScale, stringAreaTopYScale + stringAreaHeightScale * stringWeight, 1.0, "CENTER");
        if (numberComp[1]) this.drawBand(p, tex, data, stringAreaBottomYScale - stringAreaHeightScale * stringWeight, stringAreaBottomYScale, 1.0, "CENTER");
        if (numberComp[2]) this.drawBand(p, tex, data, stringAreaTopYScale + stringAreaHeightScale * 0.5 - stringAreaHeightScale * stringWeight * 0.5, stringAreaTopYScale + stringAreaHeightScale * 0.5 + stringAreaHeightScale * stringWeight * 0.5, 1.0, "CENTER");
        if (numberComp[3]) this.drawBand(p, tex, data, stringAreaTopYScale, stringAreaTopYScale + stringAreaHeightScale * 0.5, stringWeight * weightAspect, "LEFT");
        if (numberComp[4]) this.drawBand(p, tex, data, stringAreaTopYScale, stringAreaTopYScale + stringAreaHeightScale * 0.5, stringWeight * weightAspect, "RIGHT");
        if (numberComp[5]) this.drawBand(p, tex, data, stringAreaTopYScale + stringAreaHeightScale * 0.5, stringAreaBottomYScale, stringWeight * weightAspect, "LEFT");
        if (numberComp[6]) this.drawBand(p, tex, data, stringAreaTopYScale + stringAreaHeightScale * 0.5, stringAreaBottomYScale, stringWeight * weightAspect, "RIGHT");
    }
}