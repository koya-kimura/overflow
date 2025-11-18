import p5 from "p5";

export class VertText {
    static vertText(p:p5, tex: p5.Graphics, text: string, x: number, y: number, mode:string="CORNER"): void {
        const characters = text.split("");
        const space = tex.textWidth("W") * 1.2;

        tex.push();
        if (mode === "CENTER") {
            const totalHeight = space * (characters.length - 1);
            tex.translate(0, -totalHeight*0.5);
        }
        for(let i = 0; i < characters.length; i++) {
            const tx = x + (mode == "CENTER" ? 0 : space * 0.5);
            const ty = y + i * space;
            const char = characters[i];
            tex.push();
            tex.textAlign(p.CENTER, p.CENTER);
            tex.translate(tx, ty);
            if(char === "ー"){
                tex.rotate(Math.PI / 2);
            }
            tex.text(char, 0, 0);
            tex.pop();
        }
        tex.pop();
    }
}