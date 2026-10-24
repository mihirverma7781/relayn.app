# RelayN Player

An original, local-first desktop media player built with Tauri 2, React, TypeScript, Rust and libVLC 3. The implementation is an MVP undergoing native verification; it is not yet a production release.

## Run

Prerequisites: Node.js 26, Rust stable, and native platform tools. Windows needs MSVC C++ Build Tools, a Windows SDK and WebView2. macOS needs Xcode Command Line Tools. `npm run doctor` checks the toolchain, including compiling a small Rust executable. The npm desktop scripts discover Rust under your user `.cargo/bin` even when it is absent from PATH.

```
npm ci
npm run doctor
npm run runtime:fetch
npm run desktop
```

The runtime command downloads the architecture-matched **VLC 3.0.24** archive from VideoLAN, verifies its SHA-256 against the upstream checksum, and stages the libraries and plugins locally. It does not install or update your system VLC. Package archives and binaries are excluded from Git. Preserve `package-lock.json` and `src-tauri/Cargo.lock` for reproducible dependency resolution.

## Features implemented

- Real libVLC playback through a native HWND on Windows / NSView on macOS.
- Native file selection, multiple files, desktop drag-and-drop and UTF-8 local M3U/M3U8 import/export.
- Play/pause, stop, previous/next, seeking, volume/mute, speed, repeat and playlist reordering/removal/search.
- Subtitle files and embedded subtitle/audio track selection using libVLC track IDs.
- Original / 16:9 / 4:3 / 1:1 / 21:9 aspect ratios and application fullscreen.
- Title/artist/album, duration, track information and actionable file/runtime errors.
- Local persistence of playlist, current selection, volume, mute, rate, aspect ratio and repeat mode. Restoring a session does not automatically start playback.

Tracks and metadata appear after libVLC has opened the media. Format support depends on the bundled runtime's plugins and the contents of each file; an extension alone does not establish compatibility. Network streams, disc menus, DRM, casting and media-library indexing are outside the current MVP.

## Shortcuts

| Action | Shortcut |
|---|---|
| Open / append media | Ctrl or Cmd O / Ctrl or Cmd Shift O |
| Play / pause | Space |
| Stop | S |
| Previous / next | P / N |
| Seek backward / forward 10 seconds | Left / Right |
| Volume / mute | Up or Down / M |
| Fullscreen / leave fullscreen | F / Esc |
| Cycle audio / subtitles | B / V |
| Cycle aspect ratio | A |
| Slower / faster | - / + |

Shortcuts do not intercept typing in form fields. Native video focus and drag/drop need platform acceptance testing.

## Architecture

React renders the controls and playlist. The Rust engine owns the playlist, persisted settings, libVLC instance, media player and media references. Its mutex serializes access to libVLC. Blocking playback operations run off the UI thread. A worker publishes state every 250 ms and advances the playlist at end-of-file; playback progression does not depend on a foreground browser timer. Native surface placement happens on the application main thread.

The small dynamic FFI wrapper targets libVLC 3, checks required symbols and runtime version, releases native resources explicitly, and preserves a runtime-load failure as a visible application error. A dedicated native video surface avoids copying video frames through JavaScript. HTML controls remain outside the native surface; the surface is hidden while dialogs are open.

Settings are written using a temporary file followed by atomic replacement. Unreadable settings are preserved rather than overwritten. Playlist imports validate local absolute paths, resolve relative M3U entries against the playlist file and enforce size limits. Remote M3U entries are intentionally rejected by this local-media MVP. Media metadata network lookup is disabled.

## Verify

```
npm run verify
npm run fixtures
npm run native:check
npm run native:test
npm run native:integration
```

The ignored native integration test requires staged libVLC and generated fixtures. It exercises Rust-to-libVLC playback, pause, seek, subtitle loading, corrupt media error reporting and saved settings with dummy video/audio output. It does not prove visible rendering or audible output. The deterministic fixtures are original six-second WAV/AVI clips and an SRT file.

The existing browser smoke test in `work/` verifies interface loading and modal controls. It is a development artifact, not a substitute for native desktop acceptance tests.

## Package

```
npm run package
```

Windows configuration targets MSI. NSIS is also available via `npm run tauri -- build --bundles nsis`, but its compiler could not launch in this session (Windows error 623). macOS targets an application bundle and DMG. The GitHub workflow defines Windows x64, macOS ARM64 and macOS Intel builds; it has not been run in a remote repository. A separate Mac environment is required for macOS compilation, native tests, packaging, signing and notarization.

The macOS preparation script checks and rewrites bundled library references to loader-relative paths and signs nested dylibs with `APPLE_SIGNING_IDENTITY` (or an ad-hoc identity for development). This path requires real Mac validation. For public macOS distribution, configure Tauri's Apple signing/notarization credentials. Public Windows releases likewise need a signing identity. Test packages are unsigned development artifacts.

Bundled VLC libraries and plugins retain their upstream notices and runtime provenance. The corresponding source archive is recorded in `RUNTIME-PROVENANCE.txt`; review runtime/plugin distribution requirements before publishing. RelayN Player uses its own icon and interface and does not copy VLC assets.

## Upstream references

- Tauri prerequisites: https://v2.tauri.app/start/prerequisites/
- libVLC 3 native embedding: https://videolan.videolan.me/vlc-3.0/libvlc__media__player_8h_source.html
- Official pinned runtime: https://download.videolan.org/pub/videolan/vlc/3.0.24/
- Tauri macOS packaging: https://v2.tauri.app/distribute/macos-application-bundle/

For isolated test sessions or portable configuration, set `ASTER_CONFIG_DIR` to an absolute writable directory before launching. It contains the settings file and playlist; media files are never copied there.

