import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
let svg = await fs.readFile(path.join(publicDir, "poker-hands-guide.svg"), "utf8");
const assets = [...svg.matchAll(/href="(poker-guide-assets\/[^"]+\.png)"/g)];
for (const [, asset] of assets) {
  const bytes = await fs.readFile(path.join(publicDir, asset));
  svg = svg.replace(`href="${asset}"`, `href="data:image/png;base64,${bytes.toString("base64")}"`);
}

const png = await sharp(Buffer.from(svg), { density: 216 })
  .resize(4200, 2700)
  .png()
  .toBuffer();
await fs.writeFile(path.join(publicDir, "poker-hands-guide.png"), png);
console.log("Rendered poker-hands-guide.png (4200 x 2700).");
