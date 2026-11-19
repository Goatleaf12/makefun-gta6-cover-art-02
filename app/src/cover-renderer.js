// The single cover render routine for Sunset State Cover Studio.
//
// drawCover(ctx, W, H, view) draws EVERYTHING: graded photo panels, the
// print finish (halftone, grain, vignette, paper), and the full lettering
// and poster dressing. The editor preview and every PNG export call this
// same routine, so what you see is pixel-for-pixel what you export.
//
// Dressing is laid out defensively: the band and its palms go down first,
// panel tags are skipped when they would collide with the lettering
// block, the seal or the wanted pill, and the volume tag drops below the
// title when a wide title would run underneath it.

import { panelBox } from './panel-layouts.js';

// ---------- deterministic helpers ----------

function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

let noiseCanvas = null;
function getNoiseCanvas() {
  if (noiseCanvas) return noiseCanvas;
  noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = 256;
  noiseCanvas.height = 256;
  const nctx = noiseCanvas.getContext('2d');
  const img = nctx.createImageData(256, 256);
  const rnd = seededRandom(20261120);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
  return noiseCanvas;
}

// ---------- geometry ----------

function panelPath(ctx, panel, W, H, gutterPx) {
  ctx.beginPath();
  if (!panel.poly) {
    const x = panel.x * W + gutterPx / 2;
    const y = panel.y * H + gutterPx / 2;
    const w = panel.w * W - gutterPx;
    const h = panel.h * H - gutterPx;
    ctx.rect(x, y, Math.max(1, w), Math.max(1, h));
    return;
  }
  const pts = panel.poly.map(([u, v]) => [u * W, v * H]);
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  pts.forEach(([px, py], i) => {
    const dx = cx - px;
    const dy = cy - py;
    const dist = Math.hypot(dx, dy) || 1;
    const shift = Math.min(gutterPx / 2, dist * 0.25);
    const x = px + (dx / dist) * shift;
    const y = py + (dy / dist) * shift;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function panelPixelBox(panel, W, H, gutterPx) {
  const b = panelBox(panel);
  return {
    x: b.x * W + gutterPx / 2,
    y: b.y * H + gutterPx / 2,
    w: Math.max(1, b.w * W - gutterPx),
    h: Math.max(1, b.h * H - gutterPx),
  };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ---------- text helpers ----------

function fitFontSize(ctx, text, family, weight, maxWidth, startSize, minSize) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size *= 0.94;
  }
  ctx.font = `${weight} ${size}px ${family}`;
  return size;
}

function drawStar(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawPalm(ctx, x, baseY, height, lean, color) {
  const topX = x + lean * height;
  const topY = baseY - height;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, height * 0.055);
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + lean * height * 0.3, baseY - height * 0.6, topX, topY);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.5, height * 0.035);
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.08 + (i / 6) * 0.84);
    const len = height * (0.42 + (i % 3) * 0.08);
    const ex = topX + Math.cos(a) * len;
    const ey = topY + Math.sin(a) * len * 0.55 + len * 0.3;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.cos(a) * len * 0.6, topY - len * 0.18, ex, ey);
    ctx.stroke();
  }
}

// ---------- panel photo + grade ----------

function drawPanelPhoto(ctx, panel, img, view, fx, grade, W, H, gutterPx) {
  const box = panelPixelBox(panel, W, H, gutterPx);
  panelPath(ctx, panel, W, H, gutterPx);
  ctx.save();
  ctx.clip();
  if (!img) {
    const grad = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
    grad.addColorStop(0, '#3a2358');
    grad.addColorStop(1, '#170b28');
    ctx.fillStyle = grad;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.restore();
    return;
  }
  const sat = (grade.filter.sat * fx.saturation - 1) * fx.strength + 1;
  const con = (grade.filter.con * fx.contrast - 1) * fx.strength + 1;
  const bri = (grade.filter.bri - 1) * fx.strength + 1;
  const grey = grade.duotone ? 1 : 0;
  ctx.filter = `saturate(${sat.toFixed(3)}) contrast(${con.toFixed(3)}) brightness(${bri.toFixed(3)}) grayscale(${grey})`;
  const zoom = view.zoom || 1;
  const scale = Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const cx = box.x + box.w / 2 + (view.dx || 0) * box.w;
  const cy = box.y + box.h / 2 + (view.dy || 0) * box.h;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.filter = 'none';

  if (grade.duotone) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = grade.duotone.light;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = grade.duotone.dark;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.globalCompositeOperation = 'source-over';
  }

  const ov = grade.overlay;
  if (ov && ov.alpha > 0) {
    const grad = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
    grad.addColorStop(0, ov.from);
    grad.addColorStop(1, ov.to);
    ctx.globalCompositeOperation = ov.mode;
    ctx.globalAlpha = ov.alpha * fx.strength;
    ctx.fillStyle = grad;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  if (grade.wash) {
    ctx.globalCompositeOperation = grade.wash.mode;
    ctx.globalAlpha = grade.wash.alpha * fx.strength;
    ctx.fillStyle = grade.wash.color;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();

  panelPath(ctx, panel, W, H, gutterPx);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = Math.max(1, W * 0.0012);
  ctx.stroke();
}

// ---------- dressing pieces ----------

function drawPanelTag(ctx, panel, tag, W, H, gutterPx, bandTop, accent, avoids) {
  if (!tag || (!tag.place && !tag.sub)) return;
  const box = panelPixelBox(panel, W, H, gutterPx);
  if (box.w < W * 0.13 || box.h < H * 0.085) return;
  const placeSize = Math.max(10, H * 0.0145);
  const subSize = placeSize * 0.76;
  ctx.font = `700 ${placeSize}px Oswald`;
  const placeW = tag.place ? ctx.measureText(tag.place.toUpperCase()).width : 0;
  ctx.font = `400 ${subSize}px Oswald`;
  const subW = tag.sub ? ctx.measureText(tag.sub.toUpperCase()).width : 0;
  const padX = placeSize * 0.55;
  const chipW = Math.max(placeW, subW) + padX * 2 + 5;
  const chipH = placeSize + subSize + placeSize * 0.85;
  const x = box.x + placeSize * 0.5;
  let y = box.y + box.h - chipH - placeSize * 0.5;
  y = Math.min(y, bandTop - chipH - 6);
  if (y < box.y + 2) return;
  const chip = { x, y, w: chipW, h: chipH };
  if (avoids && avoids.some((a) => rectsOverlap(chip, a))) return;
  ctx.fillStyle = 'rgba(8,4,16,0.74)';
  ctx.fillRect(x, y, chipW, chipH);
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, 3.5, chipH);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (tag.place) {
    ctx.font = `700 ${placeSize}px Oswald`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(tag.place.toUpperCase(), x + padX + 3, y + placeSize * 1.05);
  }
  if (tag.sub) {
    ctx.font = `400 ${subSize}px Oswald`;
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText(tag.sub.toUpperCase(), x + padX + 3, y + placeSize * 1.05 + subSize * 1.25);
  }
}

function drawSeal(ctx, cx, cy, r, captions, grade) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.14);
  ctx.beginPath();
  const spikes = 28;
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.84;
    const a = (i * Math.PI) / spikes;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = grade.accent;
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.045);
  ctx.strokeStyle = '#14081f';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  ctx.fillStyle = grade.band;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = Math.max(1, r * 0.02);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  const words = (captions.seal || '').toUpperCase().split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > 10 && line) {
      lines.push(line);
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) lines.push(line);
  const size = fitFontSize(ctx, lines[0] || '', 'Anton', '', r * 1.15, r * 0.3, 6);
  ctx.font = `${size}px Anton`;
  const startY = -((lines.length - 1) * size * 0.95) / 2 + size * 0.3;
  lines.forEach((l, i) => ctx.fillText(l, 0, startY + i * size * 0.95));
  if (captions.sealSub) {
    ctx.font = `600 ${r * 0.17}px Oswald`;
    ctx.fillStyle = grade.accent;
    ctx.fillText(captions.sealSub.toUpperCase(), 0, r * 0.48);
  }
  ctx.restore();
}

function drawBarcode(ctx, x, y, w, h, seedText) {
  ctx.fillStyle = '#f7f3ea';
  ctx.fillRect(x, y, w, h);
  const rnd = seededRandom(hashString(seedText));
  ctx.fillStyle = '#14100c';
  let bx = x + w * 0.07;
  const bottom = y + h * 0.78;
  while (bx < x + w * 0.9) {
    const bw = (0.5 + rnd() * 2.2) * (w / 42);
    if (rnd() > 0.32) ctx.fillRect(bx, y + h * 0.1, bw, bottom - y - h * 0.1);
    bx += bw + (0.6 + rnd() * 1.6) * (w / 42);
  }
  ctx.font = `400 ${h * 0.16}px Oswald`;
  ctx.textAlign = 'center';
  ctx.fillText('0 61126 2026 06', x + w / 2, y + h * 0.95);
}

// ---------- the cover ----------

export function drawCover(ctx, W, H, view) {
  const grade = view.grade;
  const fx = view.fx;
  const caps = view.captions;
  const gutterPx = Math.max(5, Math.round(W * 0.0062));
  const gutterColor = view.gutterStyle === 'cream' ? '#f6ead2' : view.gutterStyle === 'dark' ? '#0b0714' : grade.gutter;

  ctx.save();
  ctx.fillStyle = gutterColor;
  ctx.fillRect(0, 0, W, H);

  const panels = view.panels;
  panels.forEach((panel, i) => {
    const photo = view.photos[view.assign[i] ?? i % Math.max(1, view.photos.length)] || null;
    const pv = view.views[i] || { dx: 0, dy: 0, zoom: 1 };
    drawPanelPhoto(ctx, panel, photo, pv, fx, grade, W, H, gutterPx);
  });

  // print finish: halftone dots
  if (view.halftone) {
    const spacing = Math.max(7, W * 0.0105);
    ctx.fillStyle = 'rgba(10,4,18,0.20)';
    for (let y = spacing / 2; y < H; y += spacing) {
      for (let x = spacing / 2; x < W; x += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, spacing * 0.21, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // grain
  if (fx.grain > 0.01) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = fx.grain * 0.5;
    ctx.fillStyle = ctx.createPattern(getNoiseCanvas(), 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // paper texture
  if (view.paper) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#fff3d6';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = ctx.createPattern(getNoiseCanvas(), 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // vignette
  if (fx.vignette > 0.01) {
    const rad = Math.hypot(W, H) * 0.62;
    const grad = ctx.createRadialGradient(W / 2, H / 2, rad * 0.45, W / 2, H / 2, rad);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(4,0,10,${(fx.vignette * 0.62).toFixed(3)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // ----- layout metrics for the dressing -----
  const bandH = Math.round(H * 0.088);
  const bandTop = H - bandH;
  const titleTop = H * 0.052;
  const titleSize = fitFontSize(ctx, caps.title || '', 'Anton', '', W * 0.94, H * 0.175, 12);
  const titleBase = titleTop + titleSize * 0.82;
  const titleWidth = ctx.measureText(caps.title || '').width;
  const subY = titleBase + H * 0.062;
  const sealR = Math.min(W, H) * 0.088;
  const sealCx = W * 0.082 + sealR * 0.4;
  const sealCy = bandTop - sealR - H * 0.018;
  let pillRect = null;
  if (caps.wanted) {
    ctx.font = `700 ${Math.round(H * 0.02)}px Oswald`;
    const ww = ctx.measureText(caps.wanted.toUpperCase()).width;
    const pw = ww + H * 0.045;
    const ph = H * 0.038;
    pillRect = { x: W - pw - W * 0.018, y: bandTop - ph - H * 0.02, w: pw, h: ph };
  }

  // ----- bottom band first: palms and print furniture sit UNDER the
  // seal and the wanted pill, never scribbled across them -----
  ctx.fillStyle = grade.band;
  ctx.fillRect(0, bandTop, W, bandH);
  ctx.fillStyle = grade.accent;
  ctx.fillRect(0, bandTop, W, Math.max(2, H * 0.0035));
  const palmBase = bandTop + bandH * 0.35;
  drawPalm(ctx, W * 0.035, palmBase, H * 0.105, 0.25, grade.band);
  drawPalm(ctx, W * 0.105, palmBase, H * 0.075, -0.2, grade.band);
  drawPalm(ctx, W * 0.955, palmBase, H * 0.115, -0.28, grade.band);
  drawPalm(ctx, W * 0.885, palmBase, H * 0.07, 0.18, grade.band);
  if (W > H) drawPalm(ctx, W * 0.19, palmBase, H * 0.055, 0.3, grade.band);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (caps.tagline) {
    const tSize = fitFontSize(ctx, caps.tagline.toUpperCase(), 'Oswald', '600', W * 0.52, H * 0.027, 9);
    ctx.font = `600 ${tSize}px Oswald`;
    try { ctx.letterSpacing = `${Math.max(1, Math.round(W * 0.0035))}px`; } catch (e) { /* ignore */ }
    ctx.fillStyle = grade.bandText;
    ctx.fillText(caps.tagline.toUpperCase(), W / 2, bandTop + bandH * 0.64);
    try { ctx.letterSpacing = '0px'; } catch (e) { /* ignore */ }
  }
  if (W >= H) {
    ctx.font = `400 ${Math.max(8, H * 0.0105)}px Oswald`;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('SUNSET STATE COVER STUDIO · PRINTED IN LEONIDA · 2026', W * 0.018, bandTop + bandH * 0.6);
    ctx.textAlign = 'center';
  }
  const bcW = W * (W >= H ? 0.072 : 0.11);
  drawBarcode(ctx, W - bcW - W * 0.018, bandTop + bandH * 0.2, bcW, bandH * 0.62, (caps.title || '') + (caps.volume || ''));

  // ----- panel tags, skipping any chip that would collide with the
  // lettering block, the seal or the wanted pill -----
  if (view.showTags) {
    const avoids = [
      { x: W * 0.13, y: 0, w: W * 0.74, h: subY + H * 0.085 },
      { x: sealCx - sealR - 4, y: sealCy - sealR - 4, w: sealR * 2 + 8, h: sealR * 2 + 8 },
    ];
    if (pillRect) avoids.push({ x: pillRect.x - 4, y: pillRect.y - 4, w: pillRect.w + 8, h: pillRect.h + 8 });
    panels.forEach((panel, i) => drawPanelTag(ctx, panel, view.tags[i], W, H, gutterPx, bandTop, grade.accent, avoids));
  }

  // ----- lettering block -----
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const titleGrad = ctx.createLinearGradient(0, titleTop, 0, titleTop + titleSize);
  titleGrad.addColorStop(0, grade.title[0]);
  titleGrad.addColorStop(0.55, grade.title[1]);
  titleGrad.addColorStop(1, grade.title[2]);
  ctx.font = `${titleSize}px Anton`;
  ctx.fillStyle = 'rgba(10,2,18,0.88)';
  ctx.fillText(caps.title || '', W / 2, titleBase + titleSize * 0.055);
  ctx.lineWidth = titleSize * 0.17;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#14081f';
  ctx.strokeText(caps.title || '', W / 2, titleBase);
  ctx.fillStyle = titleGrad;
  ctx.fillText(caps.title || '', W / 2, titleBase);

  // neon script subtitle, keyed with a dark outline so it survives
  // bright skies, then filled twice for the glow
  if (caps.subtitle) {
    const subSize = fitFontSize(ctx, caps.subtitle, 'Pacifico', '', W * 0.8, H * 0.046, 10);
    ctx.font = `${subSize}px Pacifico`;
    ctx.lineWidth = subSize * 0.22;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(16,3,26,0.9)';
    ctx.strokeText(caps.subtitle, W / 2, subY);
    ctx.shadowColor = grade.script;
    ctx.shadowBlur = H * 0.022;
    ctx.fillStyle = grade.script;
    ctx.fillText(caps.subtitle, W / 2, subY);
    ctx.fillText(caps.subtitle, W / 2, subY);
    ctx.shadowBlur = 0;
  }

  // stars + quote
  const stars = Math.max(0, Math.min(10, caps.stars || 0));
  if (stars > 0 || caps.quote) {
    const starY = subY + H * 0.038;
    if (stars > 0) {
      const r = H * 0.0135;
      const totalW = stars * r * 2.5;
      for (let i = 0; i < stars; i++) {
        drawStar(ctx, W / 2 - totalW / 2 + r + i * r * 2.5, starY, r, '#ffd23c');
      }
    }
    if (caps.quote) {
      ctx.font = `600 ${Math.max(9, H * 0.016)}px Oswald`;
      try { ctx.letterSpacing = `${Math.round(W * 0.0022)}px`; } catch (e) { /* older canvas */ }
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 4;
      ctx.fillText(caps.quote.toUpperCase(), W / 2, starY + H * 0.036);
      ctx.shadowBlur = 0;
      try { ctx.letterSpacing = '0px'; } catch (e) { /* ignore */ }
    }
  }

  // ribbon across the top-right corner
  if (caps.ribbon) {
    ctx.save();
    ctx.translate(W * 0.945, H * 0.052);
    ctx.rotate(Math.PI / 4);
    const rh = H * 0.034;
    ctx.fillStyle = '#14081f';
    ctx.fillRect(-W * 0.17, -rh / 2, W * 0.34, rh);
    ctx.strokeStyle = grade.accent;
    ctx.lineWidth = Math.max(1, H * 0.002);
    ctx.strokeRect(-W * 0.17, -rh / 2, W * 0.34, rh);
    const rSize = fitFontSize(ctx, caps.ribbon.toUpperCase(), 'Oswald', '700', W * 0.3, rh * 0.52, 7);
    ctx.font = `700 ${rSize}px Oswald`;
    try { ctx.letterSpacing = '2px'; } catch (e) { /* ignore */ }
    ctx.fillStyle = '#ffffff';
    ctx.fillText(caps.ribbon.toUpperCase(), 0, rSize * 0.36);
    try { ctx.letterSpacing = '0px'; } catch (e) { /* ignore */ }
    ctx.restore();
  }

  // volume tag: top-right, dropping below the title when a wide title
  // would otherwise run underneath the box
  if (caps.volume) {
    ctx.font = `${Math.round(H * 0.03)}px Anton`;
    const vw = ctx.measureText(caps.volume.toUpperCase()).width;
    const boxW = vw + H * 0.036;
    const boxH = H * 0.052;
    const bx = W - boxW - W * 0.018;
    let by = H * 0.128;
    if (W / 2 + titleWidth / 2 > bx - 6) by = titleBase + H * 0.028;
    ctx.fillStyle = 'rgba(10,4,20,0.78)';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = grade.accent;
    ctx.lineWidth = Math.max(1, H * 0.0022);
    ctx.strokeRect(bx, by, boxW, boxH);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(caps.volume.toUpperCase(), bx + boxW / 2, by + boxH * 0.68);
    ctx.font = `400 ${Math.max(8, H * 0.011)}px Oswald`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('LEONIDA EDITION', bx + boxW / 2, by + boxH + H * 0.02);
  }

  // seal and wanted pill ride on top of the band's palms
  drawSeal(ctx, sealCx, sealCy, sealR, caps, grade);
  if (caps.wanted && pillRect) {
    ctx.fillStyle = '#0a0414';
    ctx.fillRect(pillRect.x, pillRect.y, pillRect.w, pillRect.h);
    ctx.strokeStyle = '#ffd23c';
    ctx.lineWidth = Math.max(1, H * 0.002);
    ctx.strokeRect(pillRect.x, pillRect.y, pillRect.w, pillRect.h);
    ctx.font = `700 ${Math.round(H * 0.02)}px Oswald`;
    ctx.fillStyle = '#ffd23c';
    ctx.fillText(caps.wanted.toUpperCase(), pillRect.x + pillRect.w / 2, pillRect.y + pillRect.h * 0.68);
  }

  // selection chrome (editor only, never on exports)
  if (!view.forExport && view.selected != null && panels[view.selected]) {
    panelPath(ctx, panels[view.selected], W, H, gutterPx);
    ctx.strokeStyle = grade.accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    const b = panelPixelBox(panels[view.selected], W, H, gutterPx);
    ctx.beginPath();
    ctx.arc(b.x + 16, b.y + 16, 12, 0, Math.PI * 2);
    ctx.fillStyle = grade.accent;
    ctx.fill();
    ctx.fillStyle = '#14081f';
    ctx.font = '700 13px Oswald';
    ctx.fillText(String(view.selected + 1), b.x + 16, b.y + 20.5);
  }

  ctx.restore();
}

export function renderCoverCanvas(W, H, view) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  drawCover(canvas.getContext('2d'), W, H, view);
  return canvas;
}
