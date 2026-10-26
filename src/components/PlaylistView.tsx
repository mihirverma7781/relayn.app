import {
  useState,
  useMemo,
  useRef,
  useEffect,
  type KeyboardEvent,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  FileVideo,
  FileAudio,
  FolderOpen,
  Play,
  Pause,
  Repeat,
  Repeat1,
  Search,
  Shuffle,
  Trash2,
  Tv,
  X,
} from "lucide-react";
import { type Item } from "../player";
import { extension, mediaKind, mediaTitle } from "../media";
import type { PlayerController } from "../usePlayer";

interface PlaylistViewProps {
  player: PlayerController;
  onClose: () => void;
  shuffle: boolean;
  onToggleShuffle: () => void;
}

export default function PlaylistView({
  player,
  onClose,
  shuffle,
  onToggleShuffle,
}: PlaylistViewProps) {
  const {
    state: { playback: p, settings: s },
    call,
    open,
  } = player;
  const current = s.playlist.find((item) => item.id === s.current);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(s.current);
  const rows = useRef(new Map<number, HTMLTableRowElement>());
  const queuePositions = useMemo(
    () => new Map(s.playlist.map((item, index) => [item.id, index + 1])),
    [s.playlist],
  );
  const filteredPlaylist = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return q
      ? s.playlist.filter((item) =>
          `${item.name}\n${item.path}`.toLocaleLowerCase().includes(q),
        )
      : s.playlist;
  }, [s.playlist, search]);
  const selected = filteredPlaylist.find((item) => item.id === selectedId);
  const selectedIndex = s.playlist.findIndex(
    (item) => item.id === selected?.id,
  );
  const repeatLabel =
    s.repeat === "off" ? "Off" : s.repeat === "all" ? "All" : "One";
  useEffect(() => {
    if (!filteredPlaylist.some((item) => item.id === selectedId))
      setSelectedId(filteredPlaylist[0]?.id ?? null);
  }, [filteredPlaylist, selectedId]);

  const playItem = async (item: Item) => {
    if (await call("play", undefined, undefined, item.id)) onClose();
  };
  const focusItem = (item?: Item) => {
    if (item) {
      setSelectedId(item.id);
      rows.current.get(item.id)?.focus();
    }
  };
  const removeItem = async (item: Item) => {
    const index = filteredPlaylist.findIndex(
      (candidate) => candidate.id === item.id,
    );
    const next = filteredPlaylist[index + 1] ?? filteredPlaylist[index - 1];
    if (await call("remove", undefined, undefined, item.id)) focusItem(next);
  };
  const moveSelected = async (direction: "move_up" | "move_down") => {
    if (selected && (await call(direction, undefined, undefined, selected.id)))
      rows.current.get(selected.id)?.focus();
  };
  const handleRowKey = (
    event: KeyboardEvent<HTMLTableRowElement>,
    item: Item,
  ) => {
    if (event.target !== event.currentTarget) return;
    const index = filteredPlaylist.findIndex(
      (candidate) => candidate.id === item.id,
    );
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
        "Enter",
        "Delete",
        "Backspace",
      ].includes(event.key)
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (event.altKey && event.key === "ArrowUp") void moveSelected("move_up");
    else if (event.altKey && event.key === "ArrowDown")
      void moveSelected("move_down");
    else if (event.key === "ArrowUp")
      focusItem(filteredPlaylist[Math.max(0, index - 1)]);
    else if (event.key === "ArrowDown")
      focusItem(
        filteredPlaylist[Math.min(filteredPlaylist.length - 1, index + 1)],
      );
    else if (event.key === "Home") focusItem(filteredPlaylist[0]);
    else if (event.key === "End") focusItem(filteredPlaylist.at(-1));
    else if (event.key === "Enter") void playItem(item);
    else if (event.key === "Delete" || event.key === "Backspace")
      void removeItem(item);
  };

  return (
    <section className="vlc-playlist-view" aria-label="Playlist">
      <div className="playlist-toolbar">
        <div className="playlist-title-area">
          <div className="toolbar-search-box">
            <Search size={14} className="search-icon" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search playlist"
              placeholder="Search playlist…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="toolbar-search-input"
            />
            {search && (
              <button
                className="clear-search-btn"
                aria-label="Clear playlist search"
                onClick={() => setSearch("")}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
        <div
          className="playlist-actions-group"
          role="group"
          aria-label="Playlist actions"
        >
          <button
            className="vlc-toolbar-btn primary"
            onClick={() => void open(false)}
            title="Add files to playlist"
          >
            <FolderOpen size={14} /> Add files
          </button>
          <button
            className="vlc-toolbar-btn"
            disabled={!player.native}
            onClick={() => void player.openFolder(false)}
            title="Add media from a folder"
          >
            <FolderOpen size={14} /> Add folder
          </button>
          <button
            className="vlc-toolbar-btn"
            disabled={!s.playlist.length}
            onClick={player.exportList}
            title="Save playlist as M3U8"
          >
            <Download size={14} /> Save playlist
          </button>
          <button
            className={`vlc-toolbar-btn ${shuffle ? "active" : ""}`}
            aria-label="Shuffle playlist"
            aria-pressed={shuffle}
            onClick={onToggleShuffle}
            title={`Shuffle: ${shuffle ? "On" : "Off"}`}
          >
            <Shuffle size={14} />
          </button>
          <button
            className={`vlc-toolbar-btn ${s.repeat !== "off" ? "active" : ""}`}
            aria-label={`Repeat: ${repeatLabel}`}
            onClick={() =>
              void call(
                "repeat",
                undefined,
                s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off",
              )
            }
            title={`Repeat: ${repeatLabel}`}
          >
            {s.repeat === "one" ? <Repeat1 size={14} /> : <Repeat size={14} />}
          </button>
          <button
            className="vlc-toolbar-btn"
            aria-label="Move selected item up"
            disabled={!selected || selectedIndex <= 0}
            onClick={() => void moveSelected("move_up")}
            title="Move selected item up (Alt+Up)"
          >
            <ArrowUp size={14} />
          </button>
          <button
            className="vlc-toolbar-btn"
            aria-label="Move selected item down"
            disabled={!selected || selectedIndex >= s.playlist.length - 1}
            onClick={() => void moveSelected("move_down")}
            title="Move selected item down (Alt+Down)"
          >
            <ArrowDown size={14} />
          </button>
          <button
            className="vlc-toolbar-btn danger"
            onClick={() => void call("clear")}
            disabled={!s.playlist.length}
            title="Remove all items from the queue"
          >
            <Trash2 size={14} /> Clear
          </button>
          {s.current !== null && (
            <button
              className="vlc-toolbar-btn highlight"
              onClick={onClose}
              title="Return to player (Ctrl/Cmd+L)"
            >
              <Tv size={14} /> Player
            </button>
          )}
        </div>
      </div>
      <div className="playlist-table-container">
        {!filteredPlaylist.length ? (
          <div className="playlist-empty-state">
            <h3>
              {search ? "No matching media files" : "Your playlist is empty"}
            </h3>
            <p>
              {search
                ? `No files match “${search}”. Try another name or path.`
                : "Drop audio or video files here, or add files from your computer."}
            </p>
            {search ? (
              <button className="vlc-toolbar-btn" onClick={() => setSearch("")}>
                Clear search
              </button>
            ) : (
              <button
                className="vlc-toolbar-btn primary large"
                onClick={() => void open(false)}
              >
                <FolderOpen size={16} /> Add files
              </button>
            )}
          </div>
        ) : (
          <table className="playlist-table" aria-label="Queued media">
            <thead>
              <tr>
                <th scope="col" className="col-idx">
                  #
                </th>
                <th scope="col" className="col-title">
                  Title
                </th>
                <th scope="col" className="col-ext">
                  Format
                </th>
                <th scope="col" className="col-path">
                  Path
                </th>
                <th scope="col" className="col-actions">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPlaylist.map((item) => {
                const isCurrent = item.id === s.current;
                const playing = isCurrent && p.state === "playing";
                const selected = item.id === selectedId;
                return (
                  <tr
                    key={item.id}
                    ref={(node) => {
                      if (node) rows.current.set(item.id, node);
                      else rows.current.delete(item.id);
                    }}
                    className={`playlist-row ${isCurrent ? "is-playing" : ""} ${selected ? "is-selected" : ""}`}
                    tabIndex={selected ? 0 : -1}
                    aria-selected={selected}
                    aria-current={isCurrent ? "true" : undefined}
                    onClick={() => focusItem(item)}
                    onFocus={() => setSelectedId(item.id)}
                    onDoubleClick={(event) => {
                      if (!(event.target as Element).closest("button"))
                        void playItem(item);
                    }}
                    onKeyDown={(event) => handleRowKey(event, item)}
                  >
                    <td className="col-idx mono">
                      {isCurrent ? (
                        <span
                          className="row-play-indicator"
                          aria-label={p.state}
                        >
                          {playing ? <Play size={12} /> : <Pause size={12} />}
                        </span>
                      ) : (
                        queuePositions.get(item.id)
                      )}
                    </td>
                    <td className="col-title">
                      <div className="item-title-box">
                        {mediaKind(item.name) === "audio" ? (
                          <FileAudio size={15} className="item-icon audio" />
                        ) : (
                          <FileVideo size={15} className="item-icon video" />
                        )}
                        <strong className="item-name" title={item.name}>
                          {mediaTitle(item.name)}
                        </strong>
                      </div>
                    </td>
                    <td className="col-ext">
                      <span className="mono ext-tag">
                        {extension(item.name).toUpperCase() || "—"}
                      </span>
                    </td>
                    <td className="col-path">
                      <span className="path-text" title={item.path}>
                        {item.path}
                      </span>
                    </td>
                    <td className="col-actions">
                      <div className="row-action-btns">
                        <button
                          className="row-btn play"
                          aria-label={`${playing ? "Pause" : "Play"} ${item.name}`}
                          title={playing ? "Pause" : "Play"}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(item.id);
                            if (
                              isCurrent &&
                              ["playing", "paused"].includes(p.state)
                            )
                              void call("toggle");
                            else void playItem(item);
                          }}
                        >
                          {playing ? <Pause size={13} /> : <Play size={13} />}
                        </button>
                        <button
                          className="row-btn delete"
                          aria-label={`Remove ${item.name} from playlist`}
                          title="Remove from playlist"
                          onClick={(event) => {
                            event.stopPropagation();
                            void removeItem(item);
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="playlist-footer-summary">
        <span className="mono">
          {search ? `${filteredPlaylist.length} of ` : ""}
          {s.playlist.length} item{s.playlist.length === 1 ? "" : "s"} in queue
        </span>
        <span
          className="mono now-playing-sub"
          title={selected?.path || current?.path}
        >
          {selected
            ? `Selected: ${selected.name}`
            : current
              ? `Now playing: ${mediaTitle(p.title || current.name)}`
              : "Double-click or press Enter to play"}
        </span>
      </div>
    </section>
  );
}
