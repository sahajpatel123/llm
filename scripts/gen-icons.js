const { PNG } = require("pngjs");
const fs = require("fs");
const path = require("path");

function drawIcon(size) {
  const png = new PNG({ width: size, height: size });
  const white = { r: 255, g: 255, b: 255, a: 255 };
  const black = { r: 0, g: 0, b: 0, a: 255 };
  const margin = Math.floor(size * 0.22);
  const inner = size - margin * 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (size * y + x) << 2;
      const isSquare = x >= margin && x < margin + inner && y >= margin && y < margin + inner;
      const color = isSquare ? black : white;
      png.data[idx] = color.r;
      png.data[idx + 1] = color.g;
      png.data[idx + 2] = color.b;
      png.data[idx + 3] = color.a;
    }
  }

  return png;
}

const outDir = path.join(__dirname, "..", "public", "icons");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

[192, 512].forEach((size) => {
  const png = drawIcon(size);
  const outPath = path.join(outDir, `icon-${size}.png`);
  png.pack().pipe(fs.createWriteStream(outPath));
});
