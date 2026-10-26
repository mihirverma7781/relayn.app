import { useState } from "react";
import { Bookmark, Plus, Play, Trash2, X } from "lucide-react";
import { formatTime, type Bookmark as BookmarkType } from "../player";
import { useDialog } from "./useDialog";

interface BookmarksModalProps {
  filePath: string;
  currentTimeMs: number;
  bookmarks: BookmarkType[];
  onAddBookmark: (timeMs: number, label: string) => void;
  onDeleteBookmark: (id: string) => void;
  onSeek: (timeMs: number) => void;
  onClose: () => void;
}

export default function BookmarksModal({
  currentTimeMs,
  bookmarks,
  onAddBookmark,
  onDeleteBookmark,
  onSeek,
  onClose,
}: BookmarksModalProps) {
  const dialogRef = useDialog(onClose);
  const [newLabel, setNewLabel] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newLabel.trim() || `Bookmark at ${formatTime(currentTimeMs)}`;
    onAddBookmark(currentTimeMs, label);
    setNewLabel("");
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="bookmarks-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Media Bookmarks"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <div className="dialog-title-group">
            <Bookmark size={18} className="dialog-icon" />
            <h3>Media Bookmarks</h3>
          </div>
          <button
            className="icon-button small"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="dialog-content">
          <form onSubmit={handleAdd} className="add-bookmark-form">
            <input
              type="text"
              className="bookmark-input"
              aria-label="Bookmark label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={`Label (e.g. "Solo start", "Key scene")`}
            />
            <button type="submit" className="button primary small">
              <Plus size={14} /> Add at {formatTime(currentTimeMs)}
            </button>
          </form>

          <div className="bookmarks-list">
            {bookmarks.length === 0 ? (
              <div className="empty-bookmarks">
                <Bookmark size={32} strokeWidth={1} />
                <p>No bookmarks saved for this media yet.</p>
                <span>
                  Add one above to easily jump back to important moments.
                </span>
              </div>
            ) : (
              bookmarks.map((b) => (
                <div key={b.id} className="bookmark-item">
                  <button
                    className="bookmark-seek"
                    onClick={() => {
                      onSeek(b.time);
                      onClose();
                    }}
                    aria-label={`Go to ${b.label} at ${formatTime(b.time)}`}
                  >
                    <div className="bookmark-time-badge mono">
                      <Play size={10} fill="currentColor" />{" "}
                      {formatTime(b.time)}
                    </div>
                    <span className="bookmark-label">{b.label}</span>
                  </button>
                  <button
                    className="icon-button small delete-btn"
                    title="Delete bookmark"
                    aria-label={`Delete bookmark ${b.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteBookmark(b.id);
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
