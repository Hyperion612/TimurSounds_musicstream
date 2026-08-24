import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { mulberry32 } from "../lib/audio";

/* ---------- scroll reveal ---------- */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`reveal ${on ? "on" : ""} ${className}`}>
      {children}
    </div>
  );
}

/* ---------- deterministic SVG cover ---------- */
const INK = "#0a0c14";
const BLUE = "#1f5bff";
const SKY = "#8fb0ff";
const PAPER = "#f2f5ff";

export function Cover({ seed, title, className = "" }: { seed: number; title: string; className?: string }) {
  const rng = mulberry32(seed * 104729 + 7);
  const style = Math.floor(rng() * 4);
  const letter = (title.trim()[0] || "T").toUpperCase();
  const bars = Array.from({ length: 14 }, () => 20 + rng() * 130);
  const dots = Array.from({ length: 24 }, () => ({ x: 12 + rng() * 176, y: 12 + rng() * 176, r: 1.5 + rng() * 2.5 }));

  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={`Обложка: ${title}`} preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="200" fill={INK} />
      {style === 0 && (
        <g>
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={SKY} opacity="0.5" />
          ))}
          {[78, 60, 44, 28].map((r, i) => (
            <circle key={r} cx="100" cy="100" r={r} fill="none" stroke={i % 2 ? PAPER : BLUE} strokeWidth={i === 1 ? 2 : 5} opacity={0.9 - i * 0.12} />
          ))}
          <circle cx="100" cy="100" r="12" fill={BLUE} />
          <text x="100" y="107" textAnchor="middle" fontFamily="Unbounded" fontWeight="900" fontSize="15" fill={PAPER}>
            {letter}
          </text>
        </g>
      )}
      {style === 1 && (
        <g>
          {bars.map((h, i) => (
            <rect key={i} x={8 + i * 13.4} y={100 - h / 2} width="8" height={h} rx="4" fill={i % 3 === 0 ? BLUE : i % 3 === 1 ? PAPER : SKY} opacity={i % 3 === 1 ? 0.85 : 1} />
          ))}
          <rect x="0" y="98" width="200" height="4" fill={BLUE} />
        </g>
      )}
      {style === 2 && (
        <g>
          {Array.from({ length: 7 }, (_, i) => (
            <rect key={i} x={-40 + i * 42} y="-20" width="16" height="260" fill={BLUE} opacity={i % 2 ? 0.25 : 0.9} transform="rotate(18 100 100)" />
          ))}
          <circle cx="140" cy="60" r="34" fill="none" stroke={PAPER} strokeWidth="5" />
          <text x="34" y="172" fontFamily="Unbounded" fontWeight="900" fontSize="64" fill={PAPER}>
            {letter}
          </text>
        </g>
      )}
      {style === 3 && (
        <g>
          <rect x="26" y="26" width="148" height="148" fill="none" stroke={BLUE} strokeWidth="3" />
          <rect x="44" y="44" width="112" height="112" fill={BLUE} opacity="0.16" />
          {dots.slice(0, 14).map((d, i) => (
            <rect key={i} x={d.x} y={d.y} width="4" height="4" fill={SKY} />
          ))}
          <text x="100" y="126" textAnchor="middle" fontFamily="Unbounded" fontWeight="900" fontSize="72" fill={PAPER}>
            {letter}
          </text>
          <rect x="26" y="158" width="148" height="6" fill={PAPER} />
        </g>
      )}
      <rect x="0" y="186" width="200" height="14" fill={INK} opacity="0.72" />
      <text x="10" y="197" fontFamily="Unbounded" fontWeight="700" fontSize="9" letterSpacing="2" fill={SKY}>
        TIMURSOUNDS
      </text>
    </svg>
  );
}

/* ---------- artist monogram ---------- */
export function Monogram({ seed, text, className = "" }: { seed: number; text: string; className?: string }) {
  const rng = mulberry32(seed * 31 + 5);
  const rot = Math.floor(rng() * 24) - 12;
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="200" fill={INK} />
      <g opacity="0.35">
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x="0" y={i * 20} width="200" height="2" fill={BLUE} opacity={i % 2 ? 0.7 : 0.25} />
        ))}
      </g>
      <circle cx="100" cy="100" r="82" fill="none" stroke={BLUE} strokeWidth="3" strokeDasharray="10 7" />
      <circle cx="100" cy="100" r="66" fill={BLUE} opacity="0.14" />
      <text x="100" y={text.length > 1 ? 122 : 132} textAnchor="middle" fontFamily="Unbounded" fontWeight="900" fontSize={text.length > 1 ? 66 : 108} fill={PAPER} transform={`rotate(${rot} 100 100)`}>
        {text}
      </text>
      <rect x="0" y="182" width="200" height="18" fill={BLUE} />
      <text x="100" y="195" textAnchor="middle" fontFamily="Unbounded" fontWeight="700" fontSize="9" letterSpacing="3" fill={PAPER}>
        OFFICIAL PAGE
      </text>
    </svg>
  );
}

/* ---------- equalizer ---------- */
export function Eq({ active, className = "" }: { active: boolean; className?: string }) {
  return (
    <div className={`eq ${active ? "" : "paused"} ${className}`} aria-hidden>
      <span /><span /><span /><span />
    </div>
  );
}

/* ---------- countdown ---------- */
export function Countdown({ date }: { date: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const diff = date - now;
  if (diff <= 0) {
    return <div className="font-display text-2xl md:text-4xl font-black text-blue">УЖЕ НА ПЛОЩАДКЕ</div>;
  }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff / 3600000) % 24);
  const m = Math.floor((diff / 60000) % 60);
  const s = Math.floor((diff / 1000) % 60);
  const cell = (v: number, label: string) => (
    <div className="flex flex-col items-center">
      <div className="bg-ink border border-line rounded-lg px-3 py-2 md:px-5 md:py-3 min-w-[64px] md:min-w-[92px] text-center tabular-nums">
        <span className="font-display text-3xl md:text-5xl font-black text-paper">{String(v).padStart(2, "0")}</span>
      </div>
      <span className="mt-2 text-[10px] md:text-xs tracking-[0.25em] text-sky">{label}</span>
    </div>
  );
  return (
    <div className="flex items-start gap-2 md:gap-4">
      {cell(d, "ДНИ")}
      <span className="font-display text-2xl md:text-4xl text-blue mt-3 md:mt-5">:</span>
      {cell(h, "ЧАСЫ")}
      <span className="font-display text-2xl md:text-4xl text-blue mt-3 md:mt-5">:</span>
      {cell(m, "МИН")}
      <span className="font-display text-2xl md:text-4xl text-blue mt-3 md:mt-5">:</span>
      {cell(s, "СЕК")}
    </div>
  );
}

/* ---------- marquee ---------- */
export function Marquee({ items }: { items: string[] }) {
  const row = (key: string) => (
    <div key={key} className="flex items-center shrink-0">
      {items.map((t, i) => (
        <span key={i} className="flex items-center">
          <span className="font-display text-xs md:text-sm tracking-[0.3em] text-sky whitespace-nowrap px-6">{t}</span>
          <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
            <rect width="8" height="8" fill="#1f5bff" transform="rotate(45 4 4)" />
          </svg>
        </span>
      ))}
    </div>
  );
  return (
    <div className="overflow-hidden border-y border-line bg-coal py-3 select-none">
      <div className="marquee-track">
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}

/* ---------- animated counter ---------- */
export function CountUp({ to, duration = 1300, format }: { to: number; duration?: number; format?: (n: number) => string }) {
  const [v, setV] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const step = (t: number) => {
          const p = Math.min(1, (t - t0) / duration);
          setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
          if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration]);
  return <span ref={ref} className="tabular-nums">{format ? format(v) : v.toLocaleString("ru-RU")}</span>;
}

/* ---------- section header ---------- */
export function SectionHead({ kicker, title, action }: { kicker: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-6 h-[3px] bg-blue inline-block" />
          <span className="text-[11px] tracking-[0.3em] text-sky font-semibold">{kicker}</span>
        </div>
        <h2 className="font-display text-2xl md:text-4xl font-black uppercase tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}
