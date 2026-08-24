import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ARTISTS } from "../lib/data";
import { PlayerBar } from "./PlayerBar";

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="14" fill="#1f5bff" />
        <rect x="12" y="26" width="6" height="12" rx="3" fill="#f2f5ff" />
        <rect x="22" y="16" width="6" height="32" rx="3" fill="#f2f5ff" />
        <rect x="32" y="22" width="6" height="20" rx="3" fill="#05060a" />
        <rect x="42" y="10" width="6" height="44" rx="3" fill="#f2f5ff" />
      </svg>
      <div className="leading-none">
        <div className="font-display font-black text-[15px] tracking-tight">TIMUR<span className="text-blue">SOUNDS</span></div>
        <div className="text-[9px] tracking-[0.32em] text-sky mt-1">STREAMING LABEL</div>
      </div>
    </div>
  );
}

const navCls = ({ isActive }: { isActive: boolean }) =>
  `group flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all relative
  ${isActive ? "bg-blue/12 text-paper" : "text-paper/55 hover:text-paper hover:bg-white/[0.04] hover:translate-x-1"}`;

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 text-[13px] font-semibold px-3.5 py-1.5 rounded-full border transition-all
  ${isActive ? "bg-blue border-blue text-paper" : "border-line text-paper/55 hover:text-paper hover:border-linehi"}`;

function Icon({ name }: { name: string }) {
  const p = { width: 17, height: 17, viewBox: "0 0 17 17", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home":
      return (<svg {...p} aria-hidden><path d="M2.5 7.5 8.5 2l6 5.5V15h-4.4v-4H6.9v4H2.5V7.5z" /></svg>);
    case "disc":
      return (<svg {...p} aria-hidden><circle cx="8.5" cy="8.5" r="6.3" /><circle cx="8.5" cy="8.5" r="1.6" /><path d="M8.5 2.2a6.3 6.3 0 0 1 6.3 6.3" stroke="#1f5bff" /></svg>);
    case "wave":
      return (<svg {...p} aria-hidden><path d="M2 8.5h2l1.6-4 2.4 8 2-6 1.4 3.5L13 8.5h2" /></svg>);
    case "mic":
      return (<svg {...p} aria-hidden><rect x="6.3" y="2" width="4.4" height="8" rx="2.2" /><path d="M3.8 8.2a4.7 4.7 0 0 0 9.4 0M8.5 12.9v2.4" /></svg>);
    case "lock":
      return (<svg {...p} aria-hidden><rect x="3.5" y="7.5" width="10" height="7" rx="1.6" /><path d="M5.8 7.5V5.6a2.7 2.7 0 0 1 5.4 0v1.9" /></svg>);
    default:
      return null;
  }
}

export function Shell() {
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);

  return (
    <div className="min-h-screen bg-ink text-paper">
      {/* desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-[84px] w-64 flex-col border-r border-line bg-coal/70 z-40">
        <div className="px-6 py-6 border-b border-line">
          <NavLink to="/"><Logo /></NavLink>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-7">
          <div>
            <div className="px-3.5 text-[10px] tracking-[0.3em] text-paper/30 font-semibold mb-2">МЕНЮ</div>
            <div className="space-y-1">
              <NavLink to="/" end className={navCls}><Icon name="home" />Главная</NavLink>
              <NavLink to="/music" className={navCls}><Icon name="disc" />Музыка</NavLink>
              <NavLink to="/tracks" className={navCls}><Icon name="wave" />Треки</NavLink>
            </div>
          </div>
          <div>
            <div className="px-3.5 text-[10px] tracking-[0.3em] text-paper/30 font-semibold mb-2">АРТИСТЫ</div>
            <div className="space-y-1">
              <NavLink to="/artist/timur" className={navCls}>
                <span className="w-4.5 h-4.5 rounded bg-blue text-paper font-display font-black text-[10px] flex items-center justify-center">T</span>
                {ARTISTS.timur.name}
                <span className="ml-auto text-[9px] tracking-widest text-sky/70 border border-line rounded px-1 py-px">ЛЕЙБЛ</span>
              </NavLink>
              <NavLink to="/artist/instasamka" className={navCls}>
                <span className="w-4.5 h-4.5 rounded bg-paper text-ink font-display font-black text-[8px] flex items-center justify-center">IS</span>
                {ARTISTS.instasamka.name}
              </NavLink>
            </div>
          </div>
          <div>
            <div className="px-3.5 text-[10px] tracking-[0.3em] text-paper/30 font-semibold mb-2">УПРАВЛЕНИЕ</div>
            <NavLink to="/admin" className={navCls}><Icon name="lock" />Админ-панель</NavLink>
          </div>
        </nav>
        <div className="px-6 py-5 border-t border-line text-[11px] text-paper/30 leading-relaxed">
          © 2026 TimurSounds<br />лейбл · стриминг · сообщество
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 bg-ink/92 backdrop-blur border-b border-line">
        <div className="px-4 py-3 flex items-center justify-between">
          <NavLink to="/"><Logo /></NavLink>
          <NavLink to="/admin" className="text-paper/50 hover:text-paper transition-colors" aria-label="Админ-панель">
            <Icon name="lock" />
          </NavLink>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-3 no-scrollbar">
          <NavLink to="/" end className={linkCls}>Главная</NavLink>
          <NavLink to="/music" className={linkCls}>Музыка</NavLink>
          <NavLink to="/tracks" className={linkCls}>Треки</NavLink>
          <NavLink to="/artist/timur" className={linkCls}>TIMUR</NavLink>
          <NavLink to="/artist/instasamka" className={linkCls}>INSTASAMKA</NavLink>
        </nav>
      </header>

      <main className="lg:pl-64 pb-32 lg:pb-28">
        <Outlet />
      </main>

      <PlayerBar />
    </div>
  );
}
