import p5 from "p5";

export type AlignX = "CENTER" | "LEFT" | "RIGHT";

export type BoxCoordinates = {
    topX1: number;
    topX2: number;
    bottomX1: number;
    bottomX2: number;
    noiseSeed: number;
};

export type SegmentBoxOptions = {
    p: p5;
    count: number;
    startTopIndex: number;
    endTopIndex?: number;
    startBottomIndex?: number;
    endBottomIndex?: number;
    scale?: number;
    xStartTop?: number;
    xEndTop?: number;
    xStartBottom?: number;
    xEndBottom?: number;
};

export type DrawBandOptions = {
    p: p5;
    tex: p5.Graphics;
    box: BoxCoordinates;
    yscl1: number;
    yscl2: number;
    xscl?: number;
    align?: AlignX;
    rotationAngle?: number;
    rotationCenter?: { x: number; y: number };
};

export type ResolveVerticesOptions = {
    p: p5;
    box: BoxCoordinates;
    texHeight: number;
    yscl1: number;
    yscl2: number;
    xscl?: number;
    align?: AlignX;
};

export type TrapezoidVertex = { x: number; y: number };

/**
 * 指定されたオプションに基づいて、画面上のセグメント（区画）の座標を計算します。
 * 画面全体を複数のセグメントに分割し、その中の一つ（または複数）の位置を特定します。
 * 上辺と下辺のX座標の範囲（xStartTop, xEndTopなど）を指定することで、
 * 台形や平行四辺形のような形状の領域を定義することができます。
 * また、計算された座標に加えて、ノイズ生成用のシード値も計算して返します。
 * これにより、各セグメントが一意なランダム性を持つことができます。
 *
 * @param options セグメント計算のためのオプション（分割数、インデックス、スケール、X座標範囲など）。
 * @returns 計算されたボックス座標（上辺・下辺のX座標ペア）とノイズシード。
 */
export function calculateSegmentBox(options: SegmentBoxOptions): BoxCoordinates {
    const {
        p,
        count,
        startTopIndex,
        endTopIndex = startTopIndex,
        startBottomIndex = startTopIndex,
        endBottomIndex = startBottomIndex,
        scale = 1.0,
        xStartTop = 0.2,
        xEndTop = 0.8,
        xStartBottom = 0.1,
        xEndBottom = 0.9,
    } = options;

    const scalePerUnit = scale / count;
    const marginPerUnit = (1.0 - scale) / count;

    const segmentStartTop = (startTopIndex * scalePerUnit) + ((startTopIndex + 0.5) * marginPerUnit);
    const segmentEndTop = ((endTopIndex + 1) * scalePerUnit) + ((endTopIndex + 0.5) * marginPerUnit);

    const segmentStartBottom = (startBottomIndex * scalePerUnit) + ((startBottomIndex + 0.5) * marginPerUnit);
    const segmentEndBottom = ((endBottomIndex + 1) * scalePerUnit) + ((endBottomIndex + 0.5) * marginPerUnit);

    const topX1 = p.map(segmentStartTop, 0, 1, xStartTop, xEndTop) * p.width;
    const topX2 = p.map(segmentEndTop, 0, 1, xStartTop, xEndTop) * p.width;
    const bottomX1 = p.map(segmentStartBottom, 0, 1, xStartBottom, xEndBottom) * p.width;
    const bottomX2 = p.map(segmentEndBottom, 0, 1, xStartBottom, xEndBottom) * p.width;

    const noiseSeed = ((startTopIndex + endTopIndex + startBottomIndex + endBottomIndex) / 2) * 0.1;

    return { topX1, topX2, bottomX1, bottomX2, noiseSeed };
}

/**
 * 既存のボックス座標をX軸方向に平行移動させます。
 * アニメーションや配置の調整のために、計算済みのボックス全体を左右にずらす際に使用します。
 * すべてのX座標（topX1, topX2, bottomX1, bottomX2）に対して同じオフセットを加算します。
 * ノイズシードは変更されず、元のボックスの特性を維持します。
 * これにより、形状を保ったまま位置だけを変更する操作が容易になります。
 *
 * @param box 元となるボックス座標オブジェクト。
 * @param xOffset X軸方向への移動量（ピクセル単位）。
 * @returns 平行移動後の新しいボックス座標オブジェクト。
 */
export function translateBox(box: BoxCoordinates, xOffset: number): BoxCoordinates {
    return {
        topX1: box.topX1 + xOffset,
        topX2: box.topX2 + xOffset,
        bottomX1: box.bottomX1 + xOffset,
        bottomX2: box.bottomX2 + xOffset,
        noiseSeed: box.noiseSeed,
    };
}

/**
 * 指定されたボックス座標と描画オプションに基づいて、台形（バンド）を描画します。
 * まず、resolveTrapezoidVerticesを使用して台形の4つの頂点座標を計算します。
 * その後、必要に応じて回転処理（rotationAngleが指定されている場合）を適用します。
 * 最後に、p5.jsのbeginShape/vertex/endShapeを使用して、計算された頂点を結ぶ多角形を描画します。
 * 描画先は指定されたGraphicsオブジェクト（tex）です。
 * アラインメント（CENTER, LEFT, RIGHT）やスケーリング（xscl）も考慮されます。
 *
 * @param options 描画に必要なオプション（p5インスタンス、描画先、ボックス座標、Y軸スケール、回転設定など）。
 */
export function drawTrapezoidBand({
    p,
    tex,
    box,
    yscl1,
    yscl2,
    xscl = 1,
    align = "CENTER",
    rotationAngle = 0,
    rotationCenter,
}: DrawBandOptions): void {
    let vertices = resolveTrapezoidVertices({
        p,
        box,
        texHeight: tex.height,
        yscl1,
        yscl2,
        xscl,
        align,
    });

    if (Math.abs(rotationAngle) > 1e-6) {
        const center = rotationCenter ?? computePolygonCenter(vertices);
        const sinTheta = Math.sin(rotationAngle);
        const cosTheta = Math.cos(rotationAngle);
        vertices = vertices.map((vertex) => rotatePoint(vertex, center, sinTheta, cosTheta));
    }

    tex.beginShape();
    for (const vertex of vertices) {
        tex.vertex(vertex.x, vertex.y);
    }
    tex.endShape(tex.CLOSE);
}

/**
 * 多角形の頂点配列から、その重心（幾何学的中心）を計算します。
 * すべての頂点のX座標とY座標をそれぞれ合計し、頂点数で割ることで平均位置を求めます。
 * この中心点は、図形の回転軸として使用されることが多いです。
 * 単純な平均値であるため、頂点が均等に配置されていない場合や、
 * 自己交差するような複雑な多角形の場合は、意図した「中心」と異なる場合がありますが、
 * 通常の凸多角形（台形など）では十分な近似となります。
 *
 * @param points 多角形を構成する頂点（{x, y}）の配列。
 * @returns 計算された中心点の座標（{x, y}）。
 */
export function computePolygonCenter(points: { x: number; y: number }[]): { x: number; y: number } {
    const sum = points.reduce(
        (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
        { x: 0, y: 0 }
    );
    return { x: sum.x / points.length, y: sum.y / points.length };
}

/**
 * ボックス座標とY軸の高さ情報から、台形を描画するための4つの頂点座標を解決（計算）します。
 * 画面の高さに対する割合（yscl1, yscl2）に基づいてY座標を決定し、
 * そのY座標における左右のX座標を線形補間（getTrapezoidX）で求めます。
 * さらに、横幅のスケール（xscl）やアラインメント（CENTER, LEFT, RIGHT）に応じて、
 * 最終的な頂点位置を調整します。
 * これにより、パースペクティブのかかったような台形や、幅の異なる帯を生成できます。
 *
 * @param options 頂点計算に必要なオプション（p5インスタンス、ボックス座標、高さ、スケール、アラインメント）。
 * @returns 計算された4つの頂点（左上、右上、右下、左下）の配列。
 */
export function resolveTrapezoidVertices({
    p,
    box,
    texHeight,
    yscl1,
    yscl2,
    xscl = 1,
    align = "CENTER",
}: ResolveVerticesOptions): TrapezoidVertex[] {
    const y1 = yscl1 * texHeight;
    const y2 = yscl2 * texHeight;

    const topX3 = getTrapezoidX(p, y1, box.topX1, box.bottomX1);
    const topX4 = getTrapezoidX(p, y1, box.topX2, box.bottomX2);
    const bottomX3 = getTrapezoidX(p, y2, box.topX1, box.bottomX1);
    const bottomX4 = getTrapezoidX(p, y2, box.topX2, box.bottomX2);

    const topWidth = topX4 - topX3;
    const bottomWidth = bottomX4 - bottomX3;

    let currentTopX1 = topX3;
    let currentTopX2 = topX4;
    let currentBottomX1 = bottomX3;
    let currentBottomX2 = bottomX4;

    if (align === "CENTER") {
        currentTopX1 = topX3 + topWidth * 0.5 * (1 - xscl);
        currentTopX2 = topX4 - topWidth * 0.5 * (1 - xscl);
        currentBottomX1 = bottomX3 + bottomWidth * 0.5 * (1 - xscl);
        currentBottomX2 = bottomX4 - bottomWidth * 0.5 * (1 - xscl);
    } else if (align === "LEFT") {
        currentTopX2 = topX3 + topWidth * xscl;
        currentBottomX2 = bottomX3 + bottomWidth * xscl;
    } else if (align === "RIGHT") {
        currentTopX1 = topX4 - topWidth * xscl;
        currentBottomX1 = bottomX4 - bottomWidth * xscl;
    }

    return [
        { x: currentTopX1, y: y1 },
        { x: currentTopX2, y: y1 },
        { x: currentBottomX2, y: y2 },
        { x: currentBottomX1, y: y2 },
    ];
}

/**
 * 指定された中心点を基準に、頂点を回転させます。
 * 2次元の回転行列を使用して、座標変換を行います。
 * 事前に計算されたsinθとcosθを受け取ることで、複数の頂点を回転させる際の
 * 再計算コストを削減しています。
 * 回転は、まず中心点を原点に移動させ、回転を適用し、再度元の位置に戻す手順で行われます。
 *
 * @param vertex 回転させたい頂点の座標。
 * @param center 回転の中心となる座標。
 * @param sinTheta 回転角のサイン値。
 * @param cosTheta 回転角のコサイン値。
 * @returns 回転後の新しい頂点座標。
 */
function rotatePoint(
    vertex: { x: number; y: number },
    center: { x: number; y: number },
    sinTheta: number,
    cosTheta: number
): { x: number; y: number } {
    const translatedX = vertex.x - center.x;
    const translatedY = vertex.y - center.y;
    const rotatedX = translatedX * cosTheta - translatedY * sinTheta;
    const rotatedY = translatedX * sinTheta + translatedY * cosTheta;
    return { x: rotatedX + center.x, y: rotatedY + center.y };
}

/**
 * 指定されたY座標における台形のX座標を、線形補間によって求めます。
 * 画面の上端（y=0）におけるX座標（xTop）と、下端（y=height）におけるX座標（xBottom）を結ぶ
 * 直線上の、任意のY座標に対応するX座標を計算します。
 * p5.map関数を使用して、Y座標の0からheightまでの範囲を、xTopからxBottomまでの範囲にマッピングします。
 * これにより、台形の斜辺上の点を特定することができます。
 *
 * @param p p5.jsのインスタンス。
 * @param y 求めたい点のY座標。
 * @param xTop 画面上端でのX座標。
 * @param xBottom 画面下端でのX座標。
 * @returns 指定されたY座標に対応するX座標。
 */
function getTrapezoidX(p: p5, y: number, xTop: number, xBottom: number): number {
    return p.map(y, 0, p.height, xTop, xBottom);
}
