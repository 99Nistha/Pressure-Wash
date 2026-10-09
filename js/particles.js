/**
 * ParticleSystem — water spray droplets + sparkle/star bursts.
 * Renders on its own canvas so it sits above dirty + clean layers.
 */
const ParticleSystem = (() => {
  let canvas, ctx;
  const pool = []; // active particles

  // ── Init / Resize ──────────────────────────────────────────────────────────

  function init(pCanvas) {
    canvas = pCanvas;
    ctx    = canvas.getContext('2d');
  }

  function resize(w, h) {
    canvas.width  = w;
    canvas.height = h;
  }

  // ── Spawn helpers ──────────────────────────────────────────────────────────

  /**
   * Water spray at (x, y).
   * @param {number} x
   * @param {number} y
   * @param {number} intensity  0–3, scales count and speed
   */
  /**
   * Water spray at (x, y).
   * @param {number} x
   * @param {number} y
   * @param {number} intensity  0–3, scales count and speed
   * @param {number} [dir]      stroke direction angle (radians); omit for omnidirectional
   */
  function sprayAt(x, y, intensity, dir) {
    const count  = 4 + Math.round(intensity * 3);
    const hasDir = (dir != null);
    for (let i = 0; i < count; i++) {
      // Directional: spread ±70° around stroke; else fully random
      const a = hasDir
        ? dir + (Math.random() - 0.5) * 2.4
        : Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 2.5 * (intensity + 0.5);
      pool.push({
        type:  'drop',
        x, y,
        vx:    Math.cos(a) * speed,
        vy:    Math.sin(a) * speed - 0.8,
        life:  1,
        decay: 0.045 + Math.random() * 0.03,
        r:     1.5 + Math.random() * 2.5,
        hue:   195 + Math.random() * 20,
        sat:   85 + Math.random() * 10,
        lit:   65 + Math.random() * 20
      });
    }
  }

  /**
   * Pressure-zone mini sparkle at (x, y) — fewer, tighter.
   * @param {number} x
   * @param {number} y
   */
  function zonePop(x, y) {
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3;
      pool.push({
        type:  'spark',
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx:    Math.cos(angle) * speed,
        vy:    Math.sin(angle) * speed - 1.2,
        life:  1,
        decay: 0.025 + Math.random() * 0.02,
        r:     2 + Math.random() * 3,
        hue:   40 + Math.random() * 40,
        rot:   Math.random() * Math.PI * 2,
        rotV:  (Math.random() - 0.5) * 0.15
      });
    }
  }

  /**
   * Big completion sparkle burst at (cx, cy).
   * @param {number} cx
   * @param {number} cy
   */
  function sparkleAt(cx, cy) {
    // Gold/yellow sparkle dots
    for (let i = 0; i < 70; i++) {
      const angle = (i / 70) * Math.PI * 2 + Math.random() * 0.25;
      const speed = 1.5 + Math.random() * 5;
      pool.push({
        type:  'spark',
        x: cx + (Math.random() - 0.5) * 60,
        y: cy + (Math.random() - 0.5) * 60,
        vx:    Math.cos(angle) * speed,
        vy:    Math.sin(angle) * speed - 2,
        life:  1,
        decay: 0.012 + Math.random() * 0.014,
        r:     2.5 + Math.random() * 4,
        hue:   42 + Math.random() * 28,
        rot:   Math.random() * Math.PI * 2,
        rotV:  (Math.random() - 0.5) * 0.12
      });
    }

    // Larger 5-pointed stars
    for (let i = 0; i < 22; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3.5;
      pool.push({
        type:  'star',
        x: cx + (Math.random() - 0.5) * 100,
        y: cy + (Math.random() - 0.5) * 100,
        vx:    Math.cos(angle) * speed,
        vy:    Math.sin(angle) * speed - 1.5,
        life:  1,
        decay: 0.007 + Math.random() * 0.008,
        r:     8 + Math.random() * 10,
        hue:   48 + Math.random() * 24,
        rot:   Math.random() * Math.PI * 2,
        rotV:  (Math.random() - 0.5) * 0.08
      });
    }

    // Blue/white water scatter
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      pool.push({
        type:  'drop',
        x: cx + (Math.random() - 0.5) * 80,
        y: cy + (Math.random() - 0.5) * 80,
        vx:    Math.cos(angle) * speed,
        vy:    Math.sin(angle) * speed - 2,
        life:  1,
        decay: 0.018 + Math.random() * 0.014,
        r:     2 + Math.random() * 3,
        hue:   200,
        sat:   90,
        lit:   80
      });
    }
  }

  // ── Draw helpers ───────────────────────────────────────────────────────────

  function drawStar5(x, y, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const outerA = rot + (i * 4 * Math.PI / 5) - Math.PI / 2;
      const innerA = outerA + (2 * Math.PI / 10);
      const ox     = x + Math.cos(outerA) * r;
      const oy     = y + Math.sin(outerA) * r;
      const ix     = x + Math.cos(innerA) * (r * 0.38);
      const iy     = y + Math.sin(innerA) * (r * 0.38);
      i === 0 ? ctx.moveTo(ox, oy) : ctx.lineTo(ox, oy);
      ctx.lineTo(ix, iy);
    }
    ctx.closePath();
  }

  // ── Main update / render loop ───────────────────────────────────────────────

  function update() {
    if (pool.length > 300) pool.splice(0, pool.length - 300);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = pool.length - 1; i >= 0; i--) {
      const p = pool[i];

      // Physics
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += 0.07;   // gravity
      p.vx *= 0.97;   // air drag
      p.vy *= 0.97;
      p.life -= p.decay;

      if (p.life <= 0) { pool.splice(i, 1); continue; }

      const alpha = Math.max(0, p.life);
      ctx.globalAlpha = alpha;

      if (p.type === 'drop') {
        ctx.fillStyle = `hsl(${p.hue}, ${p.sat}%, ${p.lit}%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fill();

      } else if (p.type === 'spark') {
        p.rot += p.rotV;
        const color = `hsl(${p.hue}, 100%, 65%)`;
        ctx.fillStyle = color;
        ctx.shadowBlur  = 8;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

      } else if (p.type === 'star') {
        p.rot += p.rotV;
        const color = `hsl(${p.hue}, 100%, 68%)`;
        ctx.fillStyle = color;
        ctx.shadowBlur  = 14;
        ctx.shadowColor = color;
        drawStar5(p.x, p.y, p.r * p.life, p.rot);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    ctx.globalAlpha = 1;
  }

  function clear() { pool.length = 0; }

  return { init, resize, sprayAt, sparkleAt, zonePop, update, clear };
})();
