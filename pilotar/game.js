/* PILOTAR — GT3 RS no circuito de contribuições do GitHub.
   Física de carro com tração traseira (modelo bicicleta com ângulo de deriva,
   círculo de atrito, transferência de carga), freio de mão, colisões com
   impulso (muros e entre carros), fumaça, marcas de pneu, faróis e som. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DATA_URL = 'https://raw.githubusercontent.com/RaphaLima38/RaphaLima38/main/assets/contributions.json';
const AMBER = ['#1d1813', '#4a3212', '#8a5a14', '#d08a1c', '#ffc46b'];
const PCOL = ['#f5a524', '#ff3b30'];

// ---------------------------------------------------------------- dados
function demoDays() {
  const out = [], end = new Date(); end.setHours(12, 0, 0, 0);
  const start = new Date(end); start.setDate(start.getDate() - 364 - start.getDay());
  let s = 38;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1))
    out.push([d.toISOString().slice(0, 10), [0, 0, 0, 1, 1, 2, 3, 4][Math.floor(rnd() * 8)]]);
  return { days: out, total: null, demo: true };
}
async function loadData() {
  try {
    const r = await fetch(DATA_URL, { cache: 'no-store' });
    if (!r.ok) throw 0;
    const j = await r.json();
    if (!j.days || !j.days.length) throw 0;
    return j;
  } catch (e) { return demoDays(); }
}

// ---------------------------------------------------------------- pista
const PITCH = 2.6, CELL = 2.0, RS = 12, HALF = 5.5, E = 4, R2 = 6, STEP = 0.5;
function buildTrack(data) {
  const first = new Date(data.days[0][0] + 'T12:00:00');
  const off = first.getDay();
  const cells = data.days.map(([d, lv], i) => ({ c: Math.floor((i + off) / 7), r: (i + off) % 7, d, lv, owner: -1 }));
  const cols = cells[cells.length - 1].c + 1;
  const X0 = 30, Y0 = 12;
  const xs = X0 + CELL / 2, xe = X0 + (cols - 1) * PITCH + CELL / 2;
  const yr = r => Y0 + r * RS;
  const ybot = yr(6) + RS, xl = xs - E - 18;
  const W = xe + E + HALF + RH() + 8, H = ybot + HALF + 6;
  function RH() { return RS / 2; }
  const X = [], Y = [], turns = [];
  let cx = xs - E, cy = yr(0);
  X.push(cx); Y.push(cy);
  const line = (x, y) => {
    const n = Math.max(1, Math.round(Math.hypot(x - cx, y - cy) / STEP));
    for (let i = 1; i <= n; i++) { X.push(cx + (x - cx) * i / n); Y.push(cy + (y - cy) * i / n); }
    cx = x; cy = y;
  };
  const arc = (ox, oy, r, a0, a1) => {
    const i0 = X.length - 1;
    const n = Math.max(2, Math.round(Math.abs(a1 - a0) * Math.PI / 180 * r / STEP));
    for (let i = 1; i <= n; i++) {
      const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
      X.push(ox + r * Math.cos(a)); Y.push(oy + r * Math.sin(a));
    }
    cx = X[X.length - 1]; cy = Y[Y.length - 1];
    turns.push({ ox, oy, r, a0, a1, i0, i1: X.length - 1 });
  };
  for (let r = 0; r < 7; r++) {
    const right = r % 2 === 0;
    line(right ? xe + E : xs - E, yr(r));
    if (r < 6) right ? arc(xe + E, yr(r) + RS / 2, RS / 2, -90, 90) : arc(xs - E, yr(r) + RS / 2, RS / 2, -90, -270);
  }
  arc(xe + E, yr(6) + R2, R2, -90, 0);
  line(xe + E + R2, ybot - R2);
  arc(xe + E, ybot - R2, R2, 0, 90);
  line(xl + R2, ybot);
  arc(xl + R2, ybot - R2, R2, 90, 180);
  line(xl, yr(0) + R2);
  arc(xl + R2, yr(0) + R2, R2, 180, 270);
  line(xs - E, yr(0));
  X.pop(); Y.pop();                                   // último == primeiro: circuito fechado
  const N = X.length, S = new Float64Array(N), TX = new Float64Array(N), TY = new Float64Array(N);
  for (let i = 1; i < N; i++) S[i] = S[i - 1] + Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);
  const L = S[N - 1] + Math.hypot(X[0] - X[N - 1], Y[0] - Y[N - 1]);
  for (let i = 0; i < N; i++) {
    const a = (i + 1) % N, b = (i - 1 + N) % N, l = Math.hypot(X[a] - X[b], Y[a] - Y[b]) || 1;
    TX[i] = (X[a] - X[b]) / l; TY[i] = (Y[a] - Y[b]) / l;
  }
  const minX = xl - HALF - 6;
  return { X, Y, S, TX, TY, N, L, turns, cells, cols, X0, Y0, xs, xe, yr, ybot, xl, minX, W, H, total: data.total, demo: !!data.demo };
}
// ponto mais próximo da linha central perto do índice `i0` (janela ±win amostras)
function nearest(T, px, py, i0, win) {
  let best = 1e9, bi = i0, bx = 0, by = 0;
  for (let k = -win; k <= win; k++) {
    const i = (i0 + k + T.N) % T.N, j = (i + 1) % T.N;
    const ax = T.X[i], ay = T.Y[i], dx = T.X[j] - ax, dy = T.Y[j] - ay;
    const l2 = dx * dx + dy * dy || 1;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    const qx = ax + dx * t, qy = ay + dy * t, d = (px - qx) ** 2 + (py - qy) ** 2;
    if (d < best) { best = d; bi = i; bx = qx; by = qy; }
  }
  return { d: Math.sqrt(best), i: bi, x: bx, y: by };
}

// ---------------------------------------------------------------- física do carro
const M = 1450, IZ = 2600, A = 1.35, B = 1.10, HCG = 0.42, G = 9.81, MU = 1.3;
const CF = 70000, CR = 105000, POWER = 290000, FMAX = 12500, DRAG = 0.55, ROLL = 30;   // rigidez lateral: pico ~7° (progressivo)
const ESC_K = 2.2, IZ_HIT = IZ * 3;                          // controle de estabilidade; inércia efetiva nas batidas
const HL = 2.25, HW = 0.95;                                   // meia-caixa de colisão
const GEARS = [13, 20, 27, 34, 41, 49, 60];                   // velocidade (m/s) a 9000 rpm
class Car {
  constructor(id, x, y, h) {
    this.id = id; this.x = x; this.y = y; this.h = h; this.vx = 0; this.vy = 0; this.r = 0;
    this.steer = 0; this.thr = 0; this.ax = 0; this.si = 0; this.lap = 0; this.half = false;
    this.lapStart = 0; this.best = null; this.laps = []; this.done = false; this.finish = 0;
    this.gear = 1; this.rpm = 1200; this.slip = 0; this.braking = false; this.reverse = false;
    this.pop = 0; this.popT = 0; this.wrong = 0; this.hbT = 0; this.rg = 1; this.impactT = 0; this.prevS = 0; this.stuck = 0;
    this.input = { gas: 0, brake: 0, left: 0, right: 0, hb: 0 };
    this.rw = [null, null];                                  // última posição das rodas traseiras (marcas)
  }
  fwd() { return [Math.cos(this.h), Math.sin(this.h)]; }
  speed() { return Math.hypot(this.vx, this.vy); }
  step(dt, locked) {
    const inp = this.input, c = Math.cos(this.h), s = Math.sin(this.h);
    let vx = this.vx * c + this.vy * s, vy = -this.vx * s + this.vy * c;
    const spd = Math.hypot(vx, vy), Lw = A + B, W = M * G;
    const hb = !!inp.hb && !locked && spd > 1;
    // aderência da traseira: cai rápido com o freio de mão e volta aos poucos ao soltar (sem tranco)
    this.rg = this.rg == null ? 1 : this.rg;
    this.rg += ((hb ? .55 : 1) - this.rg) * Math.min(1, dt * (hb ? 9 : 4));
    this.hbT = hb ? 1.4 : Math.max(0, (this.hbT || 0) - dt);       // "modo drift" depois do freio de mão
    // ângulo de deriva do carro (diferença entre para onde aponta e para onde vai)
    const beta = spd > 2 ? Math.atan2(vy, Math.abs(vx) + .5) : 0;
    // direção: rampa suave, esterço máximo cai com a velocidade (nunca pede mais que ~1,1 g)
    const target = inp.right - inp.left;
    const back = target === 0 || Math.sign(target) !== Math.sign(this.steer);
    this.steer += clamp(target - this.steer, -(back ? 7 : 2.6 + 2.4 / (1 + spd / 8)) * dt, (back ? 7 : 2.6 + 2.4 / (1 + spd / 8)) * dt);
    const dmax = Math.min(0.5 / (1 + spd / 9) + 0.04, 1.6 * MU * G * Lw / Math.max(spd * spd, 1));
    // as rodas da frente se alinham sozinhas com a direção do movimento (torque autoalinhante)
    const align = Math.abs(beta) > .06 ? (beta - Math.sign(beta) * .06) * .6 : 0;
    const delta = clamp(this.steer * dmax + clamp(align, -.4, .4), -.62, .62);
    this.thr += clamp((locked ? 0 : inp.gas) - this.thr, -8 * dt, 3 * dt);
    // cargas com transferência longitudinal
    const Fzf = Math.max(.3 * W, W * B / Lw - M * this.ax * HCG / Lw);
    const Fzr = Math.max(.3 * W, W * A / Lw + M * this.ax * HCG / Lw);
    const Df = MU * Fzf, Dr = MU * Fzr;
    // pedidos longitudinais
    let Fxf = 0, Fxr = 0;
    this.braking = false; this.reverse = false;
    if (!locked) {
      if (this.thr > 0) Fxr = this.thr * Math.min(FMAX, POWER / Math.max(vx, 4), Dr * .92);
      if (inp.brake) {
        if (vx > .8) { const bf = inp.brake * W * 1.15; Fxf -= Math.min(bf * .72, Df * .97); Fxr -= Math.min(bf * .28, Dr * .5); this.braking = true; }
        else if (!inp.gas) { Fxr = -inp.brake * 4200; this.reverse = vx < .2; }
      }
    } else if (spd > .05) Fxf -= Math.sign(vx) * W * .8;
    if (hb) Fxr = -Math.sign(vx) * Math.min(Math.abs(vx) * M * 2, Dr * .28);   // freio de mão: segura a traseira sem virar âncora
    // forças laterais (curva progressiva) e elipse de atrito: frear/acelerar e virar dividem a mesma aderência
    const vxa = Math.max(Math.abs(vx), 3), sg = vx >= -.2 ? 1 : -1;
    const af = Math.atan2(vy + this.r * A, vxa) - delta * sg;
    const ar = Math.atan2(vy - this.r * B, vxa);
    const Dyr = Dr * this.rg;
    let Fyf = -Df * Math.tanh(CF * af / Df);
    let Fyr = -Dyr * Math.tanh(CR * ar / Math.max(Dyr, 1));
    let k = Math.hypot(Fxf, Fyf) / Df; if (k > 1) { Fxf /= k; Fyf /= k; }
    const rad = Dr * Math.max(this.rg, .55);
    k = Math.hypot(Fxr, Fyr) / rad; if (k > 1) { Fxr /= k; Fyr /= k; }
    this.fyr = Fyr;
    const cd = Math.cos(delta), sd = Math.sin(delta);
    const fx = Fxr + Fxf * cd - Fyf * sd - DRAG * vx * Math.abs(vx) - ROLL * vx;
    const fy = Fyr + Fxf * sd + Fyf * cd;
    let tq = A * (Fyf * cd + Fxf * sd) - B * Fyr;
    // ESC suave: só fora do modo drift, corrige a guinada para a que o volante pede
    if (!locked && spd > 4 && !this.hbT) {
      const lim = .92 * MU * G / spd, rT = clamp(vx * Math.tan(this.steer * dmax) / Lw, -lim, lim);
      tq -= (this.r - rT) * IZ * ESC_K;
    }
    if (this.impactT > 0) { tq -= this.r * IZ * 3; this.impactT -= dt; }
    this.ax += (fx / M - this.ax) * Math.min(1, dt * 8);
    // velocidade no referencial do mundo: a rotação já entra ao reprojetar no próximo passo
    vx += fx / M * dt; vy += fy / M * dt;
    this.r += tq / IZ * dt;
    // baixa velocidade: comportamento cinemático (sem patinar parado)
    if (spd < 3) {
      const kk = Math.min(1, dt * 8 * (1 - spd / 3));
      vy -= vy * kk; this.r += (vx * Math.tan(delta) / Lw - this.r) * kk;
      if (!this.thr && !inp.brake && spd < .5) vx *= .94;
    }
    this.vx = vx * c - vy * s; this.vy = vx * s + vy * c;
    this.x += this.vx * dt; this.y += this.vy * dt; this.h += this.r * dt;
    const drive = Math.max(0, Fxr), capR = Dr;
    // escorregamento (fumaça/marcas/som)
    const wheelspin = !hb && drive > capR * .7 && vx < 8 ? .3 : 0;
    this.slip = Math.max(Math.abs(ar) > .09 ? Math.min(1, (Math.abs(ar) - .09) * 3.5) : 0,
      hb && spd > 3 ? .8 : 0, wheelspin) * (spd > 2 ? 1 : 0);
    // câmbio e rotação
    const v = Math.max(0, vx);
    if (this.reverse || vx < -0.3) { this.gear = -1; }
    else {
      if (this.gear < 1) this.gear = 1;
      let rpm = 2000 + v / GEARS[this.gear - 1] * 7000;
      if (rpm > 8900 && this.gear < 7 && this.thr > .3) this.gear++;
      else if (rpm < 4600 && this.gear > 1) { this.gear--; if (this.thr < .2 && v > 9) this.pop = 0.35 + Math.random() * .3; }
    }
    const tgt = this.gear === -1 ? 2000 + Math.abs(vx) / 8 * 5000 : 2000 + v / GEARS[this.gear - 1] * 7000;
    const spinUp = this.slip > .4 && this.thr > .5 ? 1500 : 0;
    this.rpm += (clamp(Math.max(tgt + spinUp, 900 + this.thr * 1200), 900, 9200) - this.rpm) * Math.min(1, dt * 12);
    if (this.thr < .1 && this.rpm > 7000 && Math.random() < dt * 2) this.pop = Math.max(this.pop, .2);
    this.pop = Math.max(0, this.pop - dt);
  }
  corners() {
    const c = Math.cos(this.h), s = Math.sin(this.h), out = [];
    for (const [a, b] of [[HL, HW], [HL, -HW], [-HL, -HW], [-HL, HW], [0, HW], [0, -HW], [HL, 0], [-HL, 0]])
      out.push([this.x + a * c - b * s, this.y + a * s + b * c]);
    return out;
  }
  impulse(px, py, jx, jy, iz = IZ) {
    this.vx += jx / M; this.vy += jy / M;
    this.r += ((px - this.x) * jy - (py - this.y) * jx) / iz;
  }
  pointVel(px, py) {
    const rx = px - this.x, ry = py - this.y;
    return [this.vx - this.r * ry, this.vy + this.r * rx];
  }
}

// ---------------------------------------------------------------- áudio
const Audio = {
  ctx: null, on: true, cars: [],
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const ctx = this.ctx;
    this.master = ctx.createGain(); this.master.gain.value = this.on ? .55 : 0; this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    for (let k = 0; k < 2; k++) {
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (pan.pan) pan.pan.value = 0;
      pan.connect(this.master);
      const eg = ctx.createGain(); eg.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 3;
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
      const o2 = ctx.createOscillator(); o2.type = 'square';
      const o2g = ctx.createGain(); o2g.gain.value = .45;
      o1.connect(lp); o2.connect(o2g); o2g.connect(lp); lp.connect(eg); eg.connect(pan); o1.start(); o2.start();
      const ns = ctx.createBufferSource(); ns.buffer = buf; ns.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 5;
      const sg = ctx.createGain(); sg.gain.value = 0;
      ns.connect(bp); bp.connect(sg); sg.connect(pan); ns.start();
      this.cars.push({ pan, eg, lp, o1, o2, sg, bp, popT: 0 });
    }
  },
  toggle() { this.on = !this.on; if (this.master) this.master.gain.value = this.on ? .55 : 0; $('snd').textContent = this.on ? '🔊 SOM' : '🔇 MUDO'; },
  update(cars, two) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.cars.forEach((a, k) => {
      const c = cars[k];
      if (!c) { a.eg.gain.setTargetAtTime(0, t, .05); a.sg.gain.setTargetAtTime(0, t, .05); return; }
      if (a.pan.pan) a.pan.pan.setTargetAtTime(two ? (k ? .55 : -.55) : 0, t, .1);
      const f = c.rpm / 60 * 1.5;
      a.o1.frequency.setTargetAtTime(f, t, .02); a.o2.frequency.setTargetAtTime(f * 2.005, t, .02);
      a.lp.frequency.setTargetAtTime(500 + c.thr * 1800 + c.rpm * .12, t, .03);
      a.eg.gain.setTargetAtTime(.05 + c.thr * .09, t, .04);
      a.sg.gain.setTargetAtTime(Math.min(.22, c.slip * c.speed() * .012), t, .05);
      a.bp.frequency.setTargetAtTime(1500 + c.speed() * 12, t, .1);
      if (c.pop > 0 && t > a.popT) { a.popT = t + .06 + Math.random() * .09; this.burst(.18, 300 + Math.random() * 500, .07, a.pan); }
    });
  },
  burst(vol, freq, dur, dest) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.master); s.start(t, Math.random()); s.stop(t + dur + .02);
  },
  hit(v) { this.burst(Math.min(.7, v * .05), 260, .25); },
  beep(f, d) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), t = this.ctx.currentTime;
    o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + d);
  }
};

// ---------------------------------------------------------------- render
const cv = $('game'), ctx = cv.getContext('2d');
let DPR = 1, VW = 0, VH = 0;
const sprites = [new Image(), new Image()];
sprites[0].src = 'assets/p1.webp'; sprites[1].src = 'assets/p2.webp';
let T = null, PX = 14, trackCv, skidCv, skidCtx, trackCtx, smokeSprite;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1); VW = innerWidth; VH = innerHeight;
  cv.width = VW * DPR; cv.height = VH * DPR;
}
addEventListener('resize', resize); resize();
function noisePattern(c, base, amp, size = 256) {
  const p = document.createElement('canvas'); p.width = p.height = size;
  const x = p.getContext('2d'), d = x.createImageData(size, size);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = (Math.random() - .5) * amp;
    d.data[i] = base[0] + n; d.data[i + 1] = base[1] + n; d.data[i + 2] = base[2] + n; d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0); const pat = c.createPattern(p, 'repeat');
  if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(1 / PX));
  return pat;
}
function tracePath(x, closed = true) {
  x.beginPath(); x.moveTo(T.X[0], T.Y[0]);
  for (let i = 1; i < T.N; i++) x.lineTo(T.X[i], T.Y[i]);
  if (closed) x.closePath();
}
function drawCell(x, cell) {
  const cx = T.X0 + cell.c * PITCH + CELL / 2, cy = T.yr(cell.r);
  x.save();
  x.globalAlpha = cell.owner >= 0 ? 1 : (cell.lv ? .9 : .55);
  x.fillStyle = T.cellBase;
  x.fillRect(cx - CELL / 2 - .08, cy - CELL / 2 - .08, CELL + .16, CELL + .16);
  x.fillStyle = cell.owner >= 0 ? PCOL[cell.owner] : AMBER[cell.lv];
  if (cell.owner >= 0) { x.shadowColor = PCOL[cell.owner]; x.shadowBlur = 8; }
  x.beginPath(); x.roundRect ? x.roundRect(cx - CELL / 2, cy - CELL / 2, CELL, CELL, .35) : x.rect(cx - CELL / 2, cy - CELL / 2, CELL, CELL);
  x.fill(); x.restore();
}
function buildStatic() {
  trackCv = document.createElement('canvas');
  trackCv.width = Math.ceil((T.W - T.minX) * PX); trackCv.height = Math.ceil(T.H * PX);
  const x = trackCtx = trackCv.getContext('2d');
  x.setTransform(PX, 0, 0, PX, -T.minX * PX, 0);
  // chão/muros
  x.fillStyle = noisePattern(x, [30, 25, 19], 16); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.fillRect(0, 0, trackCv.width, trackCv.height); x.restore();
  x.lineJoin = 'round'; x.lineCap = 'round';
  tracePath(x); x.strokeStyle = '#3d342a'; x.lineWidth = HALF * 2 + .5; x.stroke();
  tracePath(x); x.strokeStyle = '#0c0a08'; x.lineWidth = HALF * 2 + .15; x.stroke();
  const asph = noisePattern(x, [28, 24, 20], 22);
  x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.restore();
  tracePath(x); x.strokeStyle = 'rgba(232,228,220,.28)'; x.lineWidth = HALF * 2; x.stroke();
  tracePath(x); x.strokeStyle = asph; x.lineWidth = HALF * 2 - .45; x.stroke();
  T.cellBase = '#16120e';
  // trilhos de pneu escurecidos no meio da faixa
  tracePath(x); x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 3.2; x.stroke();
  // zebras
  for (const t of T.turns) {
    const ro = t.r + HALF - .45, a0 = t.a0 * Math.PI / 180, a1 = t.a1 * Math.PI / 180;
    for (const [col, dash] of [['#e8e4dc', []], ['#e3170a', [1.1, 1.1]]]) {
      x.beginPath(); x.arc(t.ox, t.oy, ro, Math.min(a0, a1), Math.max(a0, a1)); x.setLineDash(dash);
      x.strokeStyle = col; x.lineWidth = .8; x.lineCap = 'butt'; x.stroke();
    }
    x.setLineDash([]);
  }
  // células
  for (const cell of T.cells) drawCell(x, cell);
  // largada
  const sx = T.xs - E + 1.5, sy = T.yr(0);
  for (let i = 0; i < 22; i++) { x.fillStyle = (i + Math.floor(i / 11)) % 2 ? '#e8e4dc' : '#0d0b09'; x.fillRect(sx + Math.floor(i / 11) * .5, sy - HALF + (i % 11), .5, 1); }
  // nome pintado na reta de retorno
  x.save(); x.font = 'italic 900 7px Inter, sans-serif'; x.fillStyle = 'rgba(232,228,220,.06)'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('RAPHALIMA38 GRAND PRIX', (T.xl + T.xe) / 2, T.ybot + .3); x.restore();
  // meses
  x.save(); x.font = '700 1.6px JetBrains Mono, monospace'; x.fillStyle = '#6b6359';
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']; let last = -1;
  for (const c of T.cells) if (c.r === 0) { const m = +c.d.slice(5, 7) - 1; if (m !== last) { last = m; if (c.c < T.cols - 2) x.fillText(MES[m], T.X0 + c.c * PITCH, T.yr(0) - HALF - .9); } }
  x.restore();
  // luminárias âmbar nos muros entre as faixas
  x.save(); x.globalCompositeOperation = 'lighter';
  for (let r = 0; r <= 7; r++) {
    const y = r === 7 ? T.ybot + HALF + .4 : T.yr(r) - HALF - .5;
    for (let lx = T.xs; lx < T.xe; lx += 13) {
      const g = x.createRadialGradient(lx, y, 0, lx, y, 7); g.addColorStop(0, 'rgba(255,170,60,.16)'); g.addColorStop(1, 'rgba(255,170,60,0)');
      x.fillStyle = g; x.fillRect(lx - 7, y - 7, 14, 14);
      x.fillStyle = 'rgba(255,196,107,.9)'; x.fillRect(lx - .7, y - .12, 1.4, .24);
    }
  }
  x.restore();
  skidCv = document.createElement('canvas'); skidCv.width = trackCv.width; skidCv.height = trackCv.height;
  skidCtx = skidCv.getContext('2d'); skidCtx.setTransform(PX, 0, 0, PX, -T.minX * PX, 0);
  smokeSprite = document.createElement('canvas'); smokeSprite.width = smokeSprite.height = 64;
  const sx2 = smokeSprite.getContext('2d'), g = sx2.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(225,219,208,.9)'); g.addColorStop(.45, 'rgba(210,204,194,.45)'); g.addColorStop(1, 'rgba(200,194,184,0)');
  sx2.fillStyle = g; sx2.fillRect(0, 0, 64, 64);
}

// ---------------------------------------------------------------- partículas
const smoke = [], sparks = [], WIND = [0.9, -0.55];
function emitSmoke(x, y, vx, vy, k) {
  if (smoke.length > (MOBILE ? 320 : 650)) smoke.shift();
  smoke.push({ x, y, vx: vx * .18 + (Math.random() - .5) * .8, vy: vy * .18 + (Math.random() - .5) * .8, r: .5 + Math.random() * .4, a: .16 + k * .22, age: 0, life: 4 + Math.random() * 2.5 });
}
function emitSparks(x, y, nx, ny, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.atan2(ny, nx) + (Math.random() - .5) * 2.2, v = 6 + Math.random() * 14;
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: .2 + Math.random() * .35 });
  }
}

// ---------------------------------------------------------------- jogo
const state = { mode: 0, laps: 3, cars: [], phase: 'menu', t: 0, countdown: 0, raceT: 0, cam: { x: 0, y: 0, z: 1 }, chase: true, msgT: 0, fadeT: 0, finishers: [] };
const keys = {};
const CODES = { KeyW: [0, 'gas'], KeyS: [0, 'brake'], KeyA: [0, 'left'], KeyD: [0, 'right'], Space: [0, 'hb'],
  ArrowUp: [1, 'gas'], ArrowDown: [1, 'brake'], ArrowLeft: [1, 'left'], ArrowRight: [1, 'right'], ShiftRight: [1, 'hb'] };
addEventListener('keydown', e => {
  if (CODES[e.code] && state.phase !== 'menu') e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = 1;
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state.phase === 'race' || state.phase === 'count') pause(true); else if (state.phase === 'paused') pause(false); }
  if (e.code === 'KeyM') { Audio.init(); Audio.toggle(); }
  if (e.code === 'KeyC' && state.mode === 1) state.chase = !state.chase;
});
addEventListener('keyup', e => { keys[e.code] = 0; });
addEventListener('blur', () => { for (const k in keys) keys[k] = 0; if (state.phase === 'race') pause(true); });
// ---------------- modo celular: volante analógico (arrastar) + pedais multitoque
const MOBILE = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && Math.min(screen.width, screen.height) < 900);
const touch = { steer: 0, gas: 0, brake: 0, hb: 0 };
if (MOBILE) {
  document.body.classList.add('mobile');
  $('b1').textContent = 'JOGAR';
  addEventListener('contextmenu', e => e.preventDefault());
  const zone = $('steerZone'), knob = $('steerKnob');
  let sid = null, x0 = 0;
  const setSteer = v => { touch.steer = v; knob.style.transform = `translateX(${v * (zone.querySelector('#steerTrack').clientWidth / 2 - 34)}px)`; };
  zone.addEventListener('pointerdown', e => { e.preventDefault(); sid = e.pointerId; x0 = e.clientX; try { zone.setPointerCapture(sid); } catch (_) {} setSteer(0); Audio.init(); });
  zone.addEventListener('pointermove', e => { if (e.pointerId === sid) setSteer(clamp((e.clientX - x0) / 70, -1, 1)); });
  const endS = e => { if (e.pointerId === sid) { sid = null; setSteer(0); } };
  zone.addEventListener('pointerup', endS); zone.addEventListener('pointercancel', endS);
  document.querySelectorAll('.pedal').forEach(el => {
    const k = el.dataset.k;
    const on = e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) {} touch[k] = 1; el.classList.add('on'); if (navigator.vibrate && k === 'hb') navigator.vibrate(12); };
    const off = () => { touch[k] = 0; el.classList.remove('on'); };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
  });
  $('pauseBtn').addEventListener('click', () => { if (state.phase === 'race' || state.phase === 'count') pause(true); });
}
const vibrate = ms => { if (MOBILE && navigator.vibrate) navigator.vibrate(ms | 0); };
function readInputs() {
  state.cars.forEach(c => { for (const k in c.input) c.input[k] = 0; });
  for (const code in CODES) if (keys[code]) { const [p, k] = CODES[code]; if (state.cars[p]) state.cars[p].input[k] = 1; }
  const c0 = state.cars[0];
  if (c0 && MOBILE) {
    c0.input.right = Math.max(c0.input.right, Math.max(0, touch.steer)); c0.input.left = Math.max(c0.input.left, Math.max(0, -touch.steer));
    for (const k of ['gas', 'brake', 'hb']) if (touch[k]) c0.input[k] = 1;
  }
}
function msg(text, dur = 1.4) { $('msg').textContent = text; $('msg').style.opacity = 1; state.msgT = dur; }
function fmt(t) { if (t == null) return '—'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(3).padStart(6, '0')}`; }
function startRace(mode) {
  Audio.init();
  if (MOBILE) {
    mode = 1; document.body.classList.add('playing');
    const de = document.documentElement;
    if (de.requestFullscreen && !document.fullscreenElement) de.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
  }
  state.mode = mode; state.phase = 'count'; state.countdown = 0; state.raceT = 0; state.finishers = [];
  smoke.length = 0; sparks.length = 0;
  skidCtx.save(); skidCtx.setTransform(1, 0, 0, 1, 0, 0); skidCtx.clearRect(0, 0, skidCv.width, skidCv.height); skidCtx.restore();
  for (const c of T.cells) if (c.owner >= 0) { c.owner = -1; drawCell(trackCtx, c); }
  const sx = T.xs - E + 6, sy = T.yr(0);
  state.cars = mode === 1 ? [new Car(0, sx, sy, 0)] : [new Car(0, sx, sy - 2.6, 0), new Car(1, sx - 6.5, sy + 2.6, 0)];
  state.cars.forEach(c => { c.si = nearest(T, c.x, c.y, 0, 40).i; c.prevS = T.S[c.si]; });
  const best = JSON.parse(localStorage.getItem('pilotar_best') || 'null');
  if (mode === 1 && best) state.cars[0].best = best;
  ['menu', 'results', 'pause'].forEach(id => $(id).classList.add('hidden'));
  $('hud1').style.display = 'flex'; $('hud2').style.display = mode === 2 ? 'flex' : 'none';
  $('timer').style.display = 'block'; $('lights').style.display = 'flex';
  document.querySelectorAll('#lights i').forEach(i => i.classList.remove('on'));
  state.cam.init = false;
}
function pause(on) {
  if (on) { state.prevPhase = state.phase; state.phase = 'paused'; $('pause').classList.remove('hidden'); }
  else { state.phase = state.prevPhase; $('pause').classList.add('hidden'); }
}
function toMenu() {
  state.phase = 'menu'; state.cars = []; document.body.classList.remove('playing');
  ['pause', 'results'].forEach(id => $(id).classList.add('hidden')); $('menu').classList.remove('hidden');
  $('hud1').style.display = $('hud2').style.display = 'none'; $('timer').style.display = 'none'; $('lights').style.display = 'none';
}
function finishRace() {
  state.phase = 'results';
  const cs = state.cars;
  let html = '';
  if (state.mode === 1) {
    const c = cs[0];
    $('resTitle').textContent = 'TEMPO FINAL';
    c.laps.forEach((t, i) => { html += `<tr><td>VOLTA ${i + 1}</td><td style="text-align:right">${fmt(t)}${t === Math.min(...c.laps) ? ' ⭐' : ''}</td></tr>`; });
    html += `<tr><td><b>TOTAL</b></td><td style="text-align:right"><b>${fmt(c.finish)}</b></td></tr><tr><td>RECORDE DA PISTA</td><td style="text-align:right">${fmt(c.best)}</td></tr>`;
  } else {
    const order = [...cs].sort((a, b) => (b.done - a.done) || (a.finish - b.finish) || (b.lap * T.L + T.S[b.si]) - (a.lap * T.L + T.S[a.si]));
    $('resTitle').innerHTML = `<span style="color:${PCOL[order[0].id]}">${order[0].id ? 'VERMELHO' : 'PRATA'}</span> VENCE`;
    order.forEach((c, i) => {
      const painted = T.cells.filter(x => x.owner === c.id).length;
      html += `<tr><td style="color:${PCOL[c.id]}">${i + 1}º · JOGADOR ${c.id + 1}</td><td>${c.done ? fmt(c.finish) : 'não terminou'}</td><td>melhor ${fmt(c.best)}</td><td>${painted} commits</td></tr>`;
    });
  }
  $('resTable').innerHTML = html;
  setTimeout(() => $('results').classList.remove('hidden'), 1200);
}

// colisões
function wallCollide(c) {
  const pts = c.corners();
  let worst = null;
  for (const [px, py] of pts) {
    const n = nearest(T, px, py, c.si, 16);
    const pen = n.d - HALF;
    if (pen > 0 && (!worst || pen > worst.pen)) worst = { px, py, pen, nx: (px - n.x) / n.d, ny: (py - n.y) / n.d };
  }
  if (!worst) return;
  const { px, py, pen, nx, ny } = worst;
  c.x -= nx * pen; c.y -= ny * pen;
  const [vpx, vpy] = c.pointVel(px, py), vn = vpx * nx + vpy * ny;
  if (vn <= 0) return;
  const rx = px - c.x, ry = py - c.y, rn = rx * ny - ry * nx;
  const j = (1 + .12) * vn / (1 / M + rn * rn / IZ_HIT);
  c.impulse(px, py, -j * nx, -j * ny, IZ_HIT);
  const tx = -ny, ty = nx, vt = vpx * tx + vpy * ty, rt = rx * ty - ry * tx;
  const jt = clamp(vt / (1 / M + rt * rt / IZ_HIT), -.25 * j, .25 * j);
  c.impulse(px, py, -jt * tx, -jt * ty, IZ_HIT);
  if (vn > 3) c.impactT = .45;
  if (vn > 2.5) { emitSparks(px, py, -nx, -ny, Math.min(24, vn * 2) | 0); Audio.hit(vn); vibrate(Math.min(70, vn * 6)); state.shake = Math.min(1, vn / 14); }
}
function obb(c) {
  const co = Math.cos(c.h), si = Math.sin(c.h);
  return { ax: [[co, si], [-si, co]], pts: [[HL, HW], [HL, -HW], [-HL, -HW], [-HL, HW]].map(([a, b]) => [c.x + a * co - b * si, c.y + a * si + b * co]) };
}
function carCollide(a, b) {
  if (Math.hypot(a.x - b.x, a.y - b.y) > 6) return;
  const A1 = obb(a), B1 = obb(b);
  let min = 1e9, n = null;
  for (const ax of [...A1.ax, ...B1.ax]) {
    const pa = A1.pts.map(p => p[0] * ax[0] + p[1] * ax[1]), pb = B1.pts.map(p => p[0] * ax[0] + p[1] * ax[1]);
    const o = Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
    if (o <= 0) return;
    if (o < min) { min = o; n = ax; }
  }
  let nx = n[0], ny = n[1];
  if ((b.x - a.x) * nx + (b.y - a.y) * ny < 0) { nx = -nx; ny = -ny; }
  a.x -= nx * min / 2; a.y -= ny * min / 2; b.x += nx * min / 2; b.y += ny * min / 2;
  // ponto de contato: vértice mais profundo
  let cp = A1.pts.reduce((p, q) => (q[0] * nx + q[1] * ny > p[0] * nx + p[1] * ny ? q : p));
  const cb = B1.pts.reduce((p, q) => (q[0] * nx + q[1] * ny < p[0] * nx + p[1] * ny ? q : p));
  cp = [(cp[0] + cb[0]) / 2, (cp[1] + cb[1]) / 2];
  const va = a.pointVel(cp[0], cp[1]), vb = b.pointVel(cp[0], cp[1]);
  const rvx = vb[0] - va[0], rvy = vb[1] - va[1], vn = rvx * nx + rvy * ny;
  if (vn >= 0) return;
  const ra = (cp[0] - a.x) * ny - (cp[1] - a.y) * nx, rb = (cp[0] - b.x) * ny - (cp[1] - b.y) * nx;
  const IH = IZ * 2.5, j = -(1 + .15) * vn / (2 / M + ra * ra / IH + rb * rb / IH);
  a.impulse(cp[0], cp[1], -j * nx, -j * ny, IH); b.impulse(cp[0], cp[1], j * nx, j * ny, IH);
  const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty;
  const jt = clamp(-vt / (2 / M), -.2 * j, .2 * j);
  a.impulse(cp[0], cp[1], -jt * tx, -jt * ty, IH); b.impulse(cp[0], cp[1], jt * tx, jt * ty, IH);
  if (-vn > 3) { a.impactT = b.impactT = .35; }
  if (-vn > 1.5) { emitSparks(cp[0], cp[1], nx, ny, Math.min(30, -vn * 3) | 0); Audio.hit(-vn); vibrate(Math.min(80, -vn * 7)); state.shake = Math.min(1, -vn / 12); }
}
function track(c, dt) {
  const n = nearest(T, c.x, c.y, c.si, 10);
  const prev = c.si; c.si = n.i;
  if (prev > T.N * .8 && c.si < T.N * .2 && c.half) {   // cruzou a linha de chegada
    const lt = state.raceT - c.lapStart; c.lapStart = state.raceT; c.lap++; c.half = false; c.laps.push(lt);
    if (c.best == null || lt < c.best) { c.best = lt; if (state.mode === 1) localStorage.setItem('pilotar_best', JSON.stringify(lt)); if (c.lap > 0) msg(state.mode === 1 ? 'MELHOR VOLTA!' : `${c.id ? 'VERMELHO' : 'PRATA'}: MELHOR VOLTA`, 1.2); }
    if (c.lap >= state.laps && !c.done) { c.done = true; c.finish = state.raceT; state.finishers.push(c); msg(state.mode === 1 ? 'BANDEIRADA!' : `${c.id ? 'VERMELHO' : 'PRATA'} CRUZA A LINHA!`, 2); }
    else if (c.lap === state.laps - 1 && state.laps > 1) msg('ÚLTIMA VOLTA', 1.4);
  }
  if (c.si > T.N * .45 && c.si < T.N * .55) c.half = true;
  // contramão
  const ds = T.S[c.si] - c.prevS; c.prevS = T.S[c.si];
  if (Math.abs(ds) < 5) c.wrong = ds < -.02 ? c.wrong + dt : Math.max(0, c.wrong - dt * 2);
  // pinta as células por onde passa
  for (const cell of T.cells) {
    if (cell.owner === c.id) continue;
    const cx = T.X0 + cell.c * PITCH + CELL / 2, cy = T.yr(cell.r);
    if (Math.abs(cx - c.x) < 2 && Math.abs(cy - c.y) < 2) { cell.owner = c.id; drawCell(trackCtx, cell); }
  }
}
function update(dt) {
  readInputs();
  const locked = state.phase === 'count' || state.phase === 'results';
  if (state.phase === 'count') {
    state.countdown += dt;
    const n = Math.min(5, Math.floor(state.countdown / .8));
    document.querySelectorAll('#lights i').forEach((el, i) => el.classList.toggle('on', i < n));
    if (n > (state.lastN || 0)) { Audio.beep(440, .15); }
    state.lastN = n;
    if (state.countdown > 4 + .6 + Math.random() * .02) { state.phase = 'race'; state.lastN = 0; Audio.beep(880, .4); msg('VAI!', .9); $('lights').style.display = 'none'; }
  } else if (state.phase === 'race') state.raceT += dt;
  const SUB = 4, h = dt / SUB;
  for (let k = 0; k < SUB; k++) {
    for (const c of state.cars) c.step(h, locked || c.done);
    for (const c of state.cars) wallCollide(c);
    if (state.cars.length === 2) carCollide(state.cars[0], state.cars[1]);
  }
  for (const c of state.cars) {
    track(c, dt);
    // fumaça e marcas das rodas traseiras
    const co = Math.cos(c.h), si = Math.sin(c.h);
    const wheels = [[-B - .25, .8], [-B - .25, -.8]].map(([a, b]) => [c.x + a * co - b * si, c.y + a * si + b * co]);
    wheels.forEach((w, i) => {
      if (c.slip > .05) {
        const p = c.rw[i];
        if (p) { skidCtx.strokeStyle = `rgba(6,5,4,${.12 + c.slip * .3})`; skidCtx.lineWidth = .32; skidCtx.lineCap = 'round'; skidCtx.beginPath(); skidCtx.moveTo(p[0], p[1]); skidCtx.lineTo(w[0], w[1]); skidCtx.stroke(); }
        c.rw[i] = w;
        if (Math.random() < c.slip * dt * 60 * .55) emitSmoke(w[0], w[1], c.vx, c.vy, c.slip);
      } else c.rw[i] = null;
    });
    if (c.pop > 0 && Math.random() < dt * 25) c.popT = .07;
    c.popT = Math.max(0, c.popT - dt);
    // reposiciona se ficar preso
    c.stuck = c.speed() < .6 && c.input.gas && state.phase === 'race' ? c.stuck + dt : 0;
    if (c.stuck > 2.5) {
      const i = c.si; c.x = T.X[i]; c.y = T.Y[i]; c.h = Math.atan2(T.TY[i], T.TX[i]); c.vx = c.vy = c.r = 0; c.stuck = 0; msg('REPOSICIONADO', 1);
    }
  }
  // desbota as marcas aos poucos
  state.fadeT += dt;
  if (state.fadeT > .5) {
    state.fadeT = 0;
    skidCtx.save(); skidCtx.setTransform(1, 0, 0, 1, 0, 0); skidCtx.globalCompositeOperation = 'destination-out';
    skidCtx.fillStyle = 'rgba(0,0,0,.012)'; skidCtx.fillRect(0, 0, skidCv.width, skidCv.height); skidCtx.restore();
  }
  for (const p of smoke) { p.age += dt; p.vx += (WIND[0] - p.vx) * dt * .6; p.vy += (WIND[1] - p.vy) * dt * .6; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * (1.3 - p.age / p.life * .7); }
  while (smoke.length && smoke[0].age > smoke[0].life) smoke.shift();
  for (let i = sparks.length - 1; i >= 0; i--) { const p = sparks[i]; p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96; if (p.age > p.life) sparks.splice(i, 1); }
  if (state.phase === 'race') {
    const all = state.cars.every(c => c.done);
    if (all) finishRace();
    else if (state.mode === 2 && state.finishers.length === 1 && state.raceT - state.finishers[0].finish > 15) finishRace();
  }
  state.msgT -= dt; if (state.msgT <= 0) $('msg').style.opacity = 0;
  state.shake = Math.max(0, (state.shake || 0) - dt * 2.5);
  Audio.update(state.cars, state.mode === 2);
}

function drawCar(c) {
  const img = sprites[c.id], co = Math.cos(c.h), si = Math.sin(c.h);
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.h);
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.filter = 'blur(3px)'; ctx.fillRect(-2.35, -1.05, 4.75, 2.1); ctx.filter = 'none';
  // escapamento: chamas
  if (c.popT > 0) {
    const g = ctx.createRadialGradient(-2.6, 0, 0, -2.6, 0, 1.6);
    g.addColorStop(0, 'rgba(255,240,200,.95)'); g.addColorStop(.35, 'rgba(255,140,30,.8)'); g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-3.1, 0, 1.4 + Math.random() * .5, .55, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (img.complete && img.naturalWidth) ctx.drawImage(img, -2.32, -1.03, 4.64, 2.06);
  else { ctx.fillStyle = PCOL[c.id]; ctx.fillRect(-2.25, -.95, 4.5, 1.9); }
  // lanternas
  const br = c.braking || (c.input.brake && c.speed() > .5) || c.input.hb;
  ctx.fillStyle = br ? 'rgba(255,40,20,1)' : 'rgba(170,20,10,.9)';
  ctx.fillRect(-2.33, -.82, .14, .38); ctx.fillRect(-2.33, .44, .14, .38);
  if (br) { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(-2.4, 0, 0, -2.4, 0, 1.8); g.addColorStop(0, 'rgba(255,30,10,.45)'); g.addColorStop(1, 'rgba(255,30,10,0)'); ctx.fillStyle = g; ctx.fillRect(-4.2, -1.8, 3.6, 3.6); ctx.globalCompositeOperation = 'source-over'; }
  if (c.reverse) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(-2.33, -.2, .12, .4); }
  ctx.restore();
}
function drawLights(c) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.h); ctx.globalCompositeOperation = 'lighter';
  for (const s of [-.62, .62]) {
    const g = ctx.createLinearGradient(2.2, 0, 16, 0);
    g.addColorStop(0, 'rgba(255,236,200,.33)'); g.addColorStop(.4, 'rgba(255,226,180,.12)'); g.addColorStop(1, 'rgba(255,226,180,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(2.2, s * .9); ctx.lineTo(16, s * 6.2 - 2.4 * Math.sign(s) * .2); ctx.quadraticCurveTo(17.5, s * 1.5, 16, -s * 1.4); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0d0b09'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (!T) return;
  // câmera
  const TOP = MOBILE ? 0 : VW > 700 ? 92 : 70;
  const fitZ = Math.min(VW / (T.W - T.minX + 2), (VH - TOP) / (T.H + 2));
  let tx, ty, tz;
  const chase = state.mode === 1 && state.chase && state.cars[0];
  if (chase) {
    const c = state.cars[0]; tz = Math.max(fitZ * 2.3, Math.min(VW, VH) / (MOBILE ? 36 : 52));
    tx = c.x + c.vx * .55; ty = c.y + c.vy * .55;
    const hw = VW / 2 / tz, hh = (VH - TOP) / 2 / tz;
    tx = T.W - T.minX > 2 * hw ? clamp(tx, T.minX + hw, T.W - hw) : (T.W + T.minX) / 2;
    ty = T.H > 2 * hh ? clamp(ty, hh - TOP / 2 / tz, T.H - hh - TOP / 2 / tz) : T.H / 2;
  } else { tz = fitZ; tx = (T.W + T.minX) / 2; ty = T.H / 2 - TOP / 2 / fitZ; }
  const cam = state.cam;
  if (!cam.init) { cam.x = tx; cam.y = ty; cam.z = tz; cam.init = true; }
  cam.x += (tx - cam.x) * .12; cam.y += (ty - cam.y) * .12; cam.z += (tz - cam.z) * .08;
  const sh = (state.shake || 0) * .35;
  const z = cam.z * DPR;
  ctx.setTransform(z, 0, 0, z, VW * DPR / 2 - (cam.x + (Math.random() - .5) * sh) * z, VH * DPR / 2 - (cam.y + (Math.random() - .5) * sh) * z);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(trackCv, T.minX, 0, trackCv.width / PX, trackCv.height / PX);
  ctx.drawImage(skidCv, T.minX, 0, skidCv.width / PX, skidCv.height / PX);
  for (const c of state.cars) drawLights(c);
  for (const c of state.cars) drawCar(c);
  for (const p of smoke) {
    const k = p.age / p.life, a = p.a * Math.pow(1 - k, 1.4) * Math.min(1, p.age * 6);
    ctx.globalAlpha = a; ctx.drawImage(smokeSprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = .12; ctx.lineCap = 'round';
  for (const p of sparks) { const k = 1 - p.age / p.life; ctx.strokeStyle = `rgba(255,${180 + 60 * k | 0},90,${k})`; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .03, p.y - p.vy * .03); ctx.stroke(); }
  ctx.globalCompositeOperation = 'source-over';
  // vinheta
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const v = ctx.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * .35, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * .75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, cv.width, cv.height);
}
function hud() {
  if (state.phase === 'menu' || !state.cars.length) return;
  const cs = state.cars, prog = c => c.lap * T.L + T.S[c.si] + (c.done ? 1e6 - c.finish : 0);
  const order = [...cs].sort((a, b) => prog(b) - prog(a));
  $('timer').textContent = fmt(state.raceT);
  cs.forEach(c => {
    const k = c.id + 1;
    $('pos' + k).textContent = cs.length > 1 ? (order.indexOf(c) + 1) + 'º' : (c.done ? '🏁' : 'P1');
    $('pos' + k).style.color = PCOL[c.id];
    $('lap' + k).textContent = `${Math.min(c.lap + 1, state.laps)}/${state.laps}`;
    $('cur' + k).textContent = fmt(c.done ? c.laps[c.laps.length - 1] : state.raceT - c.lapStart);
    $('best' + k).textContent = fmt(c.best);
    $('spd' + k).textContent = Math.round(c.speed() * 3.6);
    $('gear' + k).textContent = c.gear === -1 ? 'R' : c.speed() < .3 && !c.thr ? 'N' : c.gear;
    const leds = $('leds' + k).children, n = Math.round(clamp((c.rpm - 5000) / 3800, 0, 1) * 10);
    for (let i = 0; i < 10; i++) leds[i].style.background = i < n ? (i < 4 ? '#3ddc6b' : i < 7 ? '#f5a524' : '#e3170a') : '#2a241d';
    if (c.wrong > 1.2) msg('CONTRAMÃO!', .3);
  });
}
for (const id of ['leds1', 'leds2']) for (let i = 0; i < 10; i++) $(id).appendChild(document.createElement('i'));

// ---------------------------------------------------------------- loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (T && state.phase !== 'paused' && state.phase !== 'menu') update(dt);
  else if (T && state.phase === 'menu') demoDrive(dt);
  render(); hud();
  requestAnimationFrame(frame);
}
// no menu, um carro "fantasma" dá voltas de fundo
function demoDrive(dt) {
  if (!state.demo) { const c = new Car(0, T.xs, T.yr(0), 0); c.si = 0; state.demo = c; }
  const c = state.demo, ahead = (c.si + Math.round(9 / STEP)) % T.N;
  const ang = Math.atan2(T.Y[ahead] - c.y, T.X[ahead] - c.x);
  let d = ang - c.h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  const curve = Math.abs(Math.atan2(T.TY[(c.si + 40) % T.N], T.TX[(c.si + 40) % T.N]) - Math.atan2(T.TY[c.si], T.TX[c.si]));
  const fast = c.speed() > (curve > .3 && curve < 6 ? 11 : 30);
  c.input = { gas: fast ? 0 : 1, brake: fast && c.speed() > 13 ? 1 : 0, left: d < -.05 ? 1 : 0, right: d > .05 ? 1 : 0, hb: 0 };
  for (let k = 0; k < 4; k++) { c.step(dt / 4, false); wallCollide(c); }
  c.si = nearest(T, c.x, c.y, c.si, 10).i;
  state.cars = [c];
  const co = Math.cos(c.h), si = Math.sin(c.h);
  [[-B - .25, .8], [-B - .25, -.8]].forEach(([a, b], i) => {
    const w = [c.x + a * co - b * si, c.y + a * si + b * co];
    if (c.slip > .05) { if (Math.random() < c.slip * .5) emitSmoke(w[0], w[1], c.vx, c.vy, c.slip); }
  });
  for (const p of smoke) { p.age += dt; p.vx += (WIND[0] - p.vx) * dt * .6; p.vy += (WIND[1] - p.vy) * dt * .6; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 1.1; }
  while (smoke.length && smoke[0].age > smoke[0].life) smoke.shift();
  state.cam.init = false;
}

// ---------------------------------------------------------------- UI
$('b1').onclick = () => startRace(1);
$('b2').onclick = () => startRace(2);
document.querySelectorAll('[data-laps]').forEach(b => b.onclick = () => {
  document.querySelectorAll('[data-laps]').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); state.laps = +b.dataset.laps;
});
$('snd').onclick = () => { Audio.init(); Audio.toggle(); };
$('resume').onclick = () => pause(false);
$('restart').onclick = () => startRace(state.mode);
$('tomenu').onclick = () => { state.demo = null; toMenu(); };
$('again').onclick = () => startRace(state.mode);
$('resMenu').onclick = () => { state.demo = null; toMenu(); };
addEventListener('visibilitychange', () => { if (document.hidden && state.phase === 'race') pause(true); });

loadData().then(data => {
  T = buildTrack(data);
  buildStatic();
  $('dataInfo').textContent = data.demo ? 'Usando dados de exemplo (contribuições indisponíveis)' :
    `${data.total != null ? data.total + ' contribuições no último ano · ' : ''}atualizado ${data.updated || ''}`;
  window.__pilotar = { state, T, Car, wallCollide, carCollide, nearest };
});
requestAnimationFrame(frame);
})();
