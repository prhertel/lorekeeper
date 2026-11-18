// Grim restyle for plain map images (e.g. a screenshot from Azgaar), to match the bundled Suxyland map:
// drained colour, an umber cast, grain, vignette, a frame and a title cartouche.

const load = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(`map image missing: ${src}`));
  img.src = src;
});

/**
 * @param {string} src image URL
 * @param {object} [o]
 * @param {{x:number,y:number,w:number,h:number}} [o.crop] part of the image to keep (e.g. cut off a UI tooltip)
 * @param {string} [o.title] title for the cartouche
 * @returns {Promise<{blob: Blob, width: number, height: number}>}
 */
export async function grimRasterMap(src, { crop, title = '' } = {}) {
  const img = await load(src);
  const c0 = crop || { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
  const W = c0.w, H = c0.h;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  g.drawImage(img, c0.x, c0.y, W, H, 0, 0, W, H);

  // 1. Drain most of the colour.
  g.globalCompositeOperation = 'saturation';
  g.fillStyle = 'rgba(0,0,0,0.62)';
  g.fillRect(0, 0, W, H);
  // 2. Umber / dried-parchment cast that also darkens everything.
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = '#76604a';
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.2;
  g.fillStyle = '#5a4636';
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;

  // 3. Grain: a small noise tile, repeated.
  const tile = document.createElement('canvas');
  tile.width = tile.height = 128;
  const tg = tile.getContext('2d');
  const id = tg.createImageData(128, 128);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = Math.random() * 255;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
    id.data[i + 3] = 255;
  }
  tg.putImageData(id, 0, 0);
  g.globalCompositeOperation = 'overlay';
  g.globalAlpha = 0.16;
  g.fillStyle = g.createPattern(tile, 'repeat');
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;

  // 4. Vignette.
  g.globalCompositeOperation = 'source-over';
  const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.78)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);

  // 5. Frame.
  g.strokeStyle = '#6e5a39';
  g.lineWidth = 3;
  g.strokeRect(7, 7, W - 14, H - 14);
  g.strokeStyle = '#3b3022';
  g.lineWidth = 1.5;
  g.strokeRect(13, 13, W - 26, H - 26);

  // 6. Title cartouche.
  if (title) {
    const text = title.toUpperCase();
    g.font = "30px Georgia, 'Times New Roman', serif";
    const letter = 7;
    const tw = [...text].reduce((t, ch) => t + g.measureText(ch).width + letter, 0);
    const x = 34, y = 34, h = 46;
    g.beginPath();
    g.moveTo(x, y); g.lineTo(x + tw + 34, y); g.lineTo(x + tw + 50, y + h / 2); g.lineTo(x + tw + 34, y + h);
    g.lineTo(x, y + h); g.lineTo(x - 16, y + h / 2); g.closePath();
    g.fillStyle = 'rgba(13,10,8,0.82)';
    g.fill();
    g.strokeStyle = '#6e5a39';
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = '#e2d0a4';
    g.textBaseline = 'middle';
    let cx = x + 18;
    for (const ch of text) { g.fillText(ch, cx, y + h / 2 + 1); cx += g.measureText(ch).width + letter; }
  }

  const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.9));
  return { blob, width: W, height: H };
}
