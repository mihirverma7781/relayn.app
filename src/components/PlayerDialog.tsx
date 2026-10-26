import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useDialog } from "./useDialog";

export default function PlayerDialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useDialog(close);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        className="dialog-window classic-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="dialog-header">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label={`Close ${title}`}
            onClick={close}
          >
            <X size={16} />
          </button>
        </div>
        <div className="dialog-content">{children}</div>
      </div>
    </div>
  );
}
