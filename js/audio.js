/**
 * AudioSystem — all sounds synthesized via Web Audio API.
 * No external audio files; keeps total bundle tiny.
 */
const AudioSystem = (() => {
  let ctx = null;
  let master = null;
  let muted = false;

  /** Create AudioContext on first user gesture (required by browsers). */
  function init() {
    if (ctx) { resume(); return; }   // already initialised
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.setValueAtTime(0.75, ctx.currentTime);
      master.connect(ctx.destination);

      // Play a silent buffer immediately — this unlocks audio on iOS Safari
      const silentBuf = ctx.createBuffer(1, 1, ctx.sampleRate);
      const silentSrc = ctx.createBufferSource();
      silentSrc.buffer = silentBuf;
      silentSrc.connect(ctx.destination);
      silentSrc.start(0);

      // Hook YouTube mute/unmute signals
      if (window.ytgame && window.ytgame.sound) {
        window.ytgame.sound.onAudioPlay  = () => setMuted(false);
        window.ytgame.sound.onAudioStop  = () => setMuted(true);
      }
    } catch (e) {
      console.warn('Web Audio API unavailable:', e);
    }
  }

  /** Resume context after browser autoplay block. */
  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function makeGain(value, startTime) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(value, startTime);
    g.connect(master);
    return g;
  }

  function stereoFor(x, canvasWidth) {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(((x / canvasWidth) * 2 - 1) * 0.45, ctx.currentTime);
    panner.connect(master);
    return panner;
  }

  // ── Spray (brown-noise burst) ───────────────────────────────────────────────

  let lastSprayTime = 0;

  /**
   * Play a short spray burst.
   * @param {number} x        cursor x position
   * @param {number} canvasW  canvas width for stereo pan
   */
  function playSpray(x, canvasW) {
    if (!ctx || muted) return;
    // Throttle using performance.now() (ms) — avoids ctx.currentTime=0 bug
    // when AudioContext is still suspended at first stroke
    const wallNow = performance.now();
    if (wallNow - lastSprayTime < 50) return;
    lastSprayTime = wallNow;
    resume();

    // Brown noise via low-pass-filtered white noise
    const bufLen = Math.floor(ctx.sampleRate * 0.09);
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufLen; i++) {
      const w = Math.random() * 2 - 1;
      last     = (last + 0.02 * w) / 1.02;
      data[i]  = last * 3.5;
    }

    const src    = ctx.createBufferSource();
    src.buffer   = buf;

    const bpf    = ctx.createBiquadFilter();
    bpf.type     = 'bandpass';
    bpf.frequency.setValueAtTime(900, now);
    bpf.Q.setValueAtTime(0.6, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    const pan = stereoFor(x, canvasW);

    src.connect(bpf);
    bpf.connect(g);
    g.disconnect(); // don't connect to master via makeGain
    g.connect(pan);

    src.start(now);
    src.stop(now + 0.1);
  }

  // ── Pressure-zone pop ───────────────────────────────────────────────────────

  function playPop() {
    if (!ctx || muted) return;
    resume();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type  = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.12);

    const g = makeGain(0.55, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  // ── Surface-complete chime ──────────────────────────────────────────────────

  /**
   * @param {boolean} perfect  true if ≥ 98% clean (adds extra high note)
   */
  function playComplete(perfect) {
    if (!ctx || muted) return;
    resume();
    const now   = ctx.currentTime;
    const notes = perfect ? [523, 659, 784, 1047] : [523, 659, 784];

    notes.forEach((freq, i) => {
      const t   = now + i * 0.13;
      const osc = ctx.createOscillator();
      osc.type  = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.38, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      g.connect(master);

      osc.connect(g);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  }

  // ── Soap bomb whoosh ────────────────────────────────────────────────────────

  function playSoap() {
    if (!ctx || muted) return;
    resume();
    const now = ctx.currentTime;

    // Filtered noise sweep
    const bufLen = Math.floor(ctx.sampleRate * 0.2);
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const src   = ctx.createBufferSource();
    src.buffer  = buf;

    const lpf   = ctx.createBiquadFilter();
    lpf.type    = 'lowpass';
    lpf.frequency.setValueAtTime(400, now);
    lpf.frequency.linearRampToValueAtTime(1800, now + 0.18);

    const g = makeGain(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    src.connect(lpf);
    lpf.connect(g);

    src.start(now);
    src.stop(now + 0.22);
  }

  // ── Level-up ────────────────────────────────────────────────────────────────

  function playLevelUp() {
    if (!ctx || muted) return;
    resume();
    const now = ctx.currentTime;

    const osc  = ctx.createOscillator();
    osc.type   = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.35);

    const g = makeGain(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // ── Mute control ────────────────────────────────────────────────────────────

  function setMuted(val) {
    muted = val;
    if (master) master.gain.setValueAtTime(val ? 0 : 0.75, ctx.currentTime);
  }

  return { init, resume, playSpray, playPop, playComplete, playSoap, playLevelUp, setMuted };
})();
