import p5 from "p5";
import type { Scene } from "./Scene";
import { ColorPalette } from "../utils/colorPalette";

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
    update(_p: p5): void {
        // シーンの状態を更新するロジックをここに実装
    }

    // draw は受け取った Graphics にシーンのビジュアルを描画する。
    draw(_p: p5, tex: p5.Graphics, beat: number): void {
        
        for (let i = 0; i < 5; i++) {
            tex.noStroke();

            const segmentData = this.calculateSegmentData(_p, 5, i, i, i+1, i+1, 0.1, 0, 1, 0, 1);
            tex.fill(ColorPalette.colors[i % ColorPalette.colors.length]);
            this.drawBand(_p, tex, segmentData);
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

    private drawBand(p: p5, tex: p5.Graphics, data: BoxCoordinates, yscl1: number = 0, yscl2: number = 1) {
        const y1 = yscl1 * tex.height;
        const y2 = yscl2 * tex.height;

        const topX3 = this.getTrapezoidX(p, y1, data.topX1, data.bottomX1);
        const topX4 = this.getTrapezoidX(p, y1, data.topX2, data.bottomX2);
        const bottomX3 = this.getTrapezoidX(p, y2, data.topX1, data.bottomX1);
        const bottomX4 = this.getTrapezoidX(p, y2, data.topX2, data.bottomX2);

        tex.beginShape();
        tex.vertex(topX3, y1);
        tex.vertex(topX4, y1);
        tex.vertex(bottomX4, y2);
        tex.vertex(bottomX3, y2);
        tex.endShape(tex.CLOSE);
    }
}