# RelayN Player UI design system

This is the design reference for future UI work. Read it before changing screens or components, and keep it synchronized with the app. Product identity and copy follow `branding.md`; this document translates those rules into the implemented interface. Preserve the native Rust/libVLC player.

## Direction

RelayN Player is a dependable native player for local audio/video and explicitly opened network streams. The user requested VLC-compatible desktop workflows on 2026-10-26, superseding the earlier four-view editorial shell. Keep the approved RelayN identity, muted colors and bundled fonts; use compact readable UI text for controls. The video and familiar command flow take priority over decorative content.

Use `RelayN` for compact branding and `RelayN Player` for the full product name. The Stitch reference's Atelier identity, demo films, albums, counts, and technical readouts are not application data. Only claim implemented protocols and functions. HTTP/HTTPS/RTSP opening is explicit; cloud libraries and indexing remain unavailable.

## Brand identity and technical continuity

The canonical user-facing name is **RelayN Player**; use **RelayN** in compact branding. The working tagline is “Your media. In motion.” Product identity and voice source of truth: [branding.md](branding.md). Use the approved abstract N SVGs in `assets/brand/`; these user-supplied assets supersede the earlier endpoint-and-signal concept. Names, trademark, domain, and store availability are not cleared by this implementation.

Use `relayn-symbol-sage.svg` in the dark application header, `relayn-symbol-ivory.svg` for neutral marks on dark surfaces, and `relayn-symbol-dark.svg` on light surfaces. Use `relayn-app-icon.svg` for the favicon and native application icon. Preserve the geometry, palette and square aspect ratio; do not replace the mark with a play icon, recolor it with CSS filters, or stretch it. Keep the header mark visible at the minimum desktop width. Adjacent text or the enclosing button supplies the accessible name, so its image has empty alt text. Regenerate desktop icons with `node node_modules/@tauri-apps/cli/tauri.js icon assets/brand/relayn-app-icon.svg --output src-tauri/icons`.

Keep compatibility-sensitive identifiers stable unless a migration is deliberately designed: npm package `aster-player`, Rust crate `aster-player`, bundle identifier `com.aster.player`, persistence key `aster.view`, and `ASTER_CONFIG_DIR`.

## Source references

Stitch project: **Modern Desktop Media Player UI**, `4692029983613862265`.

| Screen | Stitch screen ID | Downloaded reference |
|---|---|---|
| Home & Media Curator | `088194f15a6c4ee5875ea40bf1a5934b` | `outputs/stitch-reference/01-home.png` and `.html` |
| Local Library & Collection Archive | `e0a47320f76846c99b55203a46b2f249` | `outputs/stitch-reference/02-library.png` and `.html` |
| Cinematic Video Stage | `d129ae7821464c108f93ecd1029c17f6` | `outputs/stitch-reference/03-video.png` and `.html` |
| Audio Experience & Queue Manager | `1eaebe47519f49368a0fa37668da671b` | `outputs/stitch-reference/04-audio.png` and `.html` |

Inspect the relevant images when extending a view. Use the HTML to understand tokens and hierarchy, not as a production page to execute or copy wholesale. It contains external CDN scripts, placeholder metadata and images. Production assets/fonts must remain local and work offline.

## Color tokens

Use the CSS custom properties in `src/style.css`; extend them intentionally instead of adding near-duplicate colors.

| Token | Value | Purpose |
|---|---|---|
| `--bg` | `#171A19` | Warm charcoal application canvas |
| `--lowest` | `#151817` | Video backdrop, recessed areas, status strip |
| `--low` | `#202523` | Header, cards, queue panels |
| `--surface` | `#202523` | Editorial panels and playback dock |
| `--high` | `#292F2C` | Hover/selected surfaces and chips |
| `--highest` | `#333A36` | Strongest surface emphasis |
| `--text` | `#F2F1E9` | Primary text |
| `--muted` | `#A7AEA8` | Secondary descriptions and quiet labels |
| `--accent` | `#A9C3AD` | Primary action, active playback, emphasis |
| `--accent-container` | `#A9C3AD` | Supporting sage accents |
| `--on-accent` | `#202522` | Dark text/icons on sage buttons |
| `--secondary` | `#C0D5C3` | Warm technical tags and supporting accents |
| `--outline` | `#39413C` | Quiet dividers and inset boundaries |
| `--line` | `#c5c8bd15` | Subtle section separators |

Use color with text or icon state, not as the sole state indicator. Reserve warm error surfaces for actual playback or file errors. Do not make normal empty states look like failures.

## Typography

All three families are bundled locally through Fontsource:

- **Newsreader Variable** (`--serif`): editorial page titles, media names, empty-state headings. Normal weight 400, slightly negative tracking. Typical desktop titles 29–39 px; large cinema empty-state headings up to 52 px. Italics provide occasional quiet emphasis.
- **Hanken Grotesk Variable**: body copy, navigation, actions and explanatory text. Body around 12–14 px; compact uppercase navigation around 10–11 px with controlled tracking.
- **Space Mono** (`--mono`): timecodes, format labels, paths, counts, compact technical values. Keep important text readable; use tiny microtype only for nonessential decorative details. Avoid long monospace paragraphs.

Use serif display type for hierarchy, not for every label. Truncate long filenames visually where needed and preserve the full value in a tooltip or inspector. Allow paths to wrap in the inspector. Unknown duration is an em dash; it is not a zero-length recording.

## Shape, spacing and visual treatment

- Primarily square geometry: 2–3 px corner radii on controls and panels. Circular forms are reserved for record artwork, small status indicators and a few marks.
- Use 22–28 px outer desktop gutters, 18–24 px major gaps, 10–14 px compact internal gaps, and consistent vertical rhythm.
- Establish depth through closely related surface colors. Borders are quiet and shadows restrained. Avoid bright blue accents, glassy neon cards, large pill buttons and heavy gradients.
- Primary actions are pale sage with dark text. Secondary actions use charcoal surfaces. Tertiary actions are compact text/icon controls.
- Prefer Lucide line icons with consistent optical size. Important icon actions need accessible names and visible focus rings.
- Original CSS/SVG artwork can represent files without artwork: a restrained landscape for video and a record sleeve for audio. These are generic artwork, not extracted thumbnails, album covers or playback visualizers. Never suggest they came from the file.

## Application shell and VLC-compatible workflows

The current shell is menu-first: Media, Playback, Audio, Video, Subtitle, Tools, View and Help, above a central native playback stage. A full-width dock and compact status strip remain visible in normal windows. The previous Home/Library/Video/Audio navigation is historical and is not the current application shell.

- Empty state: approved N mark, Open media button and drop instruction. Avoid decorative pseudo-meters or fictitious format promises.
- Playlist: View > Playlist / Ctrl+L switches between the stage and a native-owned queue. Single click selects; double click or Enter plays. Arrow/Home/End navigate, Delete removes and Alt+Up/Down reorders. Search filters without changing the underlying order. Add files/folder, export, reorder, shuffle and repeat are real operations.
- Media: Open File, Open Multiple Files, recursive Open Folder and explicit Open Network Stream. User-entered HTTP/HTTPS/RTSP URLs contact the requested host; embedded credentials are rejected and query strings are saved in the queue. No automatic remote discovery.
- Playback: native state is authoritative for shuffle, A/B loop, crop, effects, EQ, audio channels, chapters and frame advance. If a native operation fails, show the actionable error. Do not simulate success in React or CSS.
- Effects: ten libVLC frequency bands and preamp, native brightness/contrast/saturation/gamma/hue and audio/subtitle synchronization. Unsupported color inversion is not exposed. Changing an effect must change native output, not only a placeholder's style.
- Video: fullscreen, always on top, supported aspect/crop ratios and snapshot through a native Save PNG dialog. Canceling a dialog is not a saved-file success. Controls remain outside the native drawable.
- Tools: Media Information, per-file bookmarks, Jump to Time and Preferences. Preferences includes real saved volume, rate and repeat controls and a shortcut reference.
- Menus implement roving focus, arrow navigation, Alt mnemonics, Escape, checked states and disabled unavailable actions. Hide the native video while a menu, popover, modal or drag overlay covers the stage.
- Shared dialogs use useDialog for focus containment/restoration and Escape. Playback shortcuts must not fire while a dialog or editable control owns input.

The palette, approved assets and offline typography above remain authoritative. Historical Stitch references may guide tone, but do not restore the removed editorial layouts unless the user explicitly asks.

## Native playback constraints

These rules are essential, not cosmetic:

- React controls real playback through `src/usePlayer.ts`. The Rust engine remains authoritative for playback, queue and settings.
- Reuse `Transport`, `Queue`, `MediaArtwork` and `FileGlyph`. Extend shared components before creating competing variants.
- Windows video is a child HWND; macOS uses an NSView. A native surface can cover web content even when CSS z-index suggests otherwise.
- `useNativeSurface` must update the native bounds on layout changes and hide it when no video region exists, when viewing audio, and when dialogs/queue overlays/drop overlays cover it.
- Switching views must not stop playback or leave a stale native rectangle on another page. Never re-create the media player for navigation.
- Keep the video region's layout stable. If a new scroll container can move it, update its placement on scrolling and clip/hide it appropriately. Never let a native child paint over the header or dock.
- Do not replace the real player with an HTML video element, screenshots, simulated playback state or timers.
- Preserve keyboard shortcuts, native file dialogs, drag-and-drop, subtitle and audio track IDs, persistent settings and meaningful errors.

## Interaction, motion and accessibility

- Focus indicators use the sage accent and remain visible on all interactive controls.
- Icon buttons need action-specific accessible labels. Active navigation uses `aria-current`; filters/layout toggles use `aria-pressed`; the queue toggle exposes its expanded state.
- Settings/information dialogs use dialog semantics, initial focus, Tab/Shift+Tab containment, Escape dismissal and focus restoration. Escape in a dialog must not simultaneously change player fullscreen.
- Text inputs retain normal editing shortcuts. Ctrl/Cmd+K focuses collection search; playback shortcuts remain available elsewhere without double-triggering Space on focused buttons.
- Errors are actionable and use `role="alert"`. Normal empty states explain how to add files.
- Respect `prefers-reduced-motion`. All animations and transitions are disabled under user reduced motion preference.
- Normal playback has no decorative animations. Browser preview is explicitly identified and is not evidence of native codec support.

## Responsive desktop behavior

Verify at 1440×900, 1180×780 and the native minimum 880×620. Reduce gutters and secondary metadata before sacrificing controls. Library/queue panels can scroll independently; the dock must stay visible. All view layouts need `min-width: 0` / `min-height: 0` where flex/grid children contain long filenames or scrollable lists.

Do not rely on the reference's 2560 px screenshots as fixed application dimensions. The implementation must fit a real Windows/macOS desktop window without horizontal document overflow or clipped core actions.

## Workflow for future agents

1. Read this file and inspect the relevant current components and Stitch image/HTML references.
2. Preserve existing functionality and configuration. Make a new component only when it represents a reusable interaction or a real new view.
3. Use the established tokens, typography, surface hierarchy, spacing and interaction states. Keep all user-visible facts grounded in available local media data.
4. Run `npm run verify` for frontend changes. Inspect screenshots at the supported desktop sizes; check empty, populated, long-filename and error states.
5. For layout/navigation changes, run a native build and the native desktop smoke test. Confirm video placement/hiding after navigation, modal/queue toggles, resizing and fullscreen.
6. For Rust changes, also run the relevant native unit/integration tests. Do not mark macOS behavior verified without a Mac test environment.
7. Rebuild the portable deliverable when the UI changes and record actual verification results. Keep prior packaging/signing/macOS limitations explicit.
8. Update this document when adding a deliberate reusable pattern or changing a token. Keep generated reference HTML separate from production React code.

## Implementation map

- `src/style.css`: design tokens, offline fonts, layouts, responsive states.
- `src/App.tsx`: application navigation and Home/Library/Video/Audio compositions.
- `src/components/Transport.tsx`: shared playback dock and track controls.
- `src/components/Queue.tsx`: shared queue list/drawer.
- `src/components/Artwork.tsx`: original generic media artwork and file glyphs.
- `src/usePlayer.ts`: native IPC/state subscription, keyboard behavior and native surface placement.
- `src/media.ts`: filename/type/folder presentation helpers.
- `src/player.ts`: transport types, initial state, formatting and shortcut helpers.
- `src-tauri/src/`: native playback engine; preserve its ownership and resource lifecycle.

## Current implementation additions

- `src/player-shell.css`: compact player shell and minimum-size rules.
- `src/components/PlayerMenu.tsx` / `player-menu.css`: accessible desktop command menus.
- `src/components/PlayerDialog.tsx` / `useDialog.ts`: shared dialog behavior.
- `src/components/PlaylistView.tsx`: queue selection, keyboard navigation, editing and file actions.
- `docs/VLC_PARITY.md`: evidence, implemented capabilities, verification and remaining VLC subsystems.
