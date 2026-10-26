import { useEffect, useRef } from "react";

/** Shared native-dialog behavior: focus containment, Escape and focus restoration. */
export function useDialog(close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    if (!root) return;
    const focusable = () =>
      [
        ...root.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length > 0);
    (
      root.querySelector<HTMLElement>("[autofocus]") ||
      focusable()[0] ||
      root
    ).focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key === "Tab") {
        const elements = focusable();
        if (!elements.length) {
          event.preventDefault();
          return;
        }
        const first = elements[0],
          last = elements[elements.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !root.contains(document.activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !root.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    root.addEventListener("keydown", handle);
    return () => {
      root.removeEventListener("keydown", handle);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return ref;
}
