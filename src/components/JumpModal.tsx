import { useState, useEffect, useRef } from "react";
import { Clock, ArrowRight, X } from "lucide-react";
import { formatTime, parseTimeString } from "../player";
import { useDialog } from "./useDialog";

interface JumpModalProps {
  currentTimeMs: number;
  durationMs: number;
  onJump: (timeMs: number) => void;
  onClose: () => void;
}

export default function JumpModal({
  currentTimeMs,
  durationMs,
  onJump,
  onClose,
}: JumpModalProps) {
  const dialogRef = useDialog(onClose);
  const [val, setVal] = useState(formatTime(currentTimeMs));
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ms = parseTimeString(val);
    if (ms === null) {
      setError(
        "Invalid format. Use HH:MM:SS, MM:SS, or seconds (e.g. 1:45 or 90).",
      );
      return;
    }
    const clamped = Math.max(0, durationMs > 0 ? Math.min(durationMs, ms) : ms);
    onJump(clamped);
    onClose();
  };

  const quickJump = (deltaMs: number) => {
    const next = Math.max(
      0,
      durationMs > 0
        ? Math.min(durationMs, currentTimeMs + deltaMs)
        : currentTimeMs + deltaMs,
    );
    onJump(next);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="jump-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Jump to Time"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <div className="dialog-title-group">
            <Clock size={18} className="dialog-icon" />
            <h3>Jump to Time</h3>
          </div>
          <button
            className="icon-button small"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-content">
          <p className="jump-hint">
            Enter target timestamp in <code>HH:MM:SS</code>, <code>MM:SS</code>,
            or seconds:
          </p>

          <div className="jump-input-group">
            <input
              ref={inputRef}
              aria-label="Target time"
              type="text"
              className="jump-input mono"
              value={val}
              onChange={(e) => {
                setVal(e.target.value);
                setError(null);
              }}
              placeholder="00:00:00"
            />
            <button type="submit" className="button primary">
              Jump <ArrowRight size={15} />
            </button>
          </div>

          {error && <span className="jump-error">{error}</span>}

          <div className="quick-jump-chips">
            <span className="chips-label">Nudge:</span>
            <button
              type="button"
              className="chip-btn"
              onClick={() => quickJump(-60000)}
            >
              -1m
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => quickJump(-300000)}
            >
              -5m
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => quickJump(60000)}
            >
              +1m
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => quickJump(300000)}
            >
              +5m
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => quickJump(600000)}
            >
              +10m
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
