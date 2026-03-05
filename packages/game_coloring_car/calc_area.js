const fs = require('fs');
const { PNG } = require('pngjs');
const path = require('path');

const dir = 'public/assets/images/S1/';
const files = ['1.png', '2.png', '3.png'];

files.forEach(file => {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) {
        console.log(`File ${file} not found at ${filePath}`);
        return;
    }
    const data = fs.readFileSync(filePath);
    const png = PNG.sync.read(data);
    let count = 0;
    for (let y = 0; y < png.height; y++) {
        for (let x = 0; x < png.width; x++) {
            const idx = (png.width * y + x) << 2;
            if (png.data[idx + 3] > 0) count++;
        }
    }
    // Scale cua car (level 1) la 0.95 (theo file JSON config)
    const scale = 0.95;
    const scaledArea = Math.round(count * scale * scale);
    console.log(`${file} - area_px_original: ${count}, area_px_scaled (${scale}): ${scaledArea}`);
});
