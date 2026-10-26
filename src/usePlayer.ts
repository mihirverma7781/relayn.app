import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  initial,
  nextTrack,
  shortcut,
  seekDelta,
  type Item,
  type Snapshot,
} from "./player";
import { mediaKind } from "./media";

let webAudio: HTMLAudioElement | null = null;
let webVideoEl: HTMLVideoElement | null = null;
export const webObjectUrls = new Map<number, string>();

export function usePlayer() {
  const [state, setState] = useState<Snapshot>(initial);
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const [seeking, setSeeking] = useState<number | null>(null);
  const [webVideoVersion, setWebVideoVersion] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const native = isTauri();

  const report = useCallback((error: unknown) => setMessage(String(error)), []);

  const getActiveWebMedia = useCallback((): HTMLMediaElement | null => {
    const curSnap = stateRef.current;
    const item = curSnap.settings.playlist.find(
      (i) => i.id === curSnap.settings.current,
    );
    if (!item) return webVideoEl || webAudio;
    return mediaKind(item.name) === "video"
      ? webVideoEl || webAudio
      : webAudio || webVideoEl;
  }, []);

  const playWebItem = useCallback(
    (item: Item) => {
      const isVideo = mediaKind(item.name) === "video";
      const url = webObjectUrls.get(item.id) || item.path;

      // Stop previous
      if (webAudio && webAudio !== webVideoEl) {
        webAudio.pause();
      }
      if (webVideoEl) {
        webVideoEl.pause();
      }

      const media: HTMLMediaElement =
        isVideo && webVideoEl ? webVideoEl : (webAudio ||= new Audio());
      media.src = url;
      media.volume = stateRef.current.settings.muted
        ? 0
        : stateRef.current.settings.volume / 100;
      media.playbackRate = stateRef.current.settings.rate;
      setState((prev) => ({
        ...prev,
        settings: { ...prev.settings, current: item.id },
        playback: {
          ...prev.playback,
          state: "opening",
          title: item.name,
          artist: "",
          album: "",
        },
      }));
      media
        .play()
        .then(() =>
          setState((prev) =>
            prev.settings.current === item.id
              ? { ...prev, playback: { ...prev.playback, state: "playing" } }
              : prev,
          ),
        )
        .catch((error) => {
          report(error);
          setState((prev) =>
            prev.settings.current === item.id
              ? { ...prev, playback: { ...prev.playback, state: "error" } }
              : prev,
          );
        });
    },
    [report],
  );

  const call = useCallback(
    async (
      kind: string,
      value?: number,
      text?: string,
      id?: number,
    ): Promise<boolean> => {
      if (native) {
        try {
          await invoke("action", { action: { kind, value, text, id } });
          setMessage("");
          return true;
        } catch (e) {
          report(e);
          return false;
        }
      }

      // Web preview mode fallback:
      const curSnap = stateRef.current;
      const playlist = curSnap.settings.playlist;
      const media = getActiveWebMedia();

      if (kind === "play") {
        const target =
          playlist.find((i) => i.id === (id ?? curSnap.settings.current)) ||
          playlist[0];
        if (target) playWebItem(target);
      } else if (kind === "toggle") {
        if (!media || !media.src) {
          const target =
            playlist.find((i) => i.id === curSnap.settings.current) ||
            playlist[0];
          if (target) playWebItem(target);
        } else if (media.paused) {
          media.play().catch(report);
          setState((p) => ({
            ...p,
            playback: { ...p.playback, state: "playing" },
          }));
        } else {
          media.pause();
          setState((p) => ({
            ...p,
            playback: { ...p.playback, state: "paused" },
          }));
        }
      } else if (kind === "stop") {
        if (media) {
          media.pause();
          media.currentTime = 0;
        }
        setState((p) => ({
          ...p,
          playback: { ...p.playback, state: "stopped", time: 0 },
        }));
      } else if (kind === "seek") {
        const ms = value ?? 0;
        if (media) media.currentTime = ms / 1000;
        setState((p) => ({ ...p, playback: { ...p.playback, time: ms } }));
      } else if (kind === "volume") {
        const vol = Math.max(0, Math.min(100, value ?? 80));
        if (media && !curSnap.settings.muted) media.volume = vol / 100;
        setState((p) => ({ ...p, settings: { ...p.settings, volume: vol } }));
      } else if (kind === "mute") {
        const nextMute = !curSnap.settings.muted;
        if (media) media.volume = nextMute ? 0 : curSnap.settings.volume / 100;
        setState((p) => ({
          ...p,
          settings: { ...p.settings, muted: nextMute },
        }));
      } else if (kind === "rate") {
        const r = value ?? 1;
        if (media) media.playbackRate = r;
        setState((p) => ({ ...p, settings: { ...p.settings, rate: r } }));
      } else if (kind === "next" || kind === "previous") {
        if (!playlist.length) return false;
        const curIdx = playlist.findIndex(
          (i) => i.id === curSnap.settings.current,
        );
        const nextIdx =
          kind === "next"
            ? (curIdx + 1) % playlist.length
            : (curIdx - 1 + playlist.length) % playlist.length;
        playWebItem(playlist[nextIdx]);
      } else if (kind === "repeat") {
        const r = (text as "off" | "all" | "one") || "off";
        if (media) media.loop = r === "one";
        setState((p) => ({ ...p, settings: { ...p.settings, repeat: r } }));
      } else if (kind === "aspect") {
        setState((p) => ({
          ...p,
          settings: { ...p.settings, aspect: text || "" },
        }));
      } else if (kind === "remove" && id !== undefined) {
        if (curSnap.settings.current === id && media) {
          media.pause();
          media.src = "";
        }
        const url = webObjectUrls.get(id);
        if (url) URL.revokeObjectURL(url);
        webObjectUrls.delete(id);
        const nextList = playlist.filter((i) => i.id !== id);
        const nextCurrent =
          curSnap.settings.current === id ? null : curSnap.settings.current;
        setState((p) => ({
          ...p,
          settings: { ...p.settings, playlist: nextList, current: nextCurrent },
        }));
      } else if (kind === "move_up" && id !== undefined) {
        const idx = playlist.findIndex((i) => i.id === id);
        if (idx > 0) {
          const next = [...playlist];
          const temp = next[idx - 1];
          next[idx - 1] = next[idx];
          next[idx] = temp;
          setState((p) => ({
            ...p,
            settings: { ...p.settings, playlist: next },
          }));
        }
      } else if (kind === "move_down" && id !== undefined) {
        const idx = playlist.findIndex((i) => i.id === id);
        if (idx >= 0 && idx < playlist.length - 1) {
          const next = [...playlist];
          const temp = next[idx + 1];
          next[idx + 1] = next[idx];
          next[idx] = temp;
          setState((p) => ({
            ...p,
            settings: { ...p.settings, playlist: next },
          }));
        }
      } else if (kind === "clear") {
        if (media) {
          media.pause();
          media.src = "";
        }
        webObjectUrls.forEach((url) => URL.revokeObjectURL(url));
        webObjectUrls.clear();
        setState((p) => ({
          ...p,
          settings: { ...p.settings, playlist: [], current: null },
          playback: { ...initial.playback },
        }));
      } else {
        report(
          "This operation requires the native RelayN desktop application.",
        );
        return false;
      }
      return true;
    },
    [native, report, playWebItem, getActiveWebMedia],
  );

  const handleFilesSelected = useCallback(
    (fileList: FileList, replace = false) => {
      const files = Array.from(fileList);
      if (!files.length) return;
      if (replace) {
        webObjectUrls.forEach((url) => URL.revokeObjectURL(url));
        webObjectUrls.clear();
      }
      let nextId =
        Math.max(0, ...stateRef.current.settings.playlist.map((i) => i.id)) + 1;
      const newItems: Item[] = files.map((f) => {
        const id = nextId++;
        const url = URL.createObjectURL(f);
        webObjectUrls.set(id, url);
        return { id, path: f.name, name: f.name };
      });
      setState((p) => ({
        ...p,
        settings: {
          ...p.settings,
          playlist: replace ? newItems : [...p.settings.playlist, ...newItems],
          current:
            replace || !p.settings.current
              ? newItems[0].id
              : p.settings.current,
        },
      }));
      if (replace || !stateRef.current.settings.current) {
        playWebItem(newItems[0]);
      }
    },
    [playWebItem],
  );

  const open = useCallback(
    async (replace = true) => {
      if (native) {
        try {
          setMessage("");
          const paths = await invoke<string[]>("pick_files", {
            subtitle: false,
          });
          if (paths.length) await invoke("open_paths", { paths, replace });
        } catch (e) {
          report(e);
        }
        return;
      }
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = "audio/*,video/*";
      input.onchange = () => {
        if (input.files?.length) handleFilesSelected(input.files, replace);
      };
      input.click();
    },
    [native, handleFilesSelected, report],
  );

  const openFolder = useCallback(
    async (replace = true) => {
      if (!native) {
        report("Opening folders requires the native desktop application.");
        return false;
      }
      try {
        await invoke("open_folder", { replace });
        setMessage("");
        return true;
      } catch (error) {
        report(error);
        return false;
      }
    },
    [native, report],
  );

  const fullscreen = useCallback(
    async (exit = false) => {
      if (native) {
        try {
          const w = getCurrentWindow();
          await w.setFullscreen(exit ? false : !(await w.isFullscreen()));
        } catch (e) {
          report(e);
        }
        return;
      }
      if (exit) {
        if (document.fullscreenElement) void document.exitFullscreen();
      } else {
        if (!document.fullscreenElement)
          void document.documentElement.requestFullscreen();
        else void document.exitFullscreen();
      }
    },
    [native],
  );

  const subtitles = useCallback(async () => {
    if (native) {
      try {
        const paths = await invoke<string[]>("pick_files", { subtitle: true });
        if (paths[0]) await invoke("load_subtitle", { path: paths[0] });
      } catch (e) {
        report(e);
      }
      return;
    }
    report(
      "External subtitle loading requires the native desktop application.",
    );
  }, [native, report]);

  useEffect(() => {
    if (native) {
      let disposed = false;
      const stops: Array<() => void> = [];
      const keep = (f: () => void) => (disposed ? f() : stops.push(f));
      let eventReceived = false;
      listen<Snapshot>("player-state", (e) => {
        if (!disposed) {
          eventReceived = true;
          setState(e.payload);
        }
      })
        .then((unlisten) => {
          keep(unlisten);
          if (disposed) return;
          return invoke<Snapshot>("get_state").then((v) => {
            if (!disposed && !eventReceived) setState(v);
          });
        })
        .catch((error) => {
          if (!disposed) report(error);
        });
      getCurrentWindow()
        .onDragDropEvent(async (event) => {
          if (event.payload.type === "over" || event.payload.type === "enter")
            setDragging(true);
          else setDragging(false);
          if (event.payload.type === "drop") {
            try {
              setMessage("");
              await invoke("open_paths", {
                paths: event.payload.paths,
                replace: false,
              });
            } catch (e) {
              report(e);
            }
          }
        })
        .then(keep)
        .catch(report);
      return () => {
        disposed = true;
        stops.forEach((f) => f());
      };
    }

    // Web mode initialization & listeners
    setState((p) => ({ ...p, runtime: "Web Preview Mode" }));
    if (!webAudio) webAudio = new Audio();

    const bindMediaEvents = (media: HTMLMediaElement) => {
      const onTimeUpdate = () => {
        setState((p) => ({
          ...p,
          playback: {
            ...p.playback,
            time: Math.floor(media.currentTime * 1000),
            duration: Math.floor((media.duration || 0) * 1000),
            seekable: Number.isFinite(media.duration) && media.duration > 0,
          },
        }));
      };
      const onEnded = () => {
        const curSnap = stateRef.current;
        const list = curSnap.settings.playlist;
        const idx = list.findIndex((i) => i.id === curSnap.settings.current);
        if (curSnap.settings.repeat === "one") {
          media.currentTime = 0;
          media.play().catch(report);
        } else if (idx >= 0 && idx < list.length - 1) {
          playWebItem(list[idx + 1]);
        } else if (curSnap.settings.repeat === "all" && list[0]) {
          playWebItem(list[0]);
        } else {
          setState((p) => ({
            ...p,
            playback: { ...p.playback, state: "stopped", time: 0 },
          }));
        }
      };
      const onError = () => {
        report(
          "The browser preview could not decode this file. Try it in the native desktop application.",
        );
        setState((p) => ({
          ...p,
          playback: { ...p.playback, state: "error" },
        }));
      };
      const onPlay = () =>
        setState((p) => ({
          ...p,
          playback: { ...p.playback, state: "playing" },
        }));
      const onPause = () =>
        setState((p) => ({
          ...p,
          playback: { ...p.playback, state: media.ended ? "ended" : "paused" },
        }));
      media.addEventListener("timeupdate", onTimeUpdate);
      media.addEventListener("ended", onEnded);
      media.addEventListener("error", onError);
      media.addEventListener("playing", onPlay);
      media.addEventListener("pause", onPause);
      return () => {
        media.removeEventListener("timeupdate", onTimeUpdate);
        media.removeEventListener("ended", onEnded);
        media.removeEventListener("error", onError);
        media.removeEventListener("playing", onPlay);
        media.removeEventListener("pause", onPause);
      };
    };

    const unbindAudio = bindMediaEvents(webAudio);
    let unbindVideo = () => {};
    if (webVideoEl) unbindVideo = bindMediaEvents(webVideoEl);

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      setDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer?.files.length) {
        handleFilesSelected(e.dataTransfer.files, false);
      }
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    return () => {
      unbindAudio();
      unbindVideo();
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [native, report, handleFilesSelected, playWebItem, webVideoVersion]);

  const setWebVideoRef = useCallback((el: HTMLVideoElement | null) => {
    if (webVideoEl === el) return;
    webVideoEl = el;
    setWebVideoVersion((v) => v + 1);
  }, []);

  const dismiss = () => {
    setMessage("");
    if (native) void call("dismiss_error");
  };

  const exportList = () => {
    if (native) {
      invoke("export_playlist").catch(report);
      return;
    }
    const items = stateRef.current.settings.playlist;
    if (!items.length) return;
    const content =
      "#EXTM3U\n" +
      items.map((i) => `#EXTINF:-1,${i.name}\n${i.path}`).join("\n") +
      "\n";
    const blob = new Blob([content], { type: "audio/x-mpegurl" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relayn-collection.m3u";
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    state,
    stateRef,
    native,
    call,
    open,
    openFolder,
    fullscreen,
    subtitles,
    dragging,
    seeking,
    setSeeking,
    error: message || state.error,
    dismiss,
    exportList,
    report,
    setWebVideoRef,
  };
}

export type PlayerController = ReturnType<typeof usePlayer>;

export function useNativeSurface(
  player: PlayerController,
  active = true,
  covered = false,
) {
  const ref = useRef<HTMLDivElement>(null);
  const placement = useRef<{
    running: boolean;
    next: Record<string, number | boolean> | null;
  }>({ running: false, next: null });
  const { native, stateRef, report } = player;
  const current = player.state.settings.current;

  const enqueue = useCallback(
    (rect: Record<string, number | boolean>) => {
      const queue = placement.current;
      queue.next = rect;
      if (queue.running) return;
      queue.running = true;
      void (async () => {
        try {
          while (queue.next) {
            const next = queue.next;
            queue.next = null;
            await invoke("place_video", { rect: next });
          }
        } catch (error) {
          report(error);
        } finally {
          queue.running = false;
        }
      })();
    },
    [report],
  );
  const place = useCallback(() => {
    if (!native) return;
    const rect = ref.current?.getBoundingClientRect();
    const snap = stateRef.current;
    const item = snap.settings.playlist.find(
      (i) => i.id === snap.settings.current,
    );
    const bounds = ref.current?.closest("main")?.getBoundingClientRect();
    // Native child drawables are not clipped by CSS overflow. Hide rather than
    // painting over the window controls when their viewport has scrolled away.
    const fits =
      !!rect &&
      rect.left >= 0 &&
      rect.top >= 0 &&
      rect.right <= window.innerWidth + 1 &&
      rect.bottom <= window.innerHeight + 1 &&
      (!bounds ||
        (rect.top >= bounds.top - 1 &&
          rect.bottom <= bounds.bottom + 1 &&
          rect.left >= bounds.left - 1 &&
          rect.right <= bounds.right + 1));
    const visible =
      fits &&
      !!item &&
      mediaKind(item.name) !== "audio" &&
      active &&
      !covered &&
      rect!.width > 0 &&
      rect!.height > 0;
    enqueue({
      x: Math.round(rect?.x || 0),
      y: Math.round(rect?.y || 0),
      width: Math.round(rect?.width || 1),
      height: Math.round(rect?.height || 1),
      visible,
    });
  }, [native, stateRef, active, covered, enqueue]);

  useEffect(() => {
    const observer = new ResizeObserver(place);
    if (ref.current) observer.observe(ref.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("fullscreenchange", place);
    place();
    const t = setTimeout(place, 80);
    return () => {
      clearTimeout(t);
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("fullscreenchange", place);
      if (native) enqueue({ x: 0, y: 0, width: 1, height: 1, visible: false });
    };
  }, [place, current, native, enqueue]);

  return ref;
}

export function usePlayerKeys(
  player: PlayerController,
  _onFullscreen: () => void,
  onToggleQueue: () => void,
  onAction?: (cmd: string) => boolean | void,
) {
  const { stateRef, call, open, fullscreen } = player;
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (document.querySelector('[aria-modal="true"],.modal-backdrop')) {
        if (event.key === "Escape") {
          event.preventDefault();
          onAction?.("close_dialog");
        }
        return;
      }
      if (
        event.target instanceof Element &&
        (!!event.target.closest(
          'input,select,textarea,[contenteditable="true"]',
        ) ||
          (!!event.target.closest("button,a") &&
            [" ", "Enter"].includes(event.key)))
      )
        return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void open(!event.shiftKey);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
        event.preventDefault();
        onToggleQueue();
        return;
      }

      const cmd = shortcut(
        event.key,
        event.ctrlKey || event.metaKey,
        event.shiftKey,
        event.altKey,
      );
      if (!cmd) return;
      if (
        event.repeat &&
        [
          "toggle",
          "stop",
          "next",
          "previous",
          "fullscreen",
          "exit_fullscreen",
          "snapshot",
          "toggle_ab_loop",
        ].includes(cmd)
      )
        return;
      event.preventDefault();

      if (onAction && onAction(cmd)) {
        return;
      }

      const { playback: p, settings: s } = stateRef.current;
      if (cmd === "open" || cmd === "append") void open(cmd === "open");
      else if (cmd === "fullscreen" || cmd === "exit_fullscreen") {
        void fullscreen(cmd === "exit_fullscreen");
      } else if (cmd.startsWith("seek_")) {
        const delta = seekDelta(cmd);
        if (p.seekable && delta !== null)
          void call(
            "seek",
            Math.max(
              0,
              p.duration > 0
                ? Math.min(p.duration, p.time + delta)
                : p.time + delta,
            ),
          );
      } else if (cmd.startsWith("volume_")) {
        void call(
          "volume",
          Math.max(0, Math.min(150, s.volume + (cmd === "volume_up" ? 5 : -5))),
        );
      } else if (cmd === "cycle_audio" || cmd === "cycle_subtitle") {
        const audio = cmd === "cycle_audio";
        const id = nextTrack(
          audio ? p.audio_tracks : p.subtitle_tracks,
          audio ? p.audio_track : p.subtitle_track,
        );
        if (id !== null) void call(audio ? "audio" : "subtitle", id);
      } else if (cmd === "cycle_aspect") {
        const options = [
          "",
          "16:9",
          "16:10",
          "4:3",
          "1:1",
          "2.35:1",
          "2.39:1",
          "21:9",
        ];
        void call(
          "aspect",
          undefined,
          options[(options.indexOf(s.aspect) + 1) % options.length],
        );
      } else if (cmd === "faster" || cmd === "slower") {
        void call(
          "rate",
          Math.max(
            0.25,
            Math.min(
              4,
              Math.round((s.rate + (cmd === "faster" ? 0.25 : -0.25)) * 100) /
                100,
            ),
          ),
        );
      } else if (cmd === "rate_normal") {
        void call("rate", 1.0);
      } else {
        void call(cmd);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stateRef, call, open, fullscreen, onToggleQueue, onAction]);
}
