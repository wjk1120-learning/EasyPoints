const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const dir = path.join(__dirname, "..", "static", "tabbar");
const svgs = fs.readdirSync(dir).filter((f) => f.endsWith(".svg"));

(async () => {
  for (const file of svgs) {
    const svgPath = path.join(dir, file);
    const pngPath = path.join(dir, file.replace(".svg", ".png"));
    await sharp(svgPath).resize(81, 81).png().toFile(pngPath);
    console.log("created", pngPath);
  }
})();
