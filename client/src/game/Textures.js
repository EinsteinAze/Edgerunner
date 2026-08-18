import * as THREE from "three";

// Procedural, canvas-based texture generator. No external image files —
// everything here is drawn at runtime so the game has zero asset downloads
// and can't break on a missing file. Results are cached by cache key so
// repeated materials (e.g. every wall) share one GPU texture.

const cache = new Map();

function canvas(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}

function rand(seed) {
  // small deterministic PRNG so a given cache key always regenerates identically
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function memo(key, build) {
  if (cache.has(key)) return cache.get(key);
  const tex = build();
  cache.set(key, tex);
  return tex;
}

/** Subtle noise + streaks + stains for walls/concrete. Returns {map, roughnessMap, bumpMap}. */
export function grungeSet(baseColor, key, { streaks = true, stains = true } = {}) {
  return memo(`grunge:${baseColor}:${key}`, () => {
    const size = 512;
    const cv = canvas(size);
    const ctx = cv.getContext("2d");
    const rnd = rand(hashStr(key));

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    // fine noise speckle
    const img = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (rnd() - 0.5) * 22;
      img.data[i] = clamp8(img.data[i] + n);
      img.data[i + 1] = clamp8(img.data[i + 1] + n);
      img.data[i + 2] = clamp8(img.data[i + 2] + n);
    }
    ctx.putImageData(img, 0, 0);

    if (streaks) {
      ctx.globalAlpha = 0.05;
      for (let i = 0; i < 40; i++) {
        const x = rnd() * size;
        const w = 1 + rnd() * 3;
        const grad = ctx.createLinearGradient(x, 0, x + w, size);
        grad.addColorStop(0, "black");
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(x, 0, w, size);
      }
      ctx.globalAlpha = 1;
    }

    if (stains) {
      ctx.globalAlpha = 0.12;
      for (let i = 0; i < 10; i++) {
        const x = rnd() * size;
        const y = rnd() * size;
        const r = 20 + rnd() * 80;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, "black");
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    const map = new THREE.CanvasTexture(cv);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;

    // roughness map: grayscale variant of the same noise (brighter = rougher)
    const rc = canvas(size);
    const rctx = rc.getContext("2d");
    rctx.putImageData(img, 0, 0);
    rctx.globalCompositeOperation = "saturation";
    rctx.fillStyle = "black";
    rctx.fillRect(0, 0, size, size);
    const roughnessMap = new THREE.CanvasTexture(rc);
    roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;

    return { map, roughnessMap };
  });
}

/** Brushed metal with faint scratches, for props/panels/consoles. */
export function metalSet(baseColor, key) {
  return memo(`metal:${baseColor}:${key}`, () => {
    const size = 256;
    const cv = canvas(size);
    const ctx = cv.getContext("2d");
    const rnd = rand(hashStr(key) + 7);

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    // horizontal brushed-metal lines
    for (let y = 0; y < size; y++) {
      const shade = 0.9 + rnd() * 0.2;
      ctx.fillStyle = `rgba(255,255,255,${(shade - 1) * 0.4 + 0.03})`;
      ctx.fillRect(0, y, size, 1);
    }

    // scratches
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    for (let i = 0; i < 26; i++) {
      ctx.lineWidth = 0.5 + rnd() * 1.2;
      ctx.beginPath();
      const x = rnd() * size;
      const y = rnd() * size;
      const len = 10 + rnd() * 60;
      const ang = (rnd() - 0.5) * 0.3;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
    // grime edges
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    for (let i = 0; i < 8; i++) {
      ctx.lineWidth = 1 + rnd() * 2;
      ctx.beginPath();
      const x = rnd() * size;
      const y = rnd() * size;
      const len = 15 + rnd() * 40;
      const ang = (rnd() - 0.5) * Math.PI;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }

    const map = new THREE.CanvasTexture(cv);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    return { map };
  });
}

/** Dirty/scuffed floor tile texture. */
export function floorSet(baseColor, key) {
  return memo(`floor:${baseColor}:${key}`, () => {
    const size = 512;
    const cv = canvas(size);
    const ctx = cv.getContext("2d");
    const rnd = rand(hashStr(key) + 13);

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    // panel seams
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 2;
    const cell = size / 6;
    for (let i = 0; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cell);
      ctx.lineTo(size, i * cell);
      ctx.stroke();
    }

    // scuffs + dirt
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 120; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const r = 2 + rnd() * 10;
      ctx.fillStyle = rnd() > 0.5 ? "black" : "white";
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.4, rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const map = new THREE.CanvasTexture(cv);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(2, 2);
    return { map };
  });
}

/** A fake UI/data readout for monitor and terminal screens — emits its own light via emissiveMap. */
export function screenTexture(key, { title = "ARASAKA OS", lines = 6, color = "#18e0e0", accent = "#ff2fd0" } = {}) {
  return memo(`screen:${key}:${title}`, () => {
    const w = 256, h = 192;
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d");
    const rnd = rand(hashStr(key) + 21);

    ctx.fillStyle = "#020408";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = color;
    ctx.font = "bold 12px monospace";
    ctx.fillText(title, 8, 16);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(8, 22);
    ctx.lineTo(w - 8, 22);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.font = "9px monospace";
    for (let i = 0; i < lines; i++) {
      const y = 34 + i * 13;
      ctx.fillStyle = rnd() > 0.82 ? accent : color;
      ctx.globalAlpha = 0.55 + rnd() * 0.45;
      const barLen = 6 + Math.floor(rnd() * 22);
      ctx.fillText("> " + "█".repeat(barLen), 8, y);
    }
    ctx.globalAlpha = 1;

    // scanline overlay
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "black";
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

/** A hazard/warning placard decal. */
export function warningSignTexture(text = "DANGER", key = text) {
  return memo(`warn:${key}`, () => {
    const size = 256;
    const cv = canvas(size);
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#1a1502";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "#f6c93a";
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, size - 20, size - 20);

    ctx.save();
    ctx.translate(size / 2, size * 0.4);
    ctx.fillStyle = "#f6c93a";
    ctx.beginPath();
    ctx.moveTo(0, -46);
    ctx.lineTo(46, 40);
    ctx.lineTo(-46, 40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1a1502";
    ctx.font = "bold 56px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("!", 0, 30);
    ctx.restore();

    ctx.fillStyle = "#f6c93a";
    ctx.font = "bold 22px monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, size / 2, size * 0.85);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

/** A crude, faded child's crayon drawing pinned to a wall — environmental storytelling. */
export function drawingTexture(key) {
  return memo(`drawing:${key}`, () => {
    const size = 256;
    const cv = canvas(size);
    const ctx = cv.getContext("2d");
    const rnd = rand(hashStr(key) + 31);

    ctx.fillStyle = "#eee6d3";
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = rnd() > 0.5 ? "#000" : "#8b7355";
      ctx.fillRect(rnd() * size, rnd() * size, 1, 1);
    }
    ctx.globalAlpha = 1;

    const palette = ["#e0524a", "#4a90c4", "#e8c84a", "#6ab86a", "#a869c9"];
    // simple stick figures holding hands — five children
    const baseY = size * 0.72;
    const xs = [0.2, 0.36, 0.52, 0.68, 0.84].map((f) => f * size);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let i = 0; i < xs.length; i++) {
      ctx.strokeStyle = palette[i % palette.length];
      const x = xs[i];
      const headR = 10;
      ctx.beginPath();
      ctx.arc(x, baseY - 40, headR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, baseY - 30);
      ctx.lineTo(x, baseY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, baseY - 15);
      ctx.lineTo(x - 14, baseY - 22);
      ctx.moveTo(x, baseY - 15);
      ctx.lineTo(x + 14, baseY - 22);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x - 10, baseY + 22);
      ctx.moveTo(x, baseY);
      ctx.lineTo(x + 10, baseY + 22);
      ctx.stroke();
    }
    ctx.strokeStyle = "#c9a04a";
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(size * 0.15, baseY + 25);
    ctx.lineTo(size * 0.85, baseY + 25);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#3a3226";
    ctx.font = "italic 14px sans-serif";
    ctx.fillText("us", size * 0.08, size * 0.15);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

function clamp8(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}
