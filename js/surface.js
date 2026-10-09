/**
 * SurfaceGenerator — five procedurally-drawn surface types.
 *
 * Each surface:
 *  - cleanCanvas  : off-screen canvas with the shiny, clean texture
 *  - dirtyCanvas  : off-screen canvas with the grime/dirt overlay
 *  - dirtyCtx     : 2-D context of dirtyCanvas (used by game to erase dirt)
 *  - pressureZones: array of stubborn-stain descriptors
 *  - label        : human-readable name shown in the HUD
 */
const SurfaceGenerator = (() => {

  // ── Noise helpers ──────────────────────────────────────────────────────────

  function hash(x, y, s) {
    const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.1) * 43758.5453;
    return n - Math.floor(n);
  }

  function smoothNoise(x, y, s) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix,        fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    return (hash(ix,   iy,   s) * (1-ux) + hash(ix+1, iy,   s) * ux) * (1-uy)
         + (hash(ix,   iy+1, s) * (1-ux) + hash(ix+1, iy+1, s) * ux) * uy;
  }

  function fractal(x, y, s, oct = 4) {
    let v = 0, a = 0.5, f = 1, m = 0;
    for (let i = 0; i < oct; i++) {
      v += smoothNoise(x * f, y * f, s + i * 137) * a;
      m += a; a *= 0.5; f *= 2;
    }
    return v / m;
  }

  // ── Clean texture painters ─────────────────────────────────────────────────

  function paintCar(ctx, w, h) {
    // Metallic dark-navy paint
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0,   '#3a4a6b');
    g.addColorStop(0.4, '#4e6080');
    g.addColorStop(0.7, '#2c3a55');
    g.addColorStop(1,   '#1e2a40');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Clear-coat shimmer highlight
    const shine = ctx.createRadialGradient(w*0.35, h*0.28, 0, w*0.35, h*0.28, w*0.55);
    shine.addColorStop(0, 'rgba(255,255,255,0.55)');
    shine.addColorStop(0.4, 'rgba(255,255,255,0.12)');
    shine.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, w, h);

    // Panel crease line
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.52);
    ctx.bezierCurveTo(w*0.25, h*0.48, w*0.75, h*0.56, w, h*0.52);
    ctx.stroke();
  }

  function paintPatio(ctx, w, h) {
    const tW = Math.floor(w / 4.5);
    const tH = Math.floor(h / 7);
    ctx.fillStyle = '#8e9e9b';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row <= Math.ceil(h/tH)+1; row++) {
      for (let col = -1; col <= Math.ceil(w/tW)+1; col++) {
        const ox  = (row % 2) * (tW / 2);
        const x   = col * tW + ox;
        const y   = row * tH;
        const v   = ((col * 17 + row * 31) & 0xff) % 30 - 15;
        const b   = 180 + v;
        ctx.fillStyle = `rgb(${b-10},${b+5},${b})`;
        ctx.fillRect(x+3, y+3, tW-6, tH-6);
      }
    }
    ctx.fillStyle = '#6a7a77';
    for (let row = 0; row <= Math.ceil(h/tH)+1; row++) {
      ctx.fillRect(0, row*tH, w, 4);
      const ox = (row % 2) * (tW / 2);
      for (let col = -1; col <= Math.ceil(w/tW)+1; col++) {
        ctx.fillRect(col*tW+ox, row*tH, 4, tH);
      }
    }
  }

  function paintDriveway(ctx, w, h) {
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, w, h);
    // Aggregate pebbles
    for (let i = 0; i < 900; i++) {
      const px = Math.random() * w;
      const py = Math.random() * h;
      const pr = 1 + Math.random() * 2.5;
      const s  = 50 + Math.floor(Math.random() * 45);
      ctx.fillStyle = `rgb(${s},${s},${s})`;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI*2);
      ctx.fill();
    }
    // Subtle lane markings
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.setLineDash([30, 20]);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(w/2, 0);
    ctx.lineTo(w/2, h);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function paintDeck(ctx, w, h) {
    const bH = Math.floor(h / 7);
    for (let i = 0; i <= Math.ceil(h/bH)+1; i++) {
      const y = i * bH;
      const v = (i % 3) * 8;
      ctx.fillStyle = `rgb(${120+v},${78+v},${28+v})`;
      ctx.fillRect(0, y, w, bH-3);
      // Grain lines
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth   = 1;
      for (let g = 0; g < 6; g++) {
        const gx = (g / 6) * w;
        const jit = (Math.random() - 0.5) * 18;
        ctx.beginPath();
        ctx.moveTo(gx + jit, y);
        ctx.bezierCurveTo(gx+4+jit, y+bH*0.33, gx-3+jit, y+bH*0.67, gx+2+jit, y+bH);
        ctx.stroke();
      }
    }
    // Gaps
    ctx.fillStyle = '#3a1e04';
    for (let i = 0; i <= Math.ceil(h/bH)+1; i++) {
      ctx.fillRect(0, i*bH-1, w, 4);
    }
  }

  function paintWall(ctx, w, h) {
    const bW = Math.floor(w / 5.5);
    const bH = Math.floor(h / 9);
    // Mortar background
    ctx.fillStyle = '#c8c0b4';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row <= Math.ceil(h/bH)+1; row++) {
      const ox = (row % 2) * (bW / 2);
      for (let col = -1; col <= Math.ceil(w/bW)+1; col++) {
        const x  = col * bW + ox;
        const y  = row * bH;
        const rv = ((col * 13 + row * 7) & 0xff) % 28 - 14;
        const r  = 185 + rv;
        const g  = 60  + (rv >> 1);
        ctx.fillStyle = `rgb(${r},${g},${g-20})`;
        ctx.fillRect(x+3, y+3, bW-6, bH-6);
        // Subtle brick texture
        ctx.fillStyle = `rgba(0,0,0,0.06)`;
        ctx.fillRect(x+3, y + bH*0.55, bW-6, bH*0.1);
      }
    }
  }

  // ── Dirt overlay painter ───────────────────────────────────────────────────

  /**
   * @returns {Array} pressureZones
   */
  function paintDirt(dCtx, w, h, dirtRGB, intensity, seed, level) {
    // Generate noise at ¼ scale (16× fewer pixels) then upscale with blur
    const SCALE    = 4;
    const sw       = Math.ceil(w / SCALE);
    const sh       = Math.ceil(h / SCALE);
    const tmpCvs   = document.createElement('canvas');
    tmpCvs.width   = sw;
    tmpCvs.height  = sh;
    const tmpCtx   = tmpCvs.getContext('2d');
    const imgData  = tmpCtx.createImageData(sw, sh);
    const d        = imgData.data;
    const str      = Math.min(0.58 + level * 0.035, 0.94) * intensity;
    const [dr, dg, db] = dirtRGB;

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const idx = (y * sw + x) * 4;
        const ox  = x * SCALE,  oy = y * SCALE;  // full-res equivalent coords
        const n   = fractal(ox/90, oy/90, seed) * 0.55
                  + fractal(ox/30, oy/30, seed+500) * 0.30
                  + smoothNoise(ox/12, oy/12, seed+999) * 0.15;

        if (n > 0.32) {
          const a    = Math.min((n - 0.32) / 0.42 * str, 1);
          const dark = Math.min(a * 1.4, 1);
          d[idx]   = Math.round(dr * (1 - dark * 0.35));
          d[idx+1] = Math.round(dg * (1 - dark * 0.35));
          d[idx+2] = Math.round(db * (1 - dark * 0.35));
          d[idx+3] = Math.round(a  * 255);
        }
      }
    }
    tmpCtx.putImageData(imgData, 0, 0);

    // Scale up onto the destination context; blur smooths the 4× pixelation
    dCtx.save();
    dCtx.filter = 'blur(10px)';
    dCtx.drawImage(tmpCvs, 0, 0, w, h);
    dCtx.restore();

    // Pressure zones — thick stubborn stains
    const zones    = [];
    const numZones = 3 + Math.min(Math.floor(level / 2), 4);

    for (let i = 0; i < numZones; i++) {
      const h1 = hash(i * 3.7, seed * 0.01, seed + i);
      const h2 = hash(seed * 0.01, i * 2.3, seed + i + 50);
      const sx  = 0.08*w + h1 * 0.84*w;
      const sy  = 0.12*h + h2 * 0.76*h;
      const rad = 18 + hash(i, i*2, seed) * 32;

      zones.push({ x: sx, y: sy, radius: rad, cleanProgress: 0, cleaned: false });

      const sg = dCtx.createRadialGradient(sx, sy, 0, sx, sy, rad);
      sg.addColorStop(0,   `rgba(${dr},${dg},${db},0.97)`);
      sg.addColorStop(0.5, `rgba(${dr},${dg},${db},0.82)`);
      sg.addColorStop(0.85,`rgba(${dr},${dg},${db},0.45)`);
      sg.addColorStop(1,   `rgba(${dr},${dg},${db},0)`);
      dCtx.fillStyle = sg;
      dCtx.beginPath();
      dCtx.arc(sx, sy, rad, 0, Math.PI*2);
      dCtx.fill();
    }
    return zones;
  }

  // ── Surface type registry ──────────────────────────────────────────────────

  const TYPES = [
    { label: 'CAR HOOD',     painter: paintCar,      dirtRGB: [55, 35, 15], intensity: 0.88 },
    { label: 'PATIO TILES',  painter: paintPatio,    dirtRGB: [30, 65, 25], intensity: 0.82 },
    { label: 'DRIVEWAY',     painter: paintDriveway, dirtRGB: [18, 18, 18], intensity: 0.92 },
    { label: 'WOODEN DECK',  painter: paintDeck,     dirtRGB: [25, 55, 18], intensity: 0.78 },
    { label: 'BRICK WALL',   painter: paintWall,     dirtRGB: [12, 28, 10], intensity: 0.84 },
  ];

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Build a surface object.
   * @param {number} w           canvas pixel width
   * @param {number} h           canvas pixel height
   * @param {number} level       game level (1+)
   * @param {number} typeIndex   which surface type (mod-wrapped)
   * @param {number} seed        random seed for noise variation
   */
  function create(w, h, level, typeIndex, seed) {
    const type = TYPES[typeIndex % TYPES.length];

    // Clean layer
    const cCvs = document.createElement('canvas');
    cCvs.width  = w;  cCvs.height = h;
    type.painter(cCvs.getContext('2d'), w, h);

    // Dirty overlay
    const dCvs = document.createElement('canvas');
    dCvs.width  = w;  dCvs.height = h;
    const dCtx  = dCvs.getContext('2d', { willReadFrequently: true });
    const zones = paintDirt(dCtx, w, h, type.dirtRGB, type.intensity, seed, level);

    return { label: type.label, cleanCanvas: cCvs, dirtyCanvas: dCvs, dirtyCtx: dCtx, pressureZones: zones };
  }

  function typeCount() { return TYPES.length; }

  return { create, typeCount };
})();
