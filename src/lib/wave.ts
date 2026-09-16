import { useEffect, useRef } from "react";
import { mulberry32 } from "./audio";

/* Живая волна площадки: рисует на canvas, амплитуда зависит от воспроизведения. */
export function useWave(active: boolean) {
  const ref = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    let raf = 0;
    let t = 0;
    const rng = mulberry32(777);
    const phases = Array.from({ length: 90 }, () => rng() * Math.PI * 2);
    const speeds = Array.from({ length: 90 }, () => 0.6 + rng() * 1.8);
    let amp = 0.25;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const { clientWidth, clientHeight } = canvas;
      if (canvas.width !== clientWidth * dpr) {
        canvas.width = clientWidth * dpr;
        canvas.height = clientHeight * dpr;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);
      const target = activeRef.current ? 1 : 0.22;
      amp += (target - amp) * 0.045;
      t += activeRef.current ? 0.055 : 0.018;

      const n = phases.length;
      const gap = w / (n - 1);
      const mid = h / 2;
      for (let i = 0; i < n; i++) {
        const env = Math.sin((i / (n - 1)) * Math.PI);
        const v = Math.sin(t * speeds[i] + phases[i]) * env * amp;
        const bh = Math.max(2, Math.abs(v) * h * 0.46);
        const x = i * gap;
        ctx2d.fillStyle = i % 7 === 0 ? "#4d7dff" : i % 3 === 0 ? "#8fb0ff" : "rgba(242,245,255,0.5)";
        ctx2d.fillRect(x - 1.2, mid - bh / 2, 2.4, bh);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return ref;
}
