// Local stand-in for https://www.youtube.com/iframe_api, used only in automated tests.
(function () {
  var FAIL = { '_N2CPJS-mHw': 150 };      // pretend this one is not embeddable
  var activated = false;
  document.addEventListener('pointerdown', function () { activated = true; }, true);
  function Player(elId, opts) {
    var host = typeof elId === 'string' ? document.getElementById(elId) : elId;
    var iframe = document.createElement('iframe');
    iframe.srcdoc = '<body style="margin:0;background:#123;color:#9cf;font:14px sans-serif;display:grid;place-items:center;height:100vh">mock player</body>';
    if (typeof elId === 'string') iframe.id = elId;
    window.__mockPlayers = (window.__mockPlayers || 0) + 1;
    iframe.dataset.host = opts.host || 'https://www.youtube.com';
    iframe.setAttribute('src', iframe.dataset.host + '/embed/' + opts.videoId); // srcdoc wins, so nothing is fetched
    host.replaceWith(iframe);
    this._f = iframe; this._o = opts; this._ev = opts.events || {};
    this._muted = !!(opts.playerVars && opts.playerVars.mute);
    this._state = -1; this._t = 0; this._dur = 20; this._timers = [];
    var self = this;
    // window.__mockSchoolAll imitates "every standard embed fails with 152, even a new player"; nocookie is left working
    // so the page's handling of both addresses can be tested. It says nothing about what real YouTube does.
    this._blockedHost = window.__mockSchoolAll && !opts.host;
    setTimeout(function () { self._ev.onReady && self._ev.onReady({ target: self }); if (self._blockedHost) return self._school(); if (opts.playerVars.autoplay) self._load(opts.videoId, true); else self._load(opts.videoId, false); }, 200);
  }
  Player.prototype._emit = function (s) { this._state = s; this._ev.onStateChange && this._ev.onStateChange({ data: s, target: this }); };
  Player.prototype._clear = function () { this._timers.forEach(clearTimeout); this._timers = []; clearInterval(this._tick); };
  Player.prototype._later = function (ms, fn) { this._timers.push(setTimeout(fn, ms)); };
  Player.prototype._load = function (id, play) {
    var self = this; this._clear(); this._t = 0; this._id = id;
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) { return this._later(60, function () { self._ev.onError && self._ev.onError({ data: 2 }); }); }
    var extra = (window.__mockFailIds || {})[id] || window.__mockFailAll;
    if (extra) { this._later(30, function () { self._emit(-1); }); return this._later(140, function () { self._ev.onError && self._ev.onError({ data: extra }); }); }
    if (FAIL[id]) { this._later(30, function () { self._emit(-1); }); return this._later(140, function () { self._ev.onError && self._ev.onError({ data: FAIL[id] }); }); }
    this._later(40, function () { self._emit(-1); });
    if (!play) return this._later(150, function () { self._emit(5); });
    if (!this._muted && !activated) { return this._later(90, function () { self._ev.onAutoplayBlocked && self._ev.onAutoplayBlocked({}); }); }
    this._later(110, function () { self._emit(3); });
    this._later(300 + Math.round(Math.random() * 300), function () { self._play(); });
  };
  Player.prototype._play = function () {
    var self = this; this._emit(1); clearInterval(this._tick);
    this._tick = setInterval(function () { self._t += 0.25; if (self._t >= self._dur) { clearInterval(self._tick); self._t = self._dur; self._emit(0); } }, 250);
  };
  // window.__mockSchool imitates the school Chromebook report: a new player plays, but every
  // loadVideoById / cueVideoById into an existing player fails with error 152.
  Player.prototype._school = function () { var self = this; this._clear(); this._id = null; this._later(30, function () { self._emit(-1); }); this._later(120, function () { self._ev.onError && self._ev.onError({ data: 152 }); }); };
  // window.__mockStuck imitates the nocookie report: loadVideoById is accepted, but the previous video keeps playing.
  Player.prototype._stuck = function () { var self = this; this._clear(); this._later(40, function () { self._emit(3); }); this._later(250, function () { self._play(); }); };
  Player.prototype.loadVideoById = function (id) { if (window.__mockStuck && this._id) return this._stuck(); if (window.__mockSchool || this._blockedHost) return this._school(); this._load(id, true); };
  Player.prototype.getVideoUrl = function () { return this._id ? 'https://www.youtube.com/watch?v=' + this._id : 'https://www.youtube.com/watch'; };
  Player.prototype.cueVideoById = function (id) { if (window.__mockSchool || this._blockedHost) return this._school(); this._load(id, false); };
  Player.prototype.playVideo = function () { var s = this; if (!/^[A-Za-z0-9_-]{11}$/.test(this._id) || FAIL[this._id]) return; this._clear(); this._emit(3); this._later(200, function () { s._play(); }); };
  Player.prototype.pauseVideo = function () { this._clear(); this._emit(2); };
  Player.prototype.mute = function () { this._muted = true; };
  Player.prototype.unMute = function () { this._muted = false; };
  Player.prototype.isMuted = function () { return this._muted; };
  Player.prototype.getCurrentTime = function () { return this._t; };
  Player.prototype.getDuration = function () { return this._id ? this._dur : 0; };
  Player.prototype.getVideoLoadedFraction = function () { return Math.min(1, this._t / this._dur + 0.3); };
  Player.prototype.getPlayerState = function () { return this._state; };
  Player.prototype.getIframe = function () { return this._f; };
  Player.prototype.setVolume = function (v) { this._vol = v; };
  Player.prototype.setPlaybackRate = function (r) { this._rate = r; };
  Player.prototype.seekTo = function (s) { this._t = s; };
  Player.prototype.destroy = function () { this._clear(); this._dead = true; if (this._f && this._f.parentNode) this._f.parentNode.removeChild(this._f); };
  window.YT = { Player: Player, PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } };
  setTimeout(function () { window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady(); }, 50);
})();
