import p5 from "p5";

export class SpaceText {
    static spaceText(tex: p5.Graphics, text: string, x: number, y: number, spaceScale: number, mode:string = "CORNER"): void {
        const characters = text.split("");
        const space = tex.textWidth("W") * 0.9;
        let currentX = x;

        if(mode === "CENTER") {
            const totalWidth = space * spaceScale * (characters.length - 1);
            currentX = x - totalWidth / 2;
        }

        characters.forEach((char) => {
            tex.text(char, currentX, y);
            const charWidth = space;
            currentX += charWidth * spaceScale;
        });
    }
}