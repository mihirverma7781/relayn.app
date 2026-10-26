import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import "./player-menu.css";

export interface PlayerMenuItem {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  action?: () => void;
  separator?: boolean;
}

export interface PlayerMenuGroup {
  label: string;
  items: PlayerMenuItem[];
}

interface Props {
  menus: PlayerMenuGroup[];
  onOpenChange: (open: boolean) => void;
}

const mnemonics: Record<string, string> = {
  Media: "m",
  Playback: "l",
  Audio: "a",
  Video: "v",
  Subtitle: "t",
  Tools: "s",
  View: "i",
  Help: "h",
};

/** Desktop command menus. The parent hides the native drawable while a menu is open. */
export default function PlayerMenu({ menus, onOpenChange }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [tabIndex, setTabIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const triggers = useRef<Array<HTMLButtonElement | null>>([]);
  const popup = useRef<HTMLDivElement>(null);
  const pendingEdge = useRef<"first" | "last">("first");
  const notify = useRef(onOpenChange);
  notify.current = onOpenChange;
  const id = useId();

  const close = useCallback(
    (restoreFocus: boolean) => {
      if (restoreFocus && openIndex !== null)
        triggers.current[openIndex]?.focus();
      setOpenIndex(null);
    },
    [openIndex],
  );

  const open = useCallback(
    (index: number, edge: "first" | "last" = "first") => {
      pendingEdge.current = edge;
      setTabIndex(index);
      setOpenIndex(index);
    },
    [],
  );

  useEffect(() => {
    notify.current(openIndex !== null);
  }, [openIndex]);
  useEffect(() => () => notify.current(false), []);

  useLayoutEffect(() => {
    if (openIndex === null) return;
    const items = popup.current?.querySelectorAll<HTMLButtonElement>(
      "button:not(:disabled)",
    );
    const item =
      pendingEdge.current === "last" ? items?.[items.length - 1] : items?.[0];
    item?.focus();
    // Reopening the same menu via its trigger is handled by the trigger's focus event.
  }, [openIndex]);

  useEffect(() => {
    if (openIndex === null) return;
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        close(false);
    };
    const onBlur = () => close(false);
    document.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [openIndex, close]);

  useEffect(() => {
    const onAlt = (event: globalThis.KeyboardEvent) => {
      if (
        !event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.repeat
      )
        return;
      if (document.querySelector('[aria-modal="true"], .modal-backdrop'))
        return;
      const index = menus.findIndex(
        (menu) =>
          (mnemonics[menu.label] || menu.label[0]?.toLowerCase()) ===
          event.key.toLowerCase(),
      );
      if (index >= 0) {
        event.preventDefault();
        event.stopPropagation();
        open(index);
      }
    };
    window.addEventListener("keydown", onAlt, true);
    return () => window.removeEventListener("keydown", onAlt, true);
  }, [menus, open]);

  const moveMenu = (index: number, delta: number, expand: boolean) => {
    const next = (index + delta + menus.length) % menus.length;
    setTabIndex(next);
    if (expand) open(next);
    else triggers.current[next]?.focus();
  };

  const onPopupKey = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (openIndex === null) return;
    const items = [
      ...(popup.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ) || []),
    ];
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | undefined;
    if (event.key === "ArrowDown") next = (current + 1) % items.length;
    if (event.key === "ArrowUp")
      next = (current - 1 + items.length) % items.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      items[next]?.focus();
      return;
    }
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      moveMenu(openIndex, event.key === "ArrowRight" ? 1 : -1, true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      // Return focus before allowing the browser to move to the next shell control.
      close(true);
    } else if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      event.key !== " "
    ) {
      const key = event.key.toLocaleLowerCase();
      const ordered = [
        ...items.slice(current + 1),
        ...items.slice(0, current + 1),
      ];
      const match = ordered.find((item) =>
        item.dataset.label?.toLocaleLowerCase().startsWith(key),
      );
      if (match) {
        event.preventDefault();
        match.focus();
      }
    }
  };

  return (
    <div
      className="player-menubar"
      role="menubar"
      aria-label="Application menu"
      ref={root}
    >
      {menus.map((menu, index) => {
        const expanded = index === openIndex;
        const triggerId = `${id}-trigger-${index}`;
        const popupId = `${id}-popup-${index}`;
        return (
          <div className="player-menu-group" key={menu.label}>
            <button
              ref={(element) => {
                triggers.current[index] = element;
              }}
              id={triggerId}
              className="player-menu-trigger"
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={expanded}
              aria-controls={expanded ? popupId : undefined}
              aria-keyshortcuts={`Alt+${(mnemonics[menu.label] || menu.label[0]).toUpperCase()}`}
              tabIndex={index === tabIndex ? 0 : -1}
              onFocus={() => setTabIndex(index)}
              onClick={() => (expanded ? close(true) : open(index))}
              onPointerEnter={() => {
                if (openIndex !== null && !expanded) open(index);
              }}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  open(index, event.key === "ArrowUp" ? "last" : "first");
                  if (expanded) {
                    const items =
                      popup.current?.querySelectorAll<HTMLButtonElement>(
                        "button:not(:disabled)",
                      );
                    (event.key === "ArrowUp"
                      ? items?.[items.length - 1]
                      : items?.[0]
                    )?.focus();
                  }
                } else if (
                  event.key === "ArrowRight" ||
                  event.key === "ArrowLeft"
                ) {
                  event.preventDefault();
                  moveMenu(
                    index,
                    event.key === "ArrowRight" ? 1 : -1,
                    openIndex !== null,
                  );
                } else if (event.key === "Home" || event.key === "End") {
                  event.preventDefault();
                  const next = event.key === "Home" ? 0 : menus.length - 1;
                  setTabIndex(next);
                  triggers.current[next]?.focus();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  close(true);
                }
              }}
            >
              {menu.label}
            </button>
            {expanded && (
              <div
                ref={popup}
                id={popupId}
                className="player-menu-popup"
                role="menu"
                aria-labelledby={triggerId}
                onKeyDown={onPopupKey}
              >
                {menu.items.map((item, itemIndex) =>
                  item.separator ? (
                    <div
                      key={`separator-${itemIndex}`}
                      role="separator"
                      className="player-menu-separator"
                    />
                  ) : (
                    <button
                      key={`${item.label}-${itemIndex}`}
                      type="button"
                      role={
                        item.checked === undefined
                          ? "menuitem"
                          : "menuitemcheckbox"
                      }
                      aria-checked={item.checked}
                      disabled={item.disabled || !item.action}
                      className="player-menu-command"
                      tabIndex={-1}
                      data-label={item.label}
                      onClick={() => {
                        close(true);
                        item.action?.();
                      }}
                    >
                      <span className="player-menu-check" aria-hidden="true">
                        {item.checked ? "✓" : ""}
                      </span>
                      <span className="player-menu-label">{item.label}</span>
                      {item.shortcut && (
                        <span
                          className="player-menu-shortcut"
                          aria-hidden="true"
                        >
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
