/**
 * Game — main loop, drag-to-clean mechanic, level progression.
 *
 * Canvas stack (bottom → top):
 *   cleanCanvas    (z-index 1)  — shiny clean texture, never erased
 *   dirtyCanvas    (z-index 2)  — dirt overlay, erased by brush strokes
 *   #hud           (z-index 3)  — DOM HUD
 *   particleCanvas (z-index 4)  — particles + nozzle ring
 */
const Game = (() => {

  // ── Canvas references ─────────────────────────────────────────────────────
  const cleanCvs    = document.getElementById('cleanCanvas');
  const dirtyCvs    = document.getElementById('dirtyCanvas');
  const particleCvs = document.getElementById('particleCanvas');
  const cleanCtx    = cleanCvs.getContext('2d');
  const dirtyCtx    = dirtyCvs.getContext('2d', { willReadFrequently: true });
  let   pCtx        = null;   // particle canvas ctx — set in init()

  let W = 0, H = 0;

  // ── Game state ────────────────────────────────────────────────────────────
  let score         = 0;
  let streak        = 0;
  let level         = 1;
  let soapBombs     = 3;
  let surfaceIndex  = 0;
  let phase         = 'idle';  // idle | playing | completing | paused
  let currentSurface = null;
  let initialDirty  = 0;       // dirty-pixel count when surface first loaded
  let lastPtr       = null;    // {x, y} of previous pointer position
  let ptrActive     = false;
  let nozzlePos     = null;    // current pointer position for the ring visual
  let lastTapMs     = 0;       // for double-tap detection
  let lastMeasureMs = 0;
  let audioReady    = false;
  let comboTimer    = 0;       // time of last stroke (ms) — for combo multiplier
  let combo         = 1;       // current combo multiplier

  // ── Resize ────────────────────────────────────────────────────────────────

  function resize() {
    const container = document.getElementById('gameContainer');
    const nW = container.clientWidth;
    const nH = container.clientHeight;
    if (nW === W && nH === H) return;
    W = nW; H = nH;

    cleanCvs.width   = W; cleanCvs.height   = H;
    dirtyCvs.width   = W; dirtyCvs.height   = H;
    ParticleSystem.resize(W, H);

    if (currentSurface && phase !== 'idle') {
      // Regenerate surface at new dimensions (orientation change)
      const seed = Date.now() & 0xFFFF;
      currentSurface = SurfaceGenerator.create(W, H, level, surfaceIndex, seed);
      drawSurface();
      calibrateInitialDirt();
    }
  }

  // ── Surface draw ──────────────────────────────────────────────────────────

  function drawSurface() {
    cleanCtx.clearRect(0, 0, W, H);
    cleanCtx.drawImage(currentSurface.cleanCanvas, 0, 0, W, H);
    dirtyCtx.clearRect(0, 0, W, H);
    dirtyCtx.drawImage(currentSurface.dirtyCanvas, 0, 0, W, H);
  }

  // ── Cleanliness measurement ───────────────────────────────────────────────

  const SAMPLE_STEP = 14;  // sample every Nth pixel (balance accuracy vs speed)

  function countDirtyPixels() {
    const data  = dirtyCtx.getImageData(0, 0, W, H).data;
    let dirty = 0, total = 0;
    for (let y = 0; y < H; y += SAMPLE_STEP) {
      for (let x = 0; x < W; x += SAMPLE_STEP) {
        if (data[((y * W + x) * 4) + 3] > 10) dirty++;
        total++;
      }
    }
    return { dirty, total };
  }

  function calibrateInitialDirt() {
    const { dirty } = countDirtyPixels();
    initialDirty  = Math.max(dirty, 1);
    lastMeasureMs = 0;
  }

  /**
   * Measure progress, update HUD, trigger completion.
   * Throttled to once per 130 ms.
   */
  function measureProgress() {
    const now = performance.now();
    if (now - lastMeasureMs < 130) return;
    lastMeasureMs = now;

    const { dirty }  = countDirtyPixels();
    const cleanedPct = Math.round(Math.max(0, initialDirty - dirty) / initialDirty * 100);
    UI.updateProgress(cleanedPct);

    if (cleanedPct >= 92 && phase === 'playing') completeSurface();
  }

  // ── Load surface ──────────────────────────────────────────────────────────

  function loadSurface() {
    phase = 'idle';
    UI.hideComplete();
    ParticleSystem.clear();

    const seed      = Date.now() & 0xFFFF;
    currentSurface  = SurfaceGenerator.create(W, H, level, surfaceIndex, seed);
    surfaceIndex    = (surfaceIndex + 1) % SurfaceGenerator.typeCount();

    drawSurface();
    calibrateInitialDirt();
    UI.updateProgress(0);
    UI.setSurfaceLabel(currentSurface.label);
    combo = 1;
    phase = 'playing';
  }

  // ── Brush ─────────────────────────────────────────────────────────────────

  function brushR() {
    // Slightly larger brush at higher levels (caps at ~70 px)
    return Math.round(Math.min(W, H) * 0.054 + Math.min(level * 0.4, 18));
  }

  // ── Wash stroke ───────────────────────────────────────────────────────────

  function washAt(x, y, px, py) {
    const r    = brushR();
    const dist = Math.hypot(x - px, y - py);
    const dir  = dist > 0 ? Math.atan2(y - py, x - px) : null;

    // ── Erase dirt ──
    dirtyCtx.globalCompositeOperation = 'destination-out';
    dirtyCtx.lineWidth   = r * 2;
    dirtyCtx.lineCap     = 'round';
    dirtyCtx.lineJoin    = 'round';
    dirtyCtx.strokeStyle = 'rgba(0,0,0,1)';
    dirtyCtx.beginPath();
    dirtyCtx.moveTo(px, py);
    dirtyCtx.lineTo(x, y);
    dirtyCtx.stroke();
    dirtyCtx.globalCompositeOperation = 'source-over';

    // ── Effects — sub-step particles along the stroke ──
    AudioSystem.playSpray(x, W);
    const steps = dist > 0 ? Math.min(Math.ceil(dist / (r * 1.5)), 3) : 1;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      ParticleSystem.sprayAt(px + (x - px) * t, py + (y - py) * t, 1.6, dir);
    }

    // ── Combo decay ──
    const now = performance.now();
    if (now - comboTimer > 600) combo = Math.max(combo - 0.5, 1);
    comboTimer = now;
    combo      = Math.min(combo + 0.04, 4);

    // ── Score ──
    const dist = Math.hypot(x - px, y - py);
    const pts  = Math.max(1, Math.round(dist * 0.45 * combo * (1 + streak * 0.06)));
    score += pts;
    UI.updateScore(score);

    checkZones(x, y, r);
    measureProgress();
  }

  // ── Pressure zones ────────────────────────────────────────────────────────

  function checkZones(x, y, r) {
    if (!currentSurface) return;
    for (const zone of currentSurface.pressureZones) {
      if (zone.cleaned) continue;
      const d = Math.hypot(x - zone.x, y - zone.y);
      if (d < zone.radius + r) {
        zone.cleanProgress += 0.055;
        if (zone.cleanProgress >= 1) {
          zone.cleaned = true;
          AudioSystem.playPop();
          ParticleSystem.zonePop(zone.x, zone.y);
          if (navigator.vibrate) navigator.vibrate(55);
          const bonus = 50 + level * 5;
          score += bonus;
          UI.updateScore(score);
          UI.popScore(zone.x, zone.y - 40, `+${bonus} STAIN!`);
        }
      }
    }
  }

  // ── Soap bomb ─────────────────────────────────────────────────────────────

  function soapBomb(x, y) {
    if (soapBombs <= 0 || phase !== 'playing') return;
    soapBombs--;
    UI.updateSoap(soapBombs);
    AudioSystem.playSoap();
    if (navigator.vibrate) navigator.vibrate([30, 15, 60]);

    const r = Math.round(Math.min(W, H) * 0.26);
    UI.soapFlash(x, y, r);

    dirtyCtx.globalCompositeOperation = 'destination-out';
    const g = dirtyCtx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0,    'rgba(0,0,0,1)');
    g.addColorStop(0.62, 'rgba(0,0,0,0.92)');
    g.addColorStop(1,    'rgba(0,0,0,0)');
    dirtyCtx.fillStyle = g;
    dirtyCtx.beginPath();
    dirtyCtx.arc(x, y, r, 0, Math.PI * 2);
    dirtyCtx.fill();
    dirtyCtx.globalCompositeOperation = 'source-over';

    ParticleSystem.sparkleAt(x, y);
    lastMeasureMs = 0;
    setTimeout(measureProgress, 180);
  }

  // ── Complete surface ───────────────────────────────────────────────────────

  function completeSurface() {
    if (phase !== 'playing') return;
    phase = 'completing';

    // Final measurement
    const { dirty }  = countDirtyPixels();
    const pct        = Math.round(Math.max(0, initialDirty - dirty) / initialDirty * 100);
    const perfect    = pct >= 97;

    AudioSystem.playComplete(perfect);
    ParticleSystem.sparkleAt(W / 2, H * 0.44);
    if (perfect) setTimeout(() => ParticleSystem.sparkleAt(W * 0.25, H * 0.5),  300);
    if (perfect) setTimeout(() => ParticleSystem.sparkleAt(W * 0.75, H * 0.42), 550);

    streak++;
    UI.updateStreak(streak);
    UI.updateProgress(100);

    const baseBonus   = perfect ? 700 : 300;
    const streakBonus = streak >= 3 ? streak * 75 : (streak >= 2 ? 100 : 0);
    const comboBonus  = Math.round((combo - 1) * 200);
    score += baseBonus + streakBonus + comboBonus;
    UI.updateScore(score);

    if (window.ytgame && window.ytgame.game) {
      window.ytgame.game.reportScore(score);
    }

    const title     = perfect ? '✨ SPARKLING CLEAN! ✨' : '✓ CLEAN!';
    let   bonusLine = perfect ? `PERFECT! +${baseBonus}` : `+${baseBonus}`;
    if (streakBonus) bonusLine += `  🔥 STREAK ×${streak} +${streakBonus}`;
    if (comboBonus)  bonusLine += `  ⚡ COMBO +${comboBonus}`;
    UI.showComplete(title, bonusLine);

    setTimeout(() => {
      level++;
      if (level % 5 === 0) {
        soapBombs = Math.min(soapBombs + 1, 6);
        UI.updateSoap(soapBombs);
        AudioSystem.playLevelUp();
        UI.showLevelUp(level);
      }
      // Fade canvases out → load new surface → fade back in
      cleanCvs.style.opacity = '0';
      dirtyCvs.style.opacity = '0';
      setTimeout(() => {
        loadSurface();
        requestAnimationFrame(() => {
          cleanCvs.style.opacity = '1';
          dirtyCvs.style.opacity = '1';
        });
      }, 300);
    }, 2300);
  }

  // ── Nozzle ring (drawn on particle canvas each frame) ─────────────────────

  function drawNozzle() {
    if (!nozzlePos || !pCtx) return;
    const r          = brushR();
    const { x, y }   = nozzlePos;
    const t          = performance.now() / 1000;
    const pulseAlpha = 0.5 + 0.25 * Math.sin(t * 8);

    pCtx.save();
    // Outer glow ring
    pCtx.beginPath();
    pCtx.arc(x, y, r + 3, 0, Math.PI * 2);
    pCtx.strokeStyle = `rgba(120,210,255,${pulseAlpha})`;
    pCtx.lineWidth   = 2;
    pCtx.stroke();

    // Inner crosshair dot
    pCtx.beginPath();
    pCtx.arc(x, y, 2.5, 0, Math.PI * 2);
    pCtx.fillStyle = 'rgba(255,255,255,0.85)';
    pCtx.fill();
    pCtx.restore();
  }

  // ── Pressure zone hints ───────────────────────────────────────────────────

  function drawZoneHints() {
    if (!currentSurface || !pCtx || phase !== 'playing') return;
    const t = performance.now() / 1000;
    pCtx.save();
    for (const zone of currentSurface.pressureZones) {
      if (zone.cleaned) continue;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.8 + zone.x * 0.01);
      pCtx.beginPath();
      pCtx.arc(zone.x, zone.y, zone.radius * (0.92 + pulse * 0.08), 0, Math.PI * 2);
      pCtx.strokeStyle = `rgba(255,150,30,${0.15 + pulse * 0.18})`;
      pCtx.lineWidth   = 2.5;
      pCtx.stroke();
      // Progress fill ring
      if (zone.cleanProgress > 0) {
        pCtx.beginPath();
        pCtx.arc(zone.x, zone.y, zone.radius * 0.72, -Math.PI / 2,
                 -Math.PI / 2 + zone.cleanProgress * Math.PI * 2);
        pCtx.strokeStyle = 'rgba(0,220,160,0.55)';
        pCtx.lineWidth   = 3;
        pCtx.stroke();
      }
    }
    pCtx.restore();
  }

  // ── Main render loop ──────────────────────────────────────────────────────

  function loop() {
    ParticleSystem.update();   // clears particle canvas, redraws all particles
    drawNozzle();              // drawn on top of particles
    drawZoneHints();
    requestAnimationFrame(loop);
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  function getXY(e) {
    const rect = dirtyCvs.getBoundingClientRect();
    const sx   = W / rect.width;
    const sy   = H / rect.height;
    const src  = (e.touches && e.touches.length > 0) ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * sx,
      y: (src.clientY - rect.top)  * sy,
    };
  }

  function onDown(e) {
    e.preventDefault();
    if (!audioReady) {
      AudioSystem.init();
      audioReady = true;
    }
    AudioSystem.resume();
    UI.hideHint();

    const pos = getXY(e);
    nozzlePos = pos;

    // Double-tap / double-click → soap bomb
    const now = Date.now();
    if (now - lastTapMs < 290) {
      soapBomb(pos.x, pos.y);
      lastTapMs = 0;
      lastPtr   = null;
      return;
    }
    lastTapMs = now;

    if (phase !== 'playing') return;
    ptrActive = true;
    lastPtr   = { ...pos };
    washAt(pos.x, pos.y, pos.x, pos.y);
  }

  function onMove(e) {
    e.preventDefault();
    const pos = getXY(e);
    nozzlePos = pos;
    if (!ptrActive || !lastPtr || phase !== 'playing') return;
    washAt(pos.x, pos.y, lastPtr.x, lastPtr.y);
    lastPtr = { ...pos };
  }

  function onUp(e) {
    e.preventDefault();
    ptrActive = false;
    lastPtr   = null;
  }

  function onLeave() {
    ptrActive = false;
    nozzlePos = null;
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  function init() {
    UI.init();
    ParticleSystem.init(particleCvs);
    pCtx = particleCvs.getContext('2d');
    resize();
    window.addEventListener('resize', resize);

    // Touch events
    dirtyCvs.addEventListener('touchstart',  onDown, { passive: false });
    dirtyCvs.addEventListener('touchmove',   onMove, { passive: false });
    dirtyCvs.addEventListener('touchend',    onUp,   { passive: false });
    dirtyCvs.addEventListener('touchcancel', onUp,   { passive: false });

    // Mouse events
    dirtyCvs.addEventListener('mousedown',  onDown);
    dirtyCvs.addEventListener('mousemove',  (e) => {
      nozzlePos = getXY(e);
      if (e.buttons & 1) onMove(e);
    });
    dirtyCvs.addEventListener('mouseup',    onUp);
    dirtyCvs.addEventListener('mouseleave', onLeave);

    // YouTube Playables lifecycle
    if (window.ytgame && window.ytgame.environment) {
      window.ytgame.environment.onPause  = () => { if (phase === 'playing') phase = 'paused'; };
      window.ytgame.environment.onResume = () => { if (phase === 'paused')  phase = 'playing'; };
    }

    // Initial HUD
    UI.updateScore(0);
    UI.updateStreak(0);
    UI.updateSoap(soapBombs);
    UI.updateProgress(0);

    requestAnimationFrame(loop);

    // Show start screen — game begins on Play button
    const startScreen = document.getElementById('startScreen');
    const playBtn     = document.getElementById('playBtn');

    let started = false;
    function startGame(e) {
      if (e) e.preventDefault();
      if (started) return;
      started = true;

      AudioSystem.init();
      audioReady = true;
      AudioSystem.resume();

      startScreen.classList.add('hidden');
      setTimeout(() => startScreen.remove(), 450);

      loadSurface();
      requestAnimationFrame(() => {
        cleanCvs.style.opacity = '1';
        dirtyCvs.style.opacity = '1';
      });
    }

    playBtn.addEventListener('pointerdown', startGame);

    // Signal ready to YouTube Playables SDK
    window.ytgame.gameReady();
    setTimeout(() => window.ytgame.firstFrameReady(), 100);
  }

  return { init };
})();

// ── Boot ──────────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Game.init());
} else {
  Game.init();
}
