/**
 * UI — HUD updates, score popups, soap flash, completion overlay.
 * All DOM references are lazily resolved on init() so this module
 * is safe to load before the DOM is ready.
 */
const UI = (() => {
  const el = {};

  // ── Init ─────────────────────────────────────────────────────────────────

  function init() {
    el.streakCount      = document.getElementById('streakCount');
    el.streakDisplay    = document.getElementById('streakDisplay');
    el.scoreValue       = document.getElementById('scoreValue');
    el.soapCount        = document.getElementById('soapCount');
    el.soapDisplay      = document.getElementById('soapDisplay');
    el.progressFill     = document.getElementById('progressFill');
    el.progressLabel    = document.getElementById('progressLabel');
    el.surfaceLabel     = document.getElementById('surfaceLabel');
    el.completeOverlay  = document.getElementById('completeOverlay');
    el.completeTitle    = document.getElementById('completeTitle');
    el.completeBonusText = document.getElementById('completeBonusText');
    el.hintText         = document.getElementById('hintText');
    el.gameContainer    = document.getElementById('gameContainer');
  }

  // ── HUD state ─────────────────────────────────────────────────────────────

  let hintHidden = false;

  function updateStreak(n) {
    el.streakCount.textContent = n;
    if (n >= 5) {
      el.streakDisplay.style.background = 'rgba(220,60,0,0.70)';
      el.streakDisplay.style.color      = '#FFD700';
    } else if (n >= 3) {
      el.streakDisplay.style.background = 'rgba(255,100,30,0.60)';
      el.streakDisplay.style.color      = '#fff';
    } else {
      el.streakDisplay.style.background = 'rgba(0,0,0,0.55)';
      el.streakDisplay.style.color      = '#fff';
    }
  }

  function updateScore(n) {
    el.scoreValue.textContent = n.toLocaleString();
  }

  function updateSoap(n) {
    el.soapCount.textContent = n;
    el.soapDisplay.style.opacity = n > 0 ? '1' : '0.40';
  }

  /**
   * @param {number} pct  0–100 normalized to initial-dirt baseline
   */
  function updateProgress(pct) {
    const clamped = Math.min(Math.max(pct, 0), 100);
    el.progressFill.style.width = clamped + '%';
    el.progressLabel.textContent = clamped >= 100 ? 'PERFECT ✓' : 'WASH IT CLEAN';
  }

  function setSurfaceLabel(text) {
    el.surfaceLabel.textContent = text;
  }

  // ── Completion overlay ────────────────────────────────────────────────────

  function showComplete(title, bonusText) {
    el.completeTitle.textContent     = title;
    el.completeBonusText.textContent = bonusText;
    el.completeOverlay.classList.add('show');
  }

  function hideComplete() {
    el.completeOverlay.classList.remove('show');
  }

  // ── Hint ──────────────────────────────────────────────────────────────────

  function hideHint() {
    if (!hintHidden) {
      hintHidden = true;
      el.hintText.classList.add('hidden');
    }
  }

  // ── Score popup ───────────────────────────────────────────────────────────

  function popScore(x, y, text) {
    const el2 = document.createElement('div');
    el2.className     = 'score-popup';
    el2.textContent   = text;
    el2.style.left    = x + 'px';
    el2.style.top     = y + 'px';
    el.gameContainer.appendChild(el2);
    setTimeout(() => { if (el2.parentNode) el2.remove(); }, 1500);
  }

  // ── Level-up banner ───────────────────────────────────────────────────────

  function showLevelUp(level) {
    const div = document.createElement('div');
    div.className   = 'score-popup';
    div.textContent = `LEVEL ${level} ⚡`;
    div.style.left  = '50%';
    div.style.top   = '60%';
    div.style.fontSize = '28px';
    div.style.color    = '#00f2fe';
    div.style.textShadow = '0 0 12px #00f2fe';
    el.gameContainer.appendChild(div);
    setTimeout(() => { if (div.parentNode) div.remove(); }, 1600);
  }

  // ── Soap bomb flash ───────────────────────────────────────────────────────

  function soapFlash(x, y, radius) {
    const div = document.createElement('div');
    div.className    = 'soap-flash';
    div.style.left   = x + 'px';
    div.style.top    = y + 'px';
    div.style.width  = radius * 2 + 'px';
    div.style.height = radius * 2 + 'px';
    el.gameContainer.appendChild(div);
    setTimeout(() => { if (div.parentNode) div.remove(); }, 600);
  }

  return {
    init,
    updateStreak, updateScore, updateSoap, updateProgress,
    setSurfaceLabel, showComplete, hideComplete,
    hideHint, popScore, showLevelUp, soapFlash,
  };
})();
