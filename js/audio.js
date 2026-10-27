/* Codex Arcanum — sons synthétisés (aucun fichier audio) et vibrations. Tout est facultatif : sans audio, le jeu fonctionne. */
(function (root) {
  "use strict";
  const CA = root.CA;
  let ctx = null;
  const Audio = { on: true, haptic: true };

  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = false; } }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, delay, slideTo) {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol, delay) {
    const c = ac(); if (!c) return;
    const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), g = c.createGain(), t0 = c.currentTime + (delay || 0);
    s.buffer = buf; g.gain.value = vol || 0.2; s.connect(g); g.connect(c.destination); s.start(t0);
  }
  const SOUNDS = {
    click: () => tone(520, 0.05, "triangle", 0.08),
    play:  () => { tone(330, 0.09, "triangle", 0.14); tone(495, 0.12, "triangle", 0.12, 0.06); },
    spell: () => { tone(660, 0.25, "sine", 0.13, 0, 1320); tone(990, 0.2, "sine", 0.08, 0.05); },
    swing: () => tone(240, 0.12, "sawtooth", 0.07, 0, 90),
    hit:   () => { noise(0.12, 0.22); tone(120, 0.14, "square", 0.1, 0, 60); },
    cit:   () => { noise(0.25, 0.3); tone(90, 0.3, "square", 0.14, 0, 40); },
    heal:  () => { tone(660, 0.12, "sine", 0.1); tone(880, 0.18, "sine", 0.1, 0.09); },
    shield:() => tone(900, 0.15, "triangle", 0.1, 0, 1500),
    die:   () => { tone(200, 0.3, "sawtooth", 0.08, 0, 50); noise(0.2, 0.12); },
    turn:  () => { tone(440, 0.1, "sine", 0.09); tone(660, 0.16, "sine", 0.09, 0.09); },
    win:   () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, "triangle", 0.15, i * 0.13)),
    lose:  () => [392, 349, 311, 262].forEach((f, i) => tone(f, 0.35, "sine", 0.12, i * 0.2)),
    level: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, "sine", 0.12, i * 0.09)),
    reward:() => { tone(784, 0.15, "triangle", 0.12); tone(988, 0.15, "triangle", 0.12, 0.1); tone(1319, 0.3, "triangle", 0.14, 0.2); }
  };
  const BUZZ = { hit: 18, cit: [30, 30, 30], die: 25, win: [40, 60, 40, 60, 80], lose: [120], level: [30, 40, 30, 40, 60], play: 8 };

  Audio.play = function (name) {
    if (Audio.on && SOUNDS[name]) { try { SOUNDS[name](); } catch (e) { /* audio indisponible */ } }
    if (Audio.haptic && BUZZ[name] && navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) { try { navigator.vibrate(BUZZ[name]); } catch (e) { /* idem */ } }
  };
  // Les navigateurs exigent un geste de l'utilisateur avant de produire du son
  Audio.unlock = function () { if (Audio.on) ac(); };

  CA.Audio = Audio;
})(typeof window !== "undefined" ? window : globalThis);
