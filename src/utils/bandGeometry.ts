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

export function translateBox(box: BoxCoordinates, xOffset: number): BoxCoordinates {
    return {
        topX1: box.topX1 + xOffset,
        topX2: box.topX2 + xOffset,
        bottomX1: box.bottomX1 + xOffset,
        bottomX2: box.bottomX2 + xOffset,
        noiseSeed: box.noiseSeed,
    };
}

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

export function computePolygonCenter(points: { x: number; y: number }[]): { x: number; y: number } {
    const sum = points.reduce(
        (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
        { x: 0, y: 0 }
    );
    return { x: sum.x / points.length, y: sum.y / points.length };
}

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

function getTrapezoidX(p: p5, y: number, xTop: number, xBottom: number): number {
    return p.map(y, 0, p.height, xTop, xBottom);
}
