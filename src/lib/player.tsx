import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Source } from "./audio";
import { FileSource, SynthSource, setMasterVolume } from "./audio";
import { getAudio } from "./db";
import type { Track } from "./data";
import { useStore } from "./store";

interface PlayerCtx {
  track: Track | null;
  queue: string[];
  qIndex: number;
  playing: boolean;
  position: number;
  volume: number;
  repeat: boolean;
  playTrack: (id: string, queue?: string[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  setVolume: (v: number) => void;
  toggleRepeat: () => void;
}

const Ctx = createContext<PlayerCtx | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const [trackId, setTrackId] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [repeat, setRepeat] = useState(false);

  const srcRef = useRef<Source | null>(null);
  const tokenRef = useRef(0);
  const queueRef = useRef<string[]>([]);
  const idxRef = useRef(0);
  const repeatRef = useRef(false);
  const volumeRef = useRef(0.8);
  const storeRef = useRef(store);
  storeRef.current = store;
  queueRef.current = queue;
  idxRef.current = qIndex;
  repeatRef.current = repeat;
  volumeRef.current = volume;

  const destroySrc = () => {
    if (srcRef.current) {
      srcRef.current.stop();
      srcRef.current.onEnded = null;
      srcRef.current = null;
    }
  };

  const startSource = useCallback(async (t: Track, offset = 0) => {
    const token = ++tokenRef.current;
    destroySrc();
    let src: Source | null = null;
    if (t.kind === "file") {
      // 1) облачное хранилище — играет на любом устройстве
      if (t.audioUrl) {
        src = new FileSource(t.audioUrl);
      } else {
        // 2) локальный IndexedDB этого устройства
        try {
          const blob = await getAudio(t.id);
          if (blob) src = new FileSource(URL.createObjectURL(blob));
        } catch {
          src = null;
        }
      }
    }
    // 3) если аудио недоступно (файл не загрузился) — генеративный звук по сиду трека
    if (!src) src = new SynthSource({ bpm: t.bpm, seed: t.seed, duration: t.duration });
    if (token !== tokenRef.current) return;

    // Резервный генеративный звук: трек обязан зазвучать, даже если файл
    // не долетел (сеть, CORS, повреждённый blob) или старт бросил исключение.
    const synthFallback = () => {
      if (tokenRef.current !== token) return;
      if (srcRef.current) {
        srcRef.current.onEnded = null;
        srcRef.current.stop();
      }
      const fs = new SynthSource({ bpm: t.bpm, seed: t.seed, duration: t.duration });
      fs.setVolume(volumeRef.current);
      fs.onEnded = () => handleEndedRef.current();
      srcRef.current = fs;
      fs.start(0);
      setPosition(0);
      setPlaying(true);
    };

    if (src instanceof FileSource) src.onError = synthFallback;
    src.setVolume(volumeRef.current);
    src.onEnded = () => handleEndedRef.current();
    srcRef.current = src;
    try {
      src.start(offset);
    } catch {
      synthFallback();
      return;
    }
    setPosition(offset);
    setPlaying(true);
  }, []);

  const handleEnded = useCallback(() => {
    if (repeatRef.current) {
      const t = trackRef.current;
      if (t) void startSource(t, 0);
      return;
    }
    const q = queueRef.current;
    const i = idxRef.current;
    if (i < q.length - 1) {
      const nid = q[i + 1];
      const nt = storeRef.current.getTrack(nid);
      if (nt) {
        setQIndex(i + 1);
        setTrackId(nid);
        storeRef.current.incPlays(nid);
        void startSource(nt, 0);
        return;
      }
    }
    destroySrc();
    setPlaying(false);
    setPosition(0);
  }, [startSource]);
  const handleEndedRef = useRef(handleEnded);
  handleEndedRef.current = handleEnded;

  const track = trackId ? store.getTrack(trackId) ?? null : null;
  const trackRef = useRef(track);
  trackRef.current = track;

  const playTrack = useCallback(
    (id: string, q?: string[]) => {
      const t = storeRef.current.getTrack(id);
      if (!t) return;
      const newQueue = q && q.length > 0 ? q : [id];
      const idx = Math.max(0, newQueue.indexOf(id));
      setQueue(newQueue);
      setQIndex(idx);
      setTrackId(id);
      storeRef.current.incPlays(id);
      void startSource(t, 0);
    },
    [startSource]
  );

  const toggle = useCallback(() => {
    const t = trackRef.current;
    const src = srcRef.current;
    if (!t) return;
    if (playing) {
      src?.pause();
      setPosition(src?.getPos() ?? 0);
      setPlaying(false);
    } else {
      if (src) {
        src.start(src.getPos());
        setPlaying(true);
      } else {
        void startSource(t, 0);
      }
    }
  }, [playing, startSource]);

  const jump = useCallback(
    (dir: 1 | -1) => {
      const q = queueRef.current;
      const i = idxRef.current;
      const ni = i + dir;
      if (ni < 0 || ni >= q.length) {
        if (dir === -1) {
          const t = trackRef.current;
          if (t && (srcRef.current?.getPos() ?? 0) < 3) return;
          if (t) {
            storeRef.current.incPlays(t.id);
            void startSource(t, 0);
          }
        }
        return;
      }
      const nt = storeRef.current.getTrack(q[ni]);
      if (!nt) return;
      setQIndex(ni);
      setTrackId(q[ni]);
      storeRef.current.incPlays(q[ni]);
      void startSource(nt, 0);
    },
    [startSource]
  );

  const seek = useCallback((sec: number) => {
    const src = srcRef.current;
    if (!src) return;
    src.seek(sec);
    setPosition(sec);
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    setMasterVolume(v);
    srcRef.current?.setVolume(v);
  }, []);

  /* опрос позиции */
  useEffect(() => {
    const iv = setInterval(() => {
      const src = srcRef.current;
      if (src && playing) setPosition(src.getPos());
    }, 250);
    return () => clearInterval(iv);
  }, [playing]);

  /* пробел — play/pause */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.code === "Space" && trackRef.current) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  useEffect(() => () => destroySrc(), []);

  const value = useMemo<PlayerCtx>(
    () => ({
      track,
      queue,
      qIndex,
      playing,
      position,
      volume,
      repeat,
      playTrack,
      toggle,
      next: () => jump(1),
      prev: () => jump(-1),
      seek,
      setVolume,
      toggleRepeat: () => setRepeat((r) => !r),
    }),
    [track, queue, qIndex, playing, position, volume, repeat, playTrack, toggle, jump, seek, setVolume]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer outside provider");
  return v;
}
