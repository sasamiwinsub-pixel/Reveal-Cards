import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const inputDir = path.join(process.cwd(), "public", "cards");
const outputDir = path.join(inputDir, "cropped");

fs.mkdirSync(outputDir, { recursive: true });

const files = fs
  .readdirSync(inputDir)
  .filter((file) => file.endsWith(".png"))
  .filter((file) => fs.statSync(path.join(inputDir, file)).isFile());

await Promise.all(
  files.map((file) =>
    sharp(path.join(inputDir, file))
      .trim({ background: "#000000", threshold: 12 })
      .resize({ height: 720, withoutEnlargement: true })
      .png()
      .toFile(path.join(outputDir, file)),
  ),
);

console.log(`Cropped ${files.length} card image(s).`);
