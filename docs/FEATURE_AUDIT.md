# Current audit pointer — 2026-10-26

The current feature/verification ledger is [VLC_PARITY.md](VLC_PARITY.md). It supersedes the initial findings below: native EQ/crop/shuffle/A–B/frame, menus, queue editing, bounded settings/ID repair and Windows native launch were implemented or repaired. Folder opening adds files to the queue; it is not a persistent indexed library. Full VLC parity remains incomplete.

## Initial audit retained for context

# RelayN implementation audit — 2026-10-24

This is an initial audit, not a completed release certification. The branding milestone is implemented. The broader product audit and development phases remain open.

| Area | Actual status and evidence | Gaps / next verification | Priority |
|---|---|---|---|
| Identity | User-supplied abstract N originals in assets/brand; App.tsx header, index.html favicon, Tauri generated icons | Windows shell icon and macOS bundle acceptance still needed | P1 |
| Playback | main.rs Engine owns Vlc; headless fixture integration passes WAV/AVI pause, seek, subtitle loading and corrupt-file error | Visible native playback and audible output not verified this session; desktop launch denied | P0 |
| Queue | main.rs open_paths/action, model.rs expand_paths; reorder/remove/repeat/import/export implemented | Replacement limit counts old queue before clearing; missing-file/end-of-file recovery requires focused tests | P1 |
| Persistence | model.rs Saved, atomic temporary-file replacement, unreadable-file protection | Size check happens after full read; duplicate IDs/path validation and schema migration require hardening | P1 |
| Playback state | usePlayer.ts subscribes to native snapshots | Initial get_state response can race event updates; evaluate ordering/lifecycle | P1 |
| Native drawable | surface.rs HWND/NSView, useNativeSurface controls bounds and visibility | Scroll movement not observed in hook; view/modal/fullscreen acceptance needed | P0 |
| Library | App.tsx filters/searches the saved queue | Separate library, explicit folder indexing, cancellation and schema do not exist | P1 |
| Metadata/artwork | libVLC title/artist/album; Artwork.tsx generic illustrations | No extracted-artwork cache or separate library metadata index | P2 |
| Resume/history | Current selection and queue persisted | No position resume or playback history store | P1 |
| Controls | Transport.tsx controls native tracks, volume, speed, aspect; keyboard mapping in player.ts/usePlayer.ts | Configurable shortcuts/seek, shuffle, A/B loop, mini-player and media keys remain pending | P2 |
| Packaging | Windows release compilation passes; platform config and mac preparation exist | Installer, signing, notarization and actual macOS tests remain outstanding | P0 |

Documentation conflict resolved: design.md and branding.md described the earlier signal-line mark. The user's explicit approved N assets supersede that direction. Compatibility identifiers remain unchanged. README's old claim that CI never ran is superseded by the user-provided macOS CI failure; a successful current remote run has not been verified.

Baseline evidence: frontend 3 tests, TypeScript, Vite production build, 12 browser layout checks, Rust check, 5 Rust unit tests and 1 headless native integration test passed. Doctor now resolves the running Node executable and normalizes Windows PATH keys; it passes with Node 24.22.1, Rust 1.99.1, MSVC and Windows SDK 10.0.26100.0. npm itself is absent from the session PATH; equivalent underlying commands were executed directly. The native integration test's fixed pause/seek/subtitle delays were replaced by bounded waits for actual engine state, preserving assertions.
