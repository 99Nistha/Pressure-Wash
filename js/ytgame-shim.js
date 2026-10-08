/**
 * YouTube Playables SDK shim.
 * When the game runs inside YouTube, the platform loads its own SDK script
 * which replaces this stub with real implementations.
 * Outside YouTube (local dev, browsers) these no-ops prevent errors.
 */
window.ytgame = window.ytgame || {
  /** Call once the game is fully loaded and ready to display. */
  gameReady: function () {
    console.log('[ytgame shim] gameReady()');
  },

  /** Call after the very first frame has been rendered to the canvas. */
  firstFrameReady: function () {
    console.log('[ytgame shim] firstFrameReady()');
  },

  /** Audio control hooks — YouTube may mute/unmute programmatically. */
  sound: {
    /** @type {Function|null} Set by game to handle audio enable. */
    onAudioPlay: null,
    /** @type {Function|null} Set by game to handle audio mute. */
    onAudioStop: null
  },

  /** Score / session hooks. */
  game: {
    /**
     * Report the player's current score to YouTube.
     * @param {number} score
     */
    reportScore: function (score) {
      console.log('[ytgame shim] reportScore(' + score + ')');
    },
    /** @type {Function|null} Set by game to handle session end. */
    onGameEnd: null
  },

  /** Lifecycle hooks from the platform. */
  environment: {
    /** @type {Function|null} Called by YouTube when the game should pause. */
    onPause: null,
    /** @type {Function|null} Called by YouTube when the game should resume. */
    onResume: null
  }
};
