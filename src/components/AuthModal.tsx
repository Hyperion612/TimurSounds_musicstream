import { useState } from "react";
import type { FormEvent } from "react";
import { useStore } from "../lib/store";

const inputCls =
  "w-full bg-ink border border-line focus:border-blue outline-none rounded-lg px-4 py-3 text-sm placeholder:text-paper/30 transition-colors";

export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { userLogin, userRegister } = useStore();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [nick, setNick] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    const res = tab === "login" ? await userLogin(email, pw) : await userRegister(email, nick, pw);
    setBusy(false);
    if (res) setErr(res);
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/85 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md border border-line rounded-2xl bg-coal p-7 md:p-8 overflow-hidden">
        <div className="absolute inset-0 bg-scan opacity-40 pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-blue/25 blur-[80px] pointer-events-none" />
        <div className="relative">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-black text-xl uppercase tracking-tight">
              {tab === "login" ? "Вход" : "Регистрация"}
            </h2>
            <button onClick={onClose} className="text-paper/40 hover:text-paper transition-colors p-1" aria-label="Закрыть">
              <svg width="18" height="18" viewBox="0 0 18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m4 4 10 10M14 4 4 14" /></svg>
            </button>
          </div>

          <div className="flex gap-2 mb-5">
            {(["login", "register"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setErr("");
                }}
                className={`flex-1 font-display text-[11px] font-bold tracking-wider py-2.5 rounded-lg border transition-all ${
                  tab === t ? "bg-blue border-blue text-paper" : "border-line text-paper/50 hover:text-paper"
                }`}
              >
                {t === "login" ? "ВОЙТИ" : "СОЗДАТЬ АККАУНТ"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Почта" required className={inputCls} autoFocus />
            {tab === "register" && (
              <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Ник (видно всем)" required className={inputCls} />
            )}
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Пароль" required className={inputCls} />
            {err && <div className="text-xs text-sky border border-blue/40 bg-blue/10 rounded-lg px-3 py-2">{err}</div>}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-blue hover:bg-bluehi disabled:opacity-50 text-paper font-display font-bold text-xs tracking-wider py-3.5 rounded-lg transition-all hover:-translate-y-0.5 active:scale-[0.98]"
            >
              {busy ? "ОДНУ СЕКУНДУ…" : tab === "login" ? "ВОЙТИ НА ПЛОЩАДКУ" : "ЗАРЕГИСТРИРОВАТЬСЯ"}
            </button>
          </form>

          <p className="mt-4 text-[11px] text-paper/35 leading-relaxed">
            Аккаунт синхронизирует избранное между всеми вашими устройствами, когда подключена облачная синхронизация.
          </p>
        </div>
      </div>
    </div>
  );
}
