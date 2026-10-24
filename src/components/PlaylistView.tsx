import {useState, useMemo} from 'react';
import {
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
  X
} from 'lucide-react';
import {type Item} from '../player';
import {extension, mediaKind, mediaTitle} from '../media';
import type {PlayerController} from '../usePlayer';

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
  onToggleShuffle
}: PlaylistViewProps) {
  const {state: {playback: p, settings: s}, call, open} = player;
  const current = s.playlist.find(i => i.id === s.current);
  const [search, setSearch] = useState('');

  const filteredPlaylist = useMemo(() => {
    if (!search.trim()) return s.playlist;
    const q = search.toLowerCase();
    return s.playlist.filter(i =>
      i.name.toLowerCase().includes(q) || i.path.toLowerCase().includes(q)
    );
  }, [s.playlist, search]);

  const handlePlayItem = (item: Item) => {
    void call('play', undefined, undefined, item.id);
    onClose(); // Automatically switch to video view
  };

  return (
    <div className="vlc-playlist-view">
      {/* ================= PLAYLIST HEADER ================= */}
      <div className="playlist-toolbar">
        <div className="playlist-title-area">
          <div className="toolbar-search-box">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search playlist..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="toolbar-search-input"
            />
            {search && (
              <button className="clear-search-btn" onClick={() => setSearch('')}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="playlist-actions-group">
          {/* Add media */}
          <button
            className="vlc-toolbar-btn primary"
            onClick={() => void open(false)}
            title="Add media files to playlist (⌘⇧O)"
          >
            <FolderOpen size={14} /> Add Files
          </button>

          {/* Shuffle Toggle */}
          <button
            className={`vlc-toolbar-btn ${shuffle ? 'active' : ''}`}
            onClick={onToggleShuffle}
            title={`Shuffle: ${shuffle ? 'On' : 'Off'}`}
          >
            <Shuffle size={14} />
          </button>

          {/* Repeat Toggle */}
          <button
            className={`vlc-toolbar-btn ${s.repeat !== 'off' ? 'active' : ''}`}
            onClick={() => call('repeat', undefined, s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off')}
            title={`Repeat mode: ${s.repeat}`}
          >
            {s.repeat === 'one' ? <Repeat1 size={14} /> : <Repeat size={14} />}
          </button>

          {/* Clear Playlist */}
          <button
            className="vlc-toolbar-btn danger"
            onClick={() => call('clear')}
            disabled={!s.playlist.length}
            title="Clear all items from playlist"
          >
            <Trash2 size={14} /> Clear
          </button>

          {/* Return to Video Stage Button */}
          {s.current !== null && (
            <button
              className="vlc-toolbar-btn highlight"
              onClick={onClose}
              title="Return to Video Player (⌘L)"
            >
              <Tv size={14} /> Video Player
            </button>
          )}
        </div>
      </div>

      {/* ================= PLAYLIST TABLE ================= */}
      <div className="playlist-table-container">
        {filteredPlaylist.length === 0 ? (
          <div className="playlist-empty-state">
            <div className="empty-halo" />
            <h3>{search ? 'No matching media files' : 'Your Playlist is Empty'}</h3>
            <p>
              {search
                ? `No files matching "${search}" found in playlist.`
                : 'Drag and drop video or audio files here, or click Add Files.'}
            </p>
            <button className="vlc-toolbar-btn primary large" onClick={() => void open(true)}>
              <FolderOpen size={16} /> Open Media Files
            </button>
          </div>
        ) : (
          <table className="playlist-table">
            <thead>
              <tr>
                <th className="col-idx">#</th>
                <th className="col-title">Title</th>
                <th className="col-ext">Format</th>
                <th className="col-path">Path</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlaylist.map((item, idx) => {
                const isCurrent = item.id === s.current;
                const isItemAudio = mediaKind(item.name) === 'audio';

                return (
                  <tr
                    key={item.id}
                    className={`playlist-row ${isCurrent ? 'is-playing' : ''}`}
                    onDoubleClick={() => handlePlayItem(item)}
                  >
                    <td className="col-idx mono">
                      {isCurrent ? (
                        <div className="row-play-indicator">
                          {p.state === 'playing' ? (
                            <span className="wave-icon" title="Playing" />
                          ) : (
                            <Pause size={12} />
                          )}
                        </div>
                      ) : (
                        idx + 1
                      )}
                    </td>

                    <td className="col-title">
                      <div className="item-title-box">
                        {isItemAudio ? (
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
                        {extension(item.name).toUpperCase()}
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
                          title={isCurrent && p.state === 'playing' ? 'Pause' : 'Play'}
                          onClick={() => {
                            if (isCurrent) {
                              void call('toggle');
                            } else {
                              handlePlayItem(item);
                            }
                          }}
                        >
                          {isCurrent && p.state === 'playing' ? <Pause size={13} /> : <Play size={13} />}
                        </button>

                        <button
                          className="row-btn delete"
                          title="Remove from playlist"
                          onClick={e => {
                            e.stopPropagation();
                            void call('remove', undefined, undefined, item.id);
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

      {/* ================= BOTTOM FOOTER ================= */}
      <div className="playlist-footer-summary">
        <span className="mono">
          {s.playlist.length} item{s.playlist.length === 1 ? '' : 's'} in queue
        </span>
        {current && (
          <span className="mono now-playing-sub">
            Now Playing: {mediaTitle(p.title || current.name)}
          </span>
        )}
      </div>
    </div>
  );
}
