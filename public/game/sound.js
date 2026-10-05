/*
 * The Water Cooler: Game Boy Color style sound (WC_SOUND).
 * Plain script, no modules. Sets window.WC_SOUND.
 *
 * Emulates the GBC APU in spirit:
 *   CH1/CH2  pulse waves (12.5 / 25 / 50 / 75% duty) built from the Fourier series of a
 *            pulse wave, volume envelopes stepped in 1/64 s units (0..15, no smoothing)
 *   CH3      32-sample, 4-bit wavetable (bass + the "ai" text voice)
 *   CH4      noise from a 15-bit LFSR (7-bit "short" mode for metallic sounds)
 * Music: melody on pulse 1, harmony/arpeggio on pulse 2, bass on wave, drums on noise.
 * Two original loops ('title', 'office') run from a 25 ms / 100 ms lookahead scheduler.
 */
(function () {
  'use strict';

  var KEY = 'watercooler:sound';
  var AMP = 0.5; // per-channel full-scale level before the master gain
  var MASTER = 0.25;
  var MUSIC_BUS = 0.55; // music sits under the text blips
  var LOOKAHEAD = 0.1;
  var TICK_MS = 25;
  var ENV_STEP = 1 / 64; // one envelope tick unit

  var VOICE = { designer: 540, engineer: 360, pm: 680, ai: 920 };
  var VOICE_DUTY = { designer: 0.25, engineer: 0.5, pm: 0.125 };

  // ---------------------------------------------------------------------------
  // Notes and song building
  // ---------------------------------------------------------------------------
  var PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function noteToMidi(name) {
    var m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) return null;
    var s = PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 12 * (parseInt(m[3], 10) + 1) + s;
  }
  function mtof(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  // "E5:2 G5:2 -:4" -> [{s,l,m}] ; step positions accumulate, '-' is a rest.
  function parseTrack(str, startStep) {
    var out = [];
    var s = startStep || 0;
    str.trim().split(/\s+/).forEach(function (tok) {
      if (!tok) return;
      var p = tok.split(':');
      var l = p[1] ? parseInt(p[1], 10) : 1;
      if (p[0] !== '-') {
        var m = noteToMidi(p[0]);
        if (m !== null) out.push({ s: s, l: l, m: m });
      }
      s += l;
    });
    return out;
  }

  // chord = [rootPitchClass, isMinor]
  var CHORDS = {
    C: [0, 0], D: [2, 0], F: [5, 0], G: [7, 0], Bb: [10, 0],
    Am: [9, 1], Dm: [2, 1], Gm: [7, 1], Em: [4, 1],
  };
  function triad(name, base) {
    var c = CHORDS[name];
    var r = base + ((c[0] - base) % 12 + 12) % 12;
    return [r, r + (c[1] ? 3 : 4), r + 7];
  }

  // arp over a bar: indices into [root,third,fifth,octave] every `len` steps
  function arpBar(chord, pattern, len, base, bar, steps) {
    var t = triad(chord, base);
    t.push(t[0] + 12);
    var ev = [];
    for (var s = 0, i = 0; s < steps; s += len, i++) {
      ev.push({ s: bar * steps + s, l: len, m: t[pattern[i % pattern.length]] });
    }
    return ev;
  }
  // bass: [offsetSteps, len, semitoneFromRoot]
  function bassBar(chord, pat, bar, steps, base) {
    var r = triad(chord, base)[0];
    return pat.map(function (p) {
      return { s: bar * steps + p[0], l: p[1], m: r + p[2] };
    });
  }
  // drums: one char per step: k kick, s snare, h closed hat, H open hat, . rest
  function drumBar(str, bar, steps) {
    var ev = [];
    for (var i = 0; i < str.length && i < steps; i++) {
      if (str[i] !== '.') ev.push({ s: bar * steps + i, l: 1, d: str[i] });
    }
    return ev;
  }

  function buildSong(def) {
    var steps = 16;
    var bars = def.chords.length;
    var tr = {
      p1: parseTrack(def.melody),
      p2: [],
      wv: [],
      nz: [],
    };
    for (var b = 0; b < bars; b++) {
      tr.p2 = tr.p2.concat(arpBar(def.chords[b], def.arp.pattern, def.arp.len, def.arp.base, b, steps));
      tr.wv = tr.wv.concat(bassBar(def.chords[b], def.bass, b, steps, def.bassBase));
      tr.nz = tr.nz.concat(drumBar(def.drums[b % def.drums.length], b, steps));
    }
    return { bpm: def.bpm, steps: bars * steps, tr: tr, cfg: def };
  }

  // ---- 'title': upbeat C major, 8 bars @ 150 bpm ---------------------------
  var TITLE = {
    bpm: 150,
    chords: ['C', 'F', 'G', 'C', 'Am', 'G', 'F', 'C'],
    melody: [
      'E5:2 G5:2 C6:4 G5:2 E5:2 G5:4',
      'F5:2 A5:2 D6:4 A5:2 F5:2 A5:4',
      'G5:2 B5:2 D6:2 G6:6 F6:2 D6:2',
      'E6:4 C6:4 G5:4 C6:4',
      'A5:2 C6:2 E6:4 C6:2 A5:2 C6:4',
      'G5:2 B5:2 D6:4 B5:2 G5:2 B5:4',
      'F5:2 A5:2 C6:2 F6:6 E6:2 D6:2',
      'C6:6 G5:2 E5:2 G5:2 C6:4',
    ].join(' '),
    arp: { pattern: [0, 1, 2, 1], len: 2, base: 60 },
    bassBase: 36,
    bass: [[0, 2, 0], [2, 2, 12], [4, 2, 0], [6, 2, 12], [8, 2, 0], [10, 2, 12], [12, 2, 7], [14, 2, 12]],
    drums: ['k.h.s.h.k.k.s.hh', 'k.h.s.h.k.h.s.sh'],
    mel: { duty: 0.5, vol: 8, dir: -1, pace: 6, gate: 0.9 },
    har: { duty: 0.125, vol: 4, dir: -1, pace: 2, gate: 0.8 },
  };

  // ---- 'office': cosy F major town-style loop, 16 bars @ 92 bpm -----------
  var OFFICE = {
    bpm: 92,
    chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Bb', 'C', 'Dm', 'Gm', 'C', 'F', 'Bb', 'C', 'Dm', 'C'],
    melody: [
      'A4:4 C5:2 A4:2 F4:4 A4:4',
      'D5:4 C5:2 A4:2 F4:4 D4:4',
      'Bb4:4 D5:2 C5:2 Bb4:4 A4:4',
      'G4:4 -:2 A4:2 G4:4 E4:4',
      'A4:4 C5:2 A4:2 F5:6 E5:2',
      'E5:4 C5:2 A4:2 C5:4 E5:4',
      'D5:4 C5:2 Bb4:2 D5:8',
      'E5:4 D5:2 C5:2 G4:8',
      'D5:6 F5:2 A5:4 F5:4',
      'G5:4 F5:2 D5:2 Bb4:4 D5:4',
      'E5:4 G5:4 E5:4 C5:4',
      'F5:8 C5:4 A4:4',
      'D5:4 F5:4 D5:4 Bb4:4',
      'E5:4 G5:2 E5:2 C5:8',
      'D5:4 F5:2 A5:2 G5:4 F5:4',
      'E5:4 D5:2 C5:2 G4:4 -:4',
    ].join(' '),
    arp: { pattern: [0, 1, 2, 1, 3, 2, 1, 2], len: 2, base: 60 },
    bassBase: 41,
    bass: [[0, 3, 0], [3, 1, 0], [4, 3, 0], [7, 1, 0], [8, 4, 7], [12, 3, 0], [15, 1, 12]],
    drums: [
      '..h...h...h...h.',
      'k.h...h.k.h...hh',
      'k.h.s.h.k.h.s.h.',
      'k.h.s.h.k.h.s.hH',
    ],
    mel: { duty: 0.25, vol: 5, dir: -1, pace: 5, gate: 0.92 },
    har: { duty: 0.125, vol: 3, dir: -1, pace: 3, gate: 0.65 },
  };
  // drum pattern per bar: intro of hats, then fuller groove (bars 0-3 sparse, then groove)
  OFFICE.drums = [
    OFFICE.drums[0], OFFICE.drums[0], OFFICE.drums[0], OFFICE.drums[1],
    OFFICE.drums[2], OFFICE.drums[2], OFFICE.drums[2], OFFICE.drums[3],
    OFFICE.drums[2], OFFICE.drums[2], OFFICE.drums[2], OFFICE.drums[3],
    OFFICE.drums[2], OFFICE.drums[2], OFFICE.drums[2], OFFICE.drums[3],
  ];

  var SONGS = null;
  function songs() {
    if (!SONGS) SONGS = { title: buildSong(TITLE), office: buildSong(OFFICE) };
    return SONGS;
  }

  // ---------------------------------------------------------------------------
  // Engine
  // ---------------------------------------------------------------------------
  var S = {
    on: false,
    ac: null,
    master: null,
    sfxBus: null,
    musBus: null,
    _waves: {},
    _noise: {},
    _wt: {},
    _want: null, // music requested while off / before context
    _m: null, // running music session
    _timer: null,

    init: function () {
      try {
        this.on = localStorage.getItem(KEY) === 'on';
      } catch (e) {
        this.on = false;
      }
    },

    ensure: function () {
      if (!this.ac) {
        var AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
        if (!AC) return null;
        try {
          this._attach(new AC());
        } catch (e) {
          this.ac = null;
          return null;
        }
      }
      try {
        if (this.ac.state === 'suspended' && this.ac.resume) this.ac.resume();
      } catch (e) { /* ignore */ }
      return this.ac;
    },

    // Wire up master chain on a (real or offline) context.
    _attach: function (ac) {
      this.ac = ac;
      this._waves = {};
      this._noise = {};
      this._wt = {};
      this.master = ac.createGain();
      this.master.gain.value = MASTER;
      // GBC-ish hard clip as a safety net (rarely engaged)
      var out = this.master;
      if (ac.createWaveShaper) {
        var ws = ac.createWaveShaper();
        var n = 257;
        var c = new Float32Array(n);
        for (var i = 0; i < n; i++) {
          var x = (i / (n - 1)) * 2 - 1;
          c[i] = Math.max(-0.9, Math.min(0.9, x * 1.0));
        }
        ws.curve = c;
        this.master.connect(ws);
        ws.connect(ac.destination);
      } else {
        this.master.connect(ac.destination);
      }
      void out;
      this.sfxBus = ac.createGain();
      this.sfxBus.gain.value = 1;
      this.sfxBus.connect(this.master);
      this.musBus = ac.createGain();
      this.musBus.gain.value = MUSIC_BUS;
      this.musBus.connect(this.master);
    },

    set: function (on) {
      this.on = !!on;
      try {
        localStorage.setItem(KEY, this.on ? 'on' : 'off');
      } catch (e) { /* storage unavailable */ }
      if (this.on) {
        this.ensure();
        if (this._want && !this._m) this.startMusic(this._want);
      } else {
        this._haltMusic();
      }
    },

    // ----- waveforms ---------------------------------------------------------
    // Pulse wave Fourier series: a_n = 2 sin(n pi d)/(n pi), b_n = 2 (1 - cos(n pi d))/(n pi)
    _pulse: function (duty) {
      var w = this._waves['p' + duty];
      if (w) return w;
      var N = 64;
      var re = new Float32Array(N + 1);
      var im = new Float32Array(N + 1);
      for (var n = 1; n <= N; n++) {
        re[n] = (2 * Math.sin(n * Math.PI * duty)) / (n * Math.PI);
        im[n] = (2 * (1 - Math.cos(n * Math.PI * duty))) / (n * Math.PI);
      }
      w = this.ac.createPeriodicWave(re, im);
      this._waves['p' + duty] = w;
      return w;
    },

    // 32 x 4-bit wavetables, converted to a PeriodicWave via DFT
    _table: function (name) {
      var t = this._wt[name];
      if (t) return t;
      var tab = new Array(32);
      var i;
      if (name === 'bass') {
        // quantised triangle with a slight asymmetry (soft, round bass)
        for (i = 0; i < 32; i++) {
          var tri = i < 16 ? i : 31 - i;
          tab[i] = Math.round((tri / 15) * 15);
        }
      } else if (name === 'sine') {
        for (i = 0; i < 32; i++) tab[i] = Math.round(7.5 + 7.5 * Math.sin((i / 32) * 2 * Math.PI));
      } else {
        // 'voice': odd, hollow, digital-sounding table for the AI
        var raw = [8, 12, 15, 12, 8, 3, 0, 3, 8, 13, 15, 10, 4, 1, 3, 8, 12, 14, 9, 3, 0, 4, 8, 11, 13, 9, 6, 3, 2, 4, 6, 7];
        for (i = 0; i < 32; i++) tab[i] = raw[i];
      }
      var mean = 0;
      for (i = 0; i < 32; i++) mean += tab[i];
      mean /= 32;
      var H = 16;
      var re = new Float32Array(H + 1);
      var im = new Float32Array(H + 1);
      for (var k = 1; k <= H; k++) {
        var a = 0;
        var b = 0;
        for (i = 0; i < 32; i++) {
          var v = (tab[i] - mean) / 7.5;
          a += v * Math.cos((2 * Math.PI * k * i) / 32);
          b += v * Math.sin((2 * Math.PI * k * i) / 32);
        }
        re[k] = (2 * a) / 32;
        im[k] = (2 * b) / 32;
      }
      t = this.ac.createPeriodicWave(re, im);
      this._wt[name] = t;
      return t;
    },

    // 15-bit / 7-bit LFSR rendered one step per 4 samples; base step rate = sampleRate/4
    _noiseBuf: function (short) {
      var key = short ? 's' : 'l';
      var b = this._noise[key];
      if (b) return b;
      var bits = short ? 7 : 15;
      var period = short ? 127 : 32767;
      var rep = 4;
      var buf = this.ac.createBuffer(1, period * rep, this.ac.sampleRate);
      var d = buf.getChannelData(0);
      var lfsr = (1 << bits) - 1;
      for (var i = 0; i < period; i++) {
        var x = (lfsr & 1) ^ ((lfsr >> 1) & 1);
        lfsr = (lfsr >> 1) | (x << (bits - 1));
        var v = lfsr & 1 ? 1 : -1;
        for (var j = 0; j < rep; j++) d[i * rep + j] = v;
      }
      this._noise[key] = buf;
      return buf;
    },

    // ----- channel voices ----------------------------------------------------
    // Stepped envelope: start volume 0..15, +/-1 every `pace`/64 s, hard stop at `dur`.
    _env: function (g, t, dur, vol, dir, pace, level) {
      var v = Math.max(0, Math.min(15, vol));
      var p = g.gain;
      p.setValueAtTime((v / 15) * level, t);
      if (dir && pace) {
        var step = pace * ENV_STEP;
        for (var k = 1; ; k++) {
          var tt = t + k * step;
          if (tt >= t + dur) break;
          v += dir;
          if (v < 0 || v > 15) break;
          p.setValueAtTime((v / 15) * level, tt);
        }
      }
      p.setValueAtTime(0, t + dur);
    },

    // CH1/CH2. o: duty, vol, dir, pace, to (slide target Hz), out (destination node)
    pulse: function (t, freq, dur, o) {
      var ac = this.ac;
      var osc = ac.createOscillator();
      osc.setPeriodicWave(this._pulse(o.duty || 0.5));
      osc.frequency.setValueAtTime(freq, t);
      if (o.to) this._slide(osc.frequency, t, freq, o.to, dur);
      var g = ac.createGain();
      this._env(g, t, dur, o.vol == null ? 10 : o.vol, o.dir || 0, o.pace || 0, AMP);
      osc.connect(g);
      g.connect(o.out || this.sfxBus);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },

    // CH3. o: table, lvl (1, .5, .25), to, out
    wave: function (t, freq, dur, o) {
      var ac = this.ac;
      var osc = ac.createOscillator();
      osc.setPeriodicWave(this._table(o.table || 'bass'));
      osc.frequency.setValueAtTime(freq, t);
      if (o.to) this._slide(osc.frequency, t, freq, o.to, dur);
      var g = ac.createGain();
      var lvl = AMP * (o.lvl || 1);
      g.gain.setValueAtTime(0, t);
      g.gain.setValueAtTime(lvl, t + 0.001);
      g.gain.setValueAtTime(lvl, t + Math.max(0.002, dur - 0.002));
      g.gain.setValueAtTime(0, t + dur);
      osc.connect(g);
      g.connect(o.out || this.sfxBus);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },

    // CH4. o: hz (LFSR clock), short, vol, dir, pace, out
    noise: function (t, dur, o) {
      var ac = this.ac;
      var src = ac.createBufferSource();
      src.buffer = this._noiseBuf(!!o.short);
      src.loop = true;
      src.playbackRate.setValueAtTime((o.hz || 8000) / (ac.sampleRate / 4), t);
      var g = ac.createGain();
      this._env(g, t, dur, o.vol == null ? 8 : o.vol, o.dir || 0, o.pace || 0, AMP);
      src.connect(g);
      g.connect(o.out || this.sfxBus);
      src.start(t);
      src.stop(t + dur + 0.02);
    },

    // stepped (not smooth) pitch slide, like frequency-register sweeps
    _slide: function (param, t, f0, f1, dur) {
      var n = Math.max(2, Math.round(dur * 64));
      for (var i = 1; i <= n; i++) {
        var f = f0 * Math.pow(f1 / f0, i / n);
        param.setValueAtTime(f, t + (dur * i) / (n + 1));
      }
    },

    // helper: run fn(ac, t) only when audio is available and on
    _go: function (fn) {
      if (!this.on) return;
      var ac = this.ensure();
      if (!ac) return;
      try {
        fn.call(this, ac.currentTime + 0.005);
      } catch (e) { /* never let sound break the game */ }
    },

    // ----- SFX ----------------------------------------------------------------
    blip: function (id) {
      var f = VOICE[id];
      if (!f) return;
      this._go(function (t) {
        var fr = f * (0.97 + Math.random() * 0.06);
        if (id === 'ai') this.wave(t, fr, 0.045, { table: 'voice', lvl: 0.5 });
        else this.pulse(t, fr, 0.05, { duty: VOICE_DUTY[id], vol: 5, dir: -1, pace: 1 });
      });
    },
    confirm: function () {
      this._go(function (t) {
        this.pulse(t, 1047, 0.03, { duty: 0.5, vol: 8 });
        this.pulse(t + 0.03, 1568, 0.07, { duty: 0.5, vol: 8, dir: -1, pace: 1 });
      });
    },
    bump: function () {
      this._go(function (t) {
        this.pulse(t, 130, 0.09, { duty: 0.5, vol: 11, dir: -1, pace: 1, to: 65 });
        this.noise(t, 0.06, { hz: 2400, vol: 9, dir: -1, pace: 1 });
      });
    },
    cursor: function () {
      this._go(function (t) {
        this.pulse(t, 1760, 0.035, { duty: 0.25, vol: 7, dir: -1, pace: 1 });
      });
    },
    open: function () {
      this._go(function (t) {
        this.pulse(t, 784, 0.045, { duty: 0.5, vol: 9 });
        this.pulse(t + 0.045, 1175, 0.07, { duty: 0.5, vol: 9, dir: -1, pace: 1 });
      });
    },
    close: function () {
      this._go(function (t) {
        this.pulse(t, 1175, 0.045, { duty: 0.5, vol: 8 });
        this.pulse(t + 0.045, 784, 0.07, { duty: 0.5, vol: 8, dir: -1, pace: 1 });
      });
    },
    swap: function () {
      this._go(function (t) {
        var notes = [72, 76, 79, 84];
        for (var i = 0; i < notes.length; i++) {
          var last = i === notes.length - 1;
          this.pulse(t + i * 0.055, mtof(notes[i]), last ? 0.16 : 0.055, { duty: 0.25, vol: 9, dir: -1, pace: last ? 3 : 0 });
        }
        this.pulse(t + 0.165, mtof(72), 0.16, { duty: 0.125, vol: 5, dir: -1, pace: 3 });
      });
    },
    gurgle: function () {
      this._go(function (t) {
        for (var i = 0; i < 6; i++) {
          var f = 170 + Math.random() * 150;
          var at = t + i * 0.1 + Math.random() * 0.03;
          this.wave(at, f, 0.07, { table: 'sine', lvl: 1, to: f * 2.3 });
        }
        this.noise(t, 0.6, { hz: 3000, short: true, vol: 2, dir: -1, pace: 10 });
      });
    },
    brew: function () {
      this._go(function (t) {
        this.noise(t, 0.9, { hz: 38000, vol: 5 });
        for (var i = 0; i < 4; i++) {
          this.pulse(t + 0.3 + i * 0.12, 420 + i * 70, 0.05, { duty: 0.125, vol: 7, dir: -1, pace: 1, to: 900 });
        }
      });
    },
    // ~2 s original title fanfare
    jingle: function () {
      this._go(function (t) {
        var e = 0.125;
        var run = [72, 76, 79, 84, 79, 84, 88];
        for (var i = 0; i < run.length; i++) {
          this.pulse(t + i * e, mtof(run[i]), e * 0.9, { duty: 0.5, vol: 10, dir: -1, pace: 4 });
          this.pulse(t + i * e, mtof(run[i] - 12), e * 0.9, { duty: 0.125, vol: 5, dir: -1, pace: 4 });
        }
        var h = t + run.length * e;
        this.pulse(h, mtof(91), 1.1, { duty: 0.5, vol: 10, dir: -1, pace: 7 });
        this.pulse(h, mtof(84), 1.1, { duty: 0.25, vol: 7, dir: -1, pace: 7 });
        this.pulse(h, mtof(79), 1.1, { duty: 0.125, vol: 6, dir: -1, pace: 7 });
        var bs = [48, 52, 55, 48, 55, 52, 48];
        for (var j = 0; j < bs.length; j++) this.wave(t + j * e, mtof(bs[j]), e * 0.85, { table: 'bass' });
        this.wave(h, mtof(36), 1.1, { table: 'bass' });
        this.noise(h, 0.5, { hz: 22000, vol: 8, dir: -1, pace: 4 });
      });
    },

    // ----- Music --------------------------------------------------------------
    startMusic: function (name) {
      if (!songs()[name]) return;
      this._want = name;
      if (!this.on) return;
      if (this._m && this._m.name === name) return;
      this._haltMusic();
      var ac = this.ensure();
      if (!ac) return;
      var m = this._newSession(name, ac.currentTime + 0.06);
      this._m = m;
      this._pump();
      var self = this;
      this._timer = setInterval(function () {
        self._pump();
      }, TICK_MS);
    },

    stopMusic: function () {
      this._want = null;
      this._haltMusic();
    },

    _newSession: function (name, start) {
      var ac = this.ac;
      var song = songs()[name];
      var bus = ac.createGain();
      bus.gain.value = 1;
      bus.connect(this.musBus);
      function chan(pan) {
        var g = ac.createGain();
        if (ac.createStereoPanner) {
          var p = ac.createStereoPanner();
          p.pan.value = pan;
          g.connect(p);
          p.connect(bus);
        } else {
          g.connect(bus);
        }
        return g;
      }
      return {
        name: name,
        song: song,
        start: start,
        bus: bus,
        ch: { p1: chan(-0.25), p2: chan(0.35), wv: chan(0), nz: chan(0.1) },
        pos: { p1: 0, p2: 0, wv: 0, nz: 0 }, // next event index
        loop: { p1: 0, p2: 0, wv: 0, nz: 0 }, // loop counter
      };
    },

    _pump: function () {
      var m = this._m;
      if (!m || !this.ac) return;
      this._scheduleUntil(m, this.ac.currentTime + LOOKAHEAD, this.ac.currentTime - 0.03);
    },

    // Schedule all events of every track with time < until. Events earlier than
    // `minT` (timer throttled in a background tab) are skipped, not played late.
    _scheduleUntil: function (m, until, minT) {
      var song = m.song;
      var stepDur = 60 / song.bpm / 4;
      var cfg = song.cfg;
      var names = ['p1', 'p2', 'wv', 'nz'];
      for (var c = 0; c < names.length; c++) {
        var key = names[c];
        var evs = song.tr[key];
        if (!evs.length) continue;
        for (var guard = 0; guard < 2000; guard++) {
          var ev = evs[m.pos[key]];
          var t = m.start + (m.loop[key] * song.steps + ev.s) * stepDur;
          if (t >= until) break;
          if (t >= minT) this._playEvent(key, ev, t, stepDur, cfg, m.ch[key]);
          m.pos[key]++;
          if (m.pos[key] >= evs.length) {
            m.pos[key] = 0;
            m.loop[key]++;
          }
        }
      }
    },

    _playEvent: function (key, ev, t, stepDur, cfg, out) {
      var dur = ev.l * stepDur;
      var f;
      if (key === 'p1') {
        f = cfg.mel;
        this.pulse(t, mtof(ev.m), dur * f.gate, { duty: f.duty, vol: f.vol, dir: f.dir, pace: f.pace, out: out });
      } else if (key === 'p2') {
        f = cfg.har;
        this.pulse(t, mtof(ev.m), dur * f.gate, { duty: f.duty, vol: f.vol, dir: f.dir, pace: f.pace, out: out });
      } else if (key === 'wv') {
        this.wave(t, mtof(ev.m), dur * 0.9, { table: 'bass', lvl: 0.5, out: out });
      } else {
        var d = ev.d;
        if (d === 'k') this.noise(t, 0.08, { hz: 1800, vol: 10, dir: -1, pace: 1, out: out });
        else if (d === 's') this.noise(t, 0.12, { hz: 9000, vol: 7, dir: -1, pace: 2, out: out });
        else if (d === 'H') this.noise(t, 0.12, { hz: 60000, short: true, vol: 4, dir: -1, pace: 3, out: out });
        else this.noise(t, 0.035, { hz: 60000, short: true, vol: 4, dir: -1, pace: 1, out: out });
      }
    },

    _haltMusic: function () {
      if (this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
      var m = this._m;
      this._m = null;
      if (m && this.ac) {
        try {
          var now = this.ac.currentTime;
          m.bus.gain.cancelScheduledValues(now);
          m.bus.gain.setValueAtTime(0, now);
          setTimeout(function () {
            try { m.bus.disconnect(); } catch (e) { /* ignore */ }
          }, 400);
        } catch (e) { /* ignore */ }
      }
    },

    // ----- offline rendering hook (tests / tooling) -----------------------------
    // Attach an OfflineAudioContext, schedule `name` for `seconds`, return nothing.
    _renderOffline: function (ctx, name, seconds) {
      this._attach(ctx);
      var m = this._newSession(name, 0.01);
      this._scheduleUntil(m, seconds, -1);
      return songs()[name].steps * (60 / songs()[name].bpm / 4);
    },
  };

  if (typeof window !== 'undefined') window.WC_SOUND = S;
  else if (typeof globalThis !== 'undefined') globalThis.window = { WC_SOUND: S };
})();
