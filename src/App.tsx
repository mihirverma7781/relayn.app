import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { FolderOpen, X } from "lucide-react";
import brandSymbol from "../assets/brand/relayn-symbol-sage.svg";
import {
  formatTime,
  initialVideoAdjustments,
  EQUALIZER_PRESETS,
  type Bookmark,
  type VideoAdjustments,
} from "./player";
import { mediaKind, mediaTitle } from "./media";
import {
  useNativeSurface,
  usePlayer,
  usePlayerKeys,
  webObjectUrls,
} from "./usePlayer";
import Transport from "./components/Transport";
import PlaylistView from "./components/PlaylistView";
import EffectsModal from "./components/EffectsModal";
import JumpModal from "./components/JumpModal";
import BookmarksModal from "./components/BookmarksModal";
import HudToast from "./components/HudToast";
import PlayerDialog from "./components/PlayerDialog";
import PlayerMenu from "./components/PlayerMenu";
import "./player-shell.css";

type Panel =
  | "settings"
  | "info"
  | "effects"
  | "jump"
  | "bookmarks"
  | "about"
  | "network"
  | null;
export default function App() {
  const player = usePlayer();
  const { state, call, open, fullscreen } = player;
  const { playback: p, settings: s } = state;
  const current = s.playlist.find((item) => item.id === s.current);
  const audio = !!current && mediaKind(current.name) === "audio";
  const [view, setView] = useState<"video" | "playlist">("video");
  const [panel, setPanel] = useState<Panel>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [hud, setHud] = useState<string | null>(null);
  const [network, setNetwork] = useState("");
  const [equalizerPreset, setEqualizerPreset] = useState("custom");
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [bookmarks, setBookmarks] = useState<Record<string, Bookmark[]>>(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem("relayn_bookmarks") || "{}",
      );
      return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
    } catch {
      return {};
    }
  });
  const videoRef = useNativeSurface(
    player,
    view === "video" && !audio && !!current,
    !!panel || menuOpen || popoverOpen || player.dragging,
  );
  const webVideo = useRef<HTMLVideoElement>(null);
  const close = useCallback(() => setPanel(null), []);
  const toggleView = useCallback(
    () => setView((v) => (v === "video" ? "playlist" : "video")),
    [],
  );
  const loopA = state.loop_a ?? null,
    loopB = state.loop_b ?? null;
  const adjustments = s.video_adjustments || initialVideoAdjustments;
  const eq = s.equalizer || {
    enabled: false,
    bands: EQUALIZER_PRESETS.flat.bands,
    preamp: 0,
  };
  const crop = s.crop || "none";
  const delay = p.audio_delay ?? 0,
    subDelay = p.subtitle_delay ?? 0;
  const currentBookmarks = useMemo(() => {
    const entries = current ? bookmarks[current.path] : [];
    return Array.isArray(entries)
      ? entries.filter(
          (b) =>
            b &&
            typeof b.id === "string" &&
            typeof b.label === "string" &&
            Number.isFinite(b.time) &&
            b.time >= 0,
        )
      : [];
  }, [bookmarks, current]);
  useEffect(() => {
    if (!player.native && webVideo.current)
      player.setWebVideoRef(webVideo.current);
  }, [player.native, player.setWebVideoRef, current?.id]);
  useEffect(() => {
    if (!player.native) return;
    let disposed = false;
    let stop: (() => void) | undefined;
    void listen("video-double-click", () => void fullscreen())
      .then((unlisten) => {
        if (disposed) unlisten();
        else stop = unlisten;
      })
      .catch(player.report);
    return () => {
      disposed = true;
      stop?.();
    };
  }, [player.native, fullscreen, player.report]);
  useEffect(() => {
    if (!player.native) return;
    void getCurrentWindow()
      .setTitle(
        current
          ? `${mediaTitle(p.title || current.name)} — RelayN Player`
          : "RelayN Player",
      )
      .catch(player.report);
  }, [current?.name, p.title, player.native, player.report]);
  const perform = useCallback(
    async (kind: string, value?: number, text?: string) => {
      return await call(kind, value, text);
    },
    [call],
  );
  const snapshot = useCallback(async () => {
    await perform("snapshot");
  }, [perform]);
  const setCrop = useCallback(
    (value: string) => {
      void perform("crop", undefined, value);
    },
    [perform],
  );
  const setAudioDelay = useCallback(
    (value: number) => {
      void perform("audio_delay", value);
    },
    [perform],
  );
  const setSubtitleDelay = useCallback(
    (value: number) => {
      void perform("subtitle_delay", value);
    },
    [perform],
  );
  const setVideoAdjustments: React.Dispatch<
    React.SetStateAction<VideoAdjustments>
  > = (value) => {
    const next = typeof value === "function" ? value(adjustments) : value;
    void perform("video_adjustments", undefined, JSON.stringify(next));
  };
  const setBands = (bands: number[]) => {
    void perform(
      "equalizer",
      undefined,
      JSON.stringify({ ...eq, enabled: true, bands }),
    );
  };
  const openFolder = useCallback(async () => {
    if (!player.native) {
      player.report("Open Folder is available in the desktop application.");
      return;
    }
    try {
      await invoke("open_folder", { replace: true });
    } catch (error) {
      player.report(error);
    }
  }, [player.native, player.report]);
  const setTop = async () => {
    if (!player.native) return;
    try {
      const next = !alwaysOnTop;
      await getCurrentWindow().setAlwaysOnTop(next);
      setAlwaysOnTop(next);
    } catch (error) {
      player.report(error);
    }
  };
  const custom = useCallback(
    (command: string) => {
      switch (command) {
        case "close_dialog":
          close();
          return true;
        case "quit":
          if (player.native)
            void getCurrentWindow().close().catch(player.report);
          return true;
        case "preferences":
        case "toggle_settings":
          setPanel("settings");
          return true;
        case "media_info":
          setPanel("info");
          return true;
        case "open_folder":
          void openFolder();
          return true;
        case "open_network":
          setPanel("network");
          return true;
        case "save_playlist":
          void player.exportList();
          return true;
        case "toggle_ab_loop":
          void perform("ab_loop");
          return true;
        case "step_frame":
          void perform("step_frame");
          return true;
        case "snapshot":
          void snapshot();
          return true;
        case "jump_to_time":
          setPanel("jump");
          return true;
        case "toggle_bookmarks":
          setPanel("bookmarks");
          return true;
        case "toggle_effects":
          setPanel("effects");
          return true;
        case "audio_delay_down":
          setAudioDelay(delay - 50);
          return true;
        case "audio_delay_up":
          setAudioDelay(delay + 50);
          return true;
        case "subtitle_delay_down":
          setSubtitleDelay(subDelay - 50);
          return true;
        case "subtitle_delay_up":
          setSubtitleDelay(subDelay + 50);
          return true;
        case "cycle_crop": {
          const values = ["none", "16:9", "4:3", "2.35:1"];
          setCrop(values[(values.indexOf(crop) + 1) % values.length]);
          return true;
        }
        default:
          return false;
      }
    },
    [
      close,
      openFolder,
      perform,
      snapshot,
      delay,
      subDelay,
      crop,
      setCrop,
      setAudioDelay,
      setSubtitleDelay,
      player.exportList,
    ],
  );
  usePlayerKeys(player, () => {}, toggleView, custom);
  const item = (
    label: string,
    action: () => void,
    shortcut?: string,
    disabled = false,
    checked?: boolean,
  ) => ({ label, action, shortcut, disabled, checked });
  const separator = { label: "", separator: true };
  const menus = [
    {
      label: "Media",
      items: [
        item("Open File…", () => void open(true), "Ctrl+O"),
        item("Open Multiple Files…", () => void open(false), "Ctrl+Shift+O"),
        item("Open Folder…", () => void openFolder(), "Ctrl+F", !player.native),
        item(
          "Open Network Stream…",
          () => setPanel("network"),
          "Ctrl+N",
          !player.native,
        ),
        separator,
        item(
          "Save Playlist to File…",
          () => void player.exportList(),
          "Ctrl+Y",
          !s.playlist.length,
        ),
        separator,
        item(
          "Quit",
          () => {
            if (player.native)
              void getCurrentWindow().close().catch(player.report);
          },
          "Ctrl+Q",
          !player.native,
        ),
      ],
    },
    {
      label: "Playback",
      items: [
        item(
          p.state === "playing" ? "Pause" : "Play",
          () => {
            if (current) void call("toggle");
            else void open(true);
          },
          "Space",
        ),
        item("Stop", () => void call("stop"), "S", !current),
        item("Previous", () => void call("previous"), "P", !s.playlist.length),
        item("Next", () => void call("next"), "N", !s.playlist.length),
        separator,
        item(
          "Previous Chapter",
          () => void call("previous_chapter"),
          undefined,
          !p.chapter_count,
        ),
        item(
          "Next Chapter",
          () => void call("next_chapter"),
          undefined,
          !p.chapter_count,
        ),
        ...Array.from({ length: p.chapter_count || 0 }, (_, index) =>
          item(
            `Chapter ${index + 1}`,
            () => void call("chapter", index),
            undefined,
            false,
            p.chapter === index,
          ),
        ),
        separator,
        item("Jump to Time…", () => setPanel("jump"), "Ctrl+T", !p.seekable),
        item(
          "Next Frame",
          () => void perform("step_frame"),
          "E",
          !current || audio,
        ),
        separator,
        ...[0.5, 0.75, 1, 1.25, 1.5, 2, 4].map((rate) =>
          item(
            `Speed ${rate}×`,
            () => void call("rate", rate),
            undefined,
            false,
            s.rate === rate,
          ),
        ),
        separator,
        item(
          "Random",
          () => void perform("shuffle", s.shuffle ? 0 : 1),
          undefined,
          false,
          !!s.shuffle,
        ),
        item(
          "Repeat All",
          () =>
            void call("repeat", undefined, s.repeat === "all" ? "off" : "all"),
          undefined,
          false,
          s.repeat === "all",
        ),
        item(
          "Repeat One",
          () =>
            void call("repeat", undefined, s.repeat === "one" ? "off" : "one"),
          undefined,
          false,
          s.repeat === "one",
        ),
        item(
          loopA === null
            ? "Set A–B start"
            : loopB === null
              ? "Set A–B end"
              : "Clear A–B loop",
          () => void perform("ab_loop"),
          "L",
          !p.seekable,
        ),
      ],
    },
    {
      label: "Audio",
      items: [
        item("Mute", () => void call("mute"), "M", false, s.muted),
        item(
          "Increase Volume",
          () => void call("volume", Math.min(150, s.volume + 5)),
          "Ctrl+↑",
        ),
        item(
          "Decrease Volume",
          () => void call("volume", Math.max(0, s.volume - 5)),
          "Ctrl+↓",
        ),
        separator,
        ...p.audio_tracks.map((track) =>
          item(
            track.name,
            () => void call("audio", track.id),
            undefined,
            !current,
            p.audio_track === track.id,
          ),
        ),
        separator,
        ...[
          [1, "Stereo"],
          [2, "Reverse stereo"],
          [3, "Left channel"],
          [4, "Right channel"],
          [5, "Dolby Surround"],
        ].map(([value, label]) =>
          item(
            String(label),
            () => void call("audio_channel", Number(value)),
            undefined,
            !current,
            p.audio_channel === value,
          ),
        ),
        separator,
        item(
          "Audio Effects & Synchronization…",
          () => setPanel("effects"),
          "Ctrl+E",
        ),
      ],
    },
    {
      label: "Video",
      items: [
        item("Fullscreen", () => void fullscreen(), "F", !player.native),
        item(
          "Always on Top",
          () => void setTop(),
          undefined,
          !player.native,
          alwaysOnTop,
        ),
        separator,
        ...["", "16:9", "16:10", "4:3", "1:1", "2.35:1", "21:9"].map((ratio) =>
          item(
            ratio ? `Aspect Ratio ${ratio}` : "Default Aspect Ratio",
            () => void call("aspect", undefined, ratio),
            undefined,
            false,
            s.aspect === ratio,
          ),
        ),
        separator,
        ...["none", "16:9", "4:3", "2.35:1"].map((ratio) =>
          item(
            ratio === "none" ? "No Crop" : `Crop ${ratio}`,
            () => setCrop(ratio),
            undefined,
            false,
            crop === ratio,
          ),
        ),
        separator,
        item(
          "Take Snapshot…",
          () => void snapshot(),
          "Shift+S",
          !current || audio,
        ),
      ],
    },
    {
      label: "Subtitle",
      items: [
        item(
          "Add Subtitle File…",
          () => void player.subtitles(),
          undefined,
          !current,
        ),
        separator,
        item(
          "Disable",
          () => void call("subtitle", -1),
          undefined,
          !current,
          p.subtitle_track === -1,
        ),
        ...p.subtitle_tracks
          .filter((t) => t.id >= 0)
          .map((track) =>
            item(
              track.name,
              () => void call("subtitle", track.id),
              undefined,
              !current,
              p.subtitle_track === track.id,
            ),
          ),
        separator,
        item("Track Synchronization…", () => setPanel("effects")),
      ],
    },
    {
      label: "Tools",
      items: [
        item("Effects and Filters…", () => setPanel("effects"), "Ctrl+E"),
        item("Media Information…", () => setPanel("info"), "Ctrl+I", !current),
        item("Bookmarks…", () => setPanel("bookmarks"), "Ctrl+B", !current),
        separator,
        item("Preferences…", () => setPanel("settings"), "Ctrl+P"),
      ],
    },
    {
      label: "View",
      items: [
        item("Playlist", toggleView, "Ctrl+L", false, view === "playlist"),
        item(
          "Advanced Controls",
          () => setAdvanced((v) => !v),
          undefined,
          false,
          advanced,
        ),
      ],
    },
    {
      label: "Help",
      items: [
        item("Keyboard Shortcuts…", () => setPanel("settings")),
        item("About RelayN Player", () => setPanel("about")),
      ],
    },
  ];
  const saveBookmarks = (entries: Bookmark[]) => {
    if (!current) return;
    const updated = { ...bookmarks, [current.path]: entries };
    try {
      localStorage.setItem("relayn_bookmarks", JSON.stringify(updated));
      setBookmarks(updated);
    } catch (error) {
      player.report(error);
    }
  };
  return (
    <div
      className={`vlc-app-shell classic-player ${advanced ? "advanced-controls" : ""}`}
    >
      <PlayerMenu menus={menus} onOpenChange={setMenuOpen} />
      {player.error && (
        <div className="player-error" role="alert">
          <span>{player.error}</span>
          <button aria-label="Dismiss error" onClick={player.dismiss}>
            <X size={16} />
          </button>
        </div>
      )}
      <main className="vlc-main-stage">
        <HudToast message={hud} onClear={() => setHud(null)} />
        {view === "playlist" ? (
          <PlaylistView
            player={player}
            onClose={() => setView("video")}
            shuffle={!!s.shuffle}
            onToggleShuffle={() => void perform("shuffle", s.shuffle ? 0 : 1)}
          />
        ) : !current ? (
          <div className="classic-empty">
            <img src={brandSymbol} width="120" height="120" alt="RelayN" />
            <button
              className="button secondary"
              onClick={() => void open(true)}
            >
              <FolderOpen size={16} />
              Open media…
            </button>
            <p>Drop files here to play</p>
          </div>
        ) : audio ? (
          <div className="classic-audio">
            <img src={brandSymbol} width="96" height="96" alt="" />
            <h1>{mediaTitle(p.title || current.name)}</h1>
            {p.artist && <p>{p.artist}</p>}
            {p.album && <p>{p.album}</p>}
          </div>
        ) : (
          <div
            className="vlc-video-stage"
            onDoubleClick={() => void fullscreen()}
          >
            <div ref={videoRef} className="native-video-box">
              {!player.native && (
                <video
                  ref={webVideo}
                  className="html-video-element"
                  src={webObjectUrls.get(current.id) || current.path}
                  playsInline
                  onClick={() => void call("toggle")}
                />
              )}
            </div>
          </div>
        )}
        {player.dragging && (
          <div className="classic-drop" role="status">
            Drop files to add to the playlist
          </div>
        )}
      </main>
      <div className="vlc-dock-wrapper visible">
        <Transport
          player={player}
          viewMode={view}
          onToggleViewMode={toggleView}
          loopA={loopA}
          loopB={loopB}
          onToggleAbLoop={() => void perform("ab_loop")}
          onOpenEffects={() => setPanel("effects")}
          onOpenBookmarks={() => setPanel("bookmarks")}
          onOpenJump={() => setPanel("jump")}
          onSnapshot={() => void snapshot()}
          onStepFrame={() => void perform("step_frame")}
          shuffle={!!s.shuffle}
          onToggleShuffle={() => void perform("shuffle", s.shuffle ? 0 : 1)}
          cropRatio={crop}
          onSetCropRatio={setCrop}
          audioDelay={delay}
          onAudioDelayChange={setAudioDelay}
          subDelay={subDelay}
          onSubDelayChange={setSubtitleDelay}
          onPopoverChange={setPopoverOpen}
        />
      </div>
      <div className="classic-status">
        <span>
          {!player.native
            ? "Browser preview"
            : state.runtime === "Unavailable"
              ? "Playback engine unavailable"
              : `libVLC ${state.runtime}`}
        </span>
        <span>
          {current
            ? `${p.state} · ${mediaTitle(current.name)}`
            : "No media loaded"}
        </span>
        <span>
          {s.playlist.length} items · {s.volume}%
        </span>
      </div>
      {panel === "effects" && (
        <EffectsModal
          player={player}
          adjustments={adjustments}
          setAdjustments={setVideoAdjustments}
          audioDelay={delay}
          setAudioDelay={setAudioDelay}
          subDelay={subDelay}
          setSubDelay={setSubtitleDelay}
          equalizerBands={eq.bands}
          setEqualizerBands={setBands}
          equalizerPreset={equalizerPreset}
          setEqualizerPreset={setEqualizerPreset}
          onClose={close}
        />
      )}
      {panel === "jump" && (
        <JumpModal
          currentTimeMs={p.time}
          durationMs={p.duration}
          onJump={(time) => void call("seek", time)}
          onClose={close}
        />
      )}
      {panel === "bookmarks" && current && (
        <BookmarksModal
          filePath={current.path}
          currentTimeMs={p.time}
          bookmarks={currentBookmarks}
          onAddBookmark={(time, label) =>
            saveBookmarks([
              ...currentBookmarks,
              { id: crypto.randomUUID(), time, label },
            ])
          }
          onDeleteBookmark={(id) =>
            saveBookmarks(currentBookmarks.filter((b) => b.id !== id))
          }
          onSeek={(time) => void call("seek", time)}
          onClose={close}
        />
      )}
      {panel === "info" && (
        <PlayerDialog title="Media Information" close={close}>
          <dl className="classic-info">
            {[
              ["Location", current?.path || "No media"],
              ["Title", p.title || current?.name || "—"],
              ["Artist", p.artist || "—"],
              ["Album", p.album || "—"],
              ["Duration", p.duration ? formatTime(p.duration) : "Unknown"],
              [
                "Audio tracks",
                p.audio_tracks
                  .filter((t) => t.id >= 0)
                  .map((t) => t.name)
                  .join(", ") || "None",
              ],
              [
                "Subtitle tracks",
                p.subtitle_tracks
                  .filter((t) => t.id >= 0)
                  .map((t) => t.name)
                  .join(", ") || "None",
              ],
              ["Runtime", state.runtime],
            ].map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </PlayerDialog>
      )}
      {panel === "settings" && (
        <PlayerDialog title="Preferences" close={close}>
          <div className="classic-preferences">
            <label>
              Volume{" "}
              <input
                type="range"
                min="0"
                max="150"
                value={s.volume}
                onChange={(e) => void call("volume", Number(e.target.value))}
              />
              <output>{s.volume}%</output>
            </label>
            <label>
              Playback speed{" "}
              <select
                value={s.rate}
                onChange={(e) => void call("rate", Number(e.target.value))}
              >
                {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map((r) => (
                  <option key={r} value={r}>
                    {r}×
                  </option>
                ))}
              </select>
            </label>
            <label>
              Repeat{" "}
              <select
                value={s.repeat}
                onChange={(e) => void call("repeat", undefined, e.target.value)}
              >
                <option value="off">Off</option>
                <option value="all">All</option>
                <option value="one">One</option>
              </select>
            </label>
          </div>
          <p className="preferences-note">
            Playback settings and the playlist are saved on this computer.
            Restoring a session does not start playback automatically.
          </p>
          <h3>Keyboard shortcuts</h3>
          <div className="classic-shortcuts">
            {[
              ["Open / add files", "Ctrl+O / Ctrl+Shift+O"],
              ["Open folder / network", "Ctrl+F / Ctrl+N"],
              ["Play / pause / stop", "Space / S"],
              ["Next / previous", "N / P"],
              ["Short / medium / long seek", "Shift / Alt / Ctrl + ← →"],
              ["Volume / mute", "Ctrl+↑ ↓ / M"],
              ["Playlist / effects / preferences", "Ctrl+L / Ctrl+E / Ctrl+P"],
              ["Jump to time / bookmarks", "Ctrl+T / Ctrl+B"],
              ["Next frame / snapshot", "E / Shift+S"],
              ["Audio / subtitle delay", "J K / G H"],
              ["Fullscreen / leave", "F / Esc"],
            ].map(([name, key]) => (
              <div key={name}>
                <span>{name}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </div>
        </PlayerDialog>
      )}
      {panel === "about" && (
        <PlayerDialog title="About RelayN Player" close={close}>
          <div className="classic-about">
            <img src={brandSymbol} width="72" height="72" alt="RelayN" />
            <h2>RelayN Player 0.1.0</h2>
            <p>Your media. In motion.</p>
            <p>
              Powered by libVLC {state.runtime}. A native media player for
              Windows and macOS.
            </p>
            <p>
              Development build. VLC-compatible core workflows are being
              implemented and tested. RelayN uses its own identity and is not
              affiliated with VideoLAN.
            </p>
          </div>
        </PlayerDialog>
      )}
      {panel === "network" && (
        <PlayerDialog title="Open Network Stream" close={close}>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await invoke("open_network", { url: network, replace: true });
                close();
              } catch (error) {
                player.report(error);
              }
            }}
          >
            <label className="network-label">
              Network URL
              <input
                autoFocus
                value={network}
                onChange={(event) => setNetwork(event.target.value)}
                placeholder="https://example.com/media.mp4"
                required
              />
            </label>
            <p className="preferences-note">
              Open a stream you trust. The address is contacted only when you
              choose Play. HTTP, HTTPS and RTSP are supported. Embedded
              usernames and passwords are rejected; addresses, including query
              strings, are saved in the playlist.
            </p>
            <div className="dialog-footer-actions">
              <button
                type="button"
                className="button secondary"
                onClick={close}
              >
                Cancel
              </button>
              <button type="submit" className="button primary">
                Play
              </button>
            </div>
          </form>
        </PlayerDialog>
      )}
    </div>
  );
}
