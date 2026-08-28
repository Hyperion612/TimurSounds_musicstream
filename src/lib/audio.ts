/* Аудио-ядро TimurSounds: процедурный синтезатор + воспроизведение файлов. */

export interface Source {
  start(offset: number): void;
  pause(): void;
  stop(): void;
  seek(sec: number): void;
  getPos(): number;
  setVolume(v: number): void;
  onEnded: (() => void) | null;
}

/* ---------- shared context ---------- */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function ensure(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(comp);
    comp.connect(ctx.destination);
    const len = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

export function setMasterVolume(v: number) {
  if (ctx && master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.03);
}

/* ---------- seeded rng ---------- */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- voices ---------- */
function kick(t: number, vel: number) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(165, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(0.9 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + 0.36);
}

function snare(t: number, vel: number) {
  if (!ctx || !master || !noiseBuf) return;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 1700;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  s.connect(f);
  f.connect(g);
  g.connect(master);
  s.start(t, Math.random());
  s.stop(t + 0.2);
  const o = ctx.createOscillator();
  const og = ctx.createGain();
  o.frequency.value = 196;
  og.gain.setValueAtTime(0.25 * vel, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  o.connect(og);
  og.connect(master);
  o.start(t);
  o.stop(t + 0.1);
}

function hat(t: number, vel: number, open = false) {
  if (!ctx || !master || !noiseBuf) return;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 7600;
  const g = ctx.createGain();
  const dur = open ? 0.22 : 0.045;
  g.gain.setValueAtTime(0.22 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(master);
  s.start(t, Math.random());
  s.stop(t + dur + 0.02);
}

function bassNote(t: number, freq: number, dur: number, vel = 1) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.value = freq;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(700, t);
  f.frequency.exponentialRampToValueAtTime(180, t + dur);
  f.Q.value = 6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.42 * vel, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(f);
  f.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function pluck(t: number, freq: number, vel: number) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  o.type = "square";
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.12 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 3200;
  o.connect(f);
  f.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + 0.2);
}

function pad(t: number, freqs: number[], dur: number) {
  if (!ctx || !master) return;
  for (const fr of freqs) {
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = fr;
      o.detune.value = det;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(500, t);
      f.frequency.linearRampToValueAtTime(1100, t + dur * 0.5);
      f.frequency.linearRampToValueAtTime(420, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + Math.min(0.9, dur * 0.35));
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(f);
      f.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }
}

/* ---------- procedural track ---------- */
export class SynthSource implements Source {
  onEnded: (() => void) | null = null;
  private bpm: number;
  private seed: number;
  private totalSteps: number;
  private stepDur: number;
  private root: number;
  private rng: () => number;
  private bassPat: number[]; // -1 rest, else scale degree
  private kickPat: number[];
  private snarePat: number[];
  private hatPat: number[];
  private arpPat: number[];
  private t0 = 0;
  private nextStep = 0;
  private pausedAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private playing = false;

  constructor(opts: { bpm: number; seed: number; duration: number }) {
    this.bpm = opts.bpm;
    this.seed = opts.seed;
    this.rng = mulberry32(opts.seed * 7919 + 13);
    this.stepDur = 60 / this.bpm / 4;
    this.totalSteps = Math.round(opts.duration / this.stepDur);
    const roots = [55, 58.27, 61.74, 65.41, 49];
    this.root = roots[Math.floor(this.rng() * roots.length)];
    const r = this.rng;
    this.kickPat = Array.from({ length: 16 }, (_, i) => (i === 0 || i === 8 ? 1 : r() < 0.22 ? 0.8 : 0));
    this.snarePat = Array.from({ length: 16 }, (_, i) => (i === 4 || i === 12 ? 1 : r() < 0.1 ? 0.4 : 0));
    this.hatPat = Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? 0.5 + r() * 0.5 : r() < 0.3 ? 0.35 : 0));
    this.bassPat = Array.from({ length: 16 }, (_, i) => {
      if (i === 0 || i === 6 || i === 10) return Math.floor(r() * 3) === 0 ? 2 : 0;
      if (i === 3 || i === 8 || i === 14) return r() < 0.7 ? Math.floor(r() * 4) : -1;
      return r() < 0.18 ? Math.floor(r() * 5) : -1;
    });
    this.arpPat = Array.from({ length: 8 }, () => (r() < 0.6 ? Math.floor(r() * 8) : -1));
  }

  private scale = [0, 2, 3, 5, 7, 8, 10];
  private prog = [0, 5, 3, 4];

  private noteFreq(degree: number, oct = 0) {
    const s = this.scale;
    const d = ((degree % 7) + 7) % 7;
    const octShift = Math.floor(degree / 7) + oct;
    return this.root * Math.pow(2, (s[d] + 12 * octShift) / 12);
  }

  private scheduleStep(step: number, t: number) {
    const bar = Math.floor(step / 16);
    const s16 = step % 16;
    const phase = Math.floor(step / 64) % 4; // секции: интро → разгон → дроп → фулл
    const chordDeg = this.prog[Math.floor(bar / 2) % this.prog.length];

    // пэды — каждые 2 такта
    if (s16 === 0 && bar % 2 === 0) {
      const dur = this.stepDur * 32;
      pad(
        t,
        [0, 2, 4, 7].map((o) => this.noteFreq(chordDeg + o, 2)),
        dur
      );
    }
    if (phase === 0) {
      if (this.hatPat[s16]) hat(t, this.hatPat[s16] * 0.6);
      const b = this.bassPat[s16];
      if (b >= 0 && s16 % 4 === 0) bassNote(t, this.noteFreq(chordDeg + b, 0), this.stepDur * 3, 0.8);
      return;
    }
    if (this.kickPat[s16]) kick(t, this.kickPat[s16]);
    if (this.snarePat[s16]) snare(t, this.snarePat[s16]);
    if (this.hatPat[s16]) hat(t, this.hatPat[s16], phase === 3 && s16 === 14);
    const b = this.bassPat[s16];
    if (b >= 0) bassNote(t, this.noteFreq(chordDeg + b, 0), this.stepDur * 2.2);
    if (phase >= 2 && s16 % 2 === 0) {
      const a = this.arpPat[(s16 / 2) % 8];
      if (a >= 0) pluck(t, this.noteFreq(chordDeg + a, 3), 0.9);
    }
  }

  private tick = () => {
    if (!ctx || !this.playing) return;
    const horizon = ctx.currentTime + 0.18;
    while (this.t0 + this.nextStep * this.stepDur < horizon && this.nextStep < this.totalSteps) {
      this.scheduleStep(this.nextStep, this.t0 + this.nextStep * this.stepDur);
      this.nextStep++;
    }
    if (this.nextStep >= this.totalSteps && ctx.currentTime > this.t0 + this.totalSteps * this.stepDur + 0.1) {
      this.clearTimer();
      this.playing = false;
      this.pausedAt = 0;
      this.onEnded?.();
    }
  };

  private clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  start(offset: number) {
    const c = ensure();
    void c.resume();
    this.playing = true;
    this.pausedAt = 0;
    this.t0 = c.currentTime + 0.08 - offset;
    this.nextStep = Math.max(0, Math.ceil(offset / this.stepDur));
    this.clearTimer();
    this.timer = setInterval(this.tick, 30);
    this.tick();
  }

  pause() {
    if (!this.playing) return;
    this.pausedAt = this.getPos();
    this.playing = false;
    this.clearTimer();
    ctx?.suspend();
  }

  stop() {
    this.playing = false;
    this.pausedAt = 0;
    this.clearTimer();
    ctx?.suspend();
  }

  seek(sec: number) {
    const target = Math.min(Math.max(0, sec), this.totalSteps * this.stepDur - 0.1);
    if (this.playing) {
      this.start(target);
    } else {
      this.pausedAt = target;
    }
  }

  getPos() {
    if (this.playing && ctx) {
      return Math.min(this.totalSteps * this.stepDur, Math.max(0, ctx.currentTime - this.t0));
    }
    return this.pausedAt;
  }

  setVolume(v: number) {
    setMasterVolume(v);
  }
}

/* ---------- file playback ---------- */
export class FileSource implements Source {
  onEnded: (() => void) | null = null;
  /** Сеть/декодирование не удались — плеер переключится на резервный звук. */
  onError: (() => void) | null = null;
  private el: HTMLAudioElement;

  constructor(url: string) {
    this.el = new Audio();
    this.el.src = url;
    this.el.preload = "auto";
    this.el.addEventListener("ended", () => this.onEnded?.());
    this.el.addEventListener("error", () => {
      // MEDIA_ERR: 1=прервано, 2=сеть, 3=декодирование, 4=источник не поддерживается/недоступен
      console.warn(`[TimurSounds] аудиоэлемент не смог открыть ${url} (код ${this.el.error?.code ?? "?"})`);
      this.onError?.();
    });
  }

  start(offset: number) {
    const el = this.el;
    const go = () => {
      // currentTime можно трогать только после загрузки метаданных,
      // иначе браузер бросает InvalidStateError
      try {
        if (offset > 0 && el.readyState >= 1 && Number.isFinite(el.duration)) el.currentTime = offset;
      } catch {
        /* not seekable yet */
      }
      void el.play().catch(() => undefined);
    };
    if (el.readyState >= 1) {
      go();
    } else {
      el.addEventListener("loadedmetadata", go, { once: true });
      void el.play().catch(() => undefined); // запускает загрузку, go() довершит после метаданных
    }
  }
  pause() {
    this.el.pause();
  }
  stop() {
    this.el.pause();
    try {
      if (this.el.readyState >= 1) this.el.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
  seek(sec: number) {
    try {
      if (this.el.readyState >= 1) this.el.currentTime = sec;
    } catch {
      /* not seekable yet */
    }
  }
  getPos() {
    return this.el.currentTime || 0;
  }
  setVolume(v: number) {
    this.el.volume = v;
  }
  get duration() {
    return this.el.duration;
  }
}
