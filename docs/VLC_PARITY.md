# VLC workflow parity — 2026-10-26

This is an implementation and verification ledger, not a claim of complete VLC parity.

## Evidence

- Direct observation of the installed Windows VLC: eight menus (Media, Playback, Audio, Video, Subtitle, Tools, View, Help), central picture, bottom timeline/transport, queue toggle, volume and menu-driven media opening. Media menu includes File, Multiple Files, Folder, Disc, Network, Capture, Recent, Save Playlist, Convert/Save, Stream and Quit.
- REA CLI 6.7.0 inspected the installed `C:\Program Files\VideoLAN\VLC\vlc.exe`. Evidence ID: `ev_cfe96ee066cf226ed6d894fe7d46cc1c2f918e5fcda18608164a4918dbb9fc59`; SHA-256 `31f5e43e9283cf2469d8b3e51e7c28c132c6ecb0dab855df52cbf21d5394ae0b`. Full resource inventory is retained locally at `work/vlc-pe-evidence.json`. This establishes binary/resource identity, not runtime behavior or source-level implementation.
- REA registration is aligned but active MCP tools and a native decompiler provider are unavailable. No engine/configuration installation was performed. Runtime observations use Windows Computer Use; libVLC implementation uses public APIs.
- Public API references: [Video controls](https://videolan.videolan.me/vlc-3.0/group__libvlc__video.html), [Audio controls](https://videolan.videolan.me/vlc-3.0/group__libvlc__audio.html), [Media player](https://videolan.videolan.me/vlc-3.0/group__libvlc__media__player.html).

## Implemented core workflows

| Area | Current implementation | Verification boundary |
|---|---|---|
| UI organization | Eight VLC-style command menus, central stage, stable full-width dock/status, playlist toggle | Browser layouts and native build; own RelayN assets |
| Opening media | Native multi-file dialog, drag/drop, bounded recursive folder picker, local UTF-8 M3U/M3U8 | Local parser/folder unit tests and native playback fixtures |
| Network | Explicit HTTP/HTTPS/RTSP URLs via libVLC media location | Protocol/credential validation tested; remote/live RTSP acceptance outstanding |
| Queue | Search, single-click selection, double-click/Enter playback, delete/reorder, native shuffle bag/history, repeat | Queue/schema unit tests; native shuffle bag test |
| Transport | Play/pause/stop/seek/rate/volume/mute; real next-frame API; native A/B worker loop | Native integration covers playback/pause/seek/A/B |
| Picture | Native aspect, crop, brightness/contrast/saturation/gamma/hue; Save PNG snapshot dialog | Native adjustment readback and crop validation; visual filter/snapshot acceptance outstanding |
| Audio | Track IDs, 150% volume, channel selection, native ten-band EQ/preamp, audio delay | EQ apply/disable and validation integration; audible EQ/channel acceptance outstanding |
| Subtitles | Embedded selection, disable, external files, subtitle delay | Fixture external subtitle and native track enumeration |
| Chapters | Actual libVLC chapter count/index and next/previous/select | APIs wired; chapter-bearing fixture acceptance outstanding |
| Window | Fullscreen, always-on-top and current-file title; native surface hidden under overlays | Platform acceptance required |
| Dialogs | Effects, Preferences, Information, Jump to Time, Bookmarks, Network, About | Accessible labels, Escape, focus trap/restore; real settings actions |
| State/persistence | Engine-owned effects/queue/loop; bounded file read, safe ID repair, atomic writes, original corrupt file preserved | Rust regression tests; no automatic playback on restore |

## Remaining VLC subsystems

The request covers the whole VLC product. The following are still required before claiming that outcome:

- Disc/DVD/Blu-ray menus and title navigation beyond chapters; optical device selection.
- Capture devices, desktop recording, recording toggle and hardware selection.
- Convert/Save, output profiles, transcoding and outgoing streaming.
- Renderer/casting discovery and control; network browsing/services.
- Full audio output device selection, visualizations, compressor/spatializer and advanced audio filters.
- Video deinterlace, zoom, rotation/geometry and remaining filters; complete subtitle typography/position controls.
- Recent-media history, playback-position resume, richer metadata/codec statistics, configurable hotkeys and complete advanced preferences.
- Full context-menu behavior, native fullscreen auto-hide control surface, platform media keys, OS file associations and single-instance open events.
- Complete native acceptance on Windows and actual macOS Intel/Apple Silicon; signed installers, notarization, installer upgrade/uninstall checks.

Unavailable features are not represented by clickable mock controls. Full parity must be delivered through tested milestones; this implementation addresses the broken core and restores familiar workflows first.

## Verified results — 2026-10-26

- Node 26.12.0, Rust 1.99.1, MSVC14.44 and SDK10.0.26100.0: doctor compile/run probe passed.
- Frontend: five tests, strict TypeScript and Vite production build passed. Player/playlist browser checks at1440×900,1180×780 and880×620 found no horizontal document overflow; dock stays in the window. Effects dialog fits the minimum window and focus enters the dialog.
- Native: thirteen unit tests and one extended headless integration passed. Includes old settings defaults, invalid source/ID repair, bounded/corrupt settings preservation, folder traversal, network validation, queue replacement, shuffle bag, effect readback, EQ, A/B worker looping, pause/seek/subtitles and corrupt media.
- Actual Windows release: launched with isolated settings and pinned libVLC3.0.24. The original AVI fixture visibly rendered through Direct3D11. Play/pause, native picture double-click fullscreen, Escape return and Ctrl+E Effects were observed. The native drawable hid while the Effects dialog covered the stage and returned after dismissal. Test profile was muted; audible output was not assessed.
- Windows pointer handling subclasses the owned host window, restores WebView focus on clicks, and emits a double-click event. Context memory is reclaimed on host destruction. Upstream behavior reference: [VLC Windows event handling](https://github.com/videolan/vlc/blob/3.0.x/modules/video_output/win32/events.c), disabled child with mouse/key handlers disabled.
- An unsigned NSIS bundle was successfully generated. No installer execution, signing, macOS execution or notarization is claimed.
- Screenshot evidence: `outputs/vlc-parity/native-playback.jpg`. The browser fixture upload helper timed out; native fixture playback was verified separately as above. No browser-codec result is substituted for native verification.

## Development packages

- `outputs/RelayN-Player-0.1.0-VLC-core-x64-setup.exe`: unsigned NSIS installer; SHA-256 `01a536637493a74cca85f4c4eebde627da4914a9634d8d1936eed5ef373cfd85`.
- `outputs/RelayN-Player-0.1.0-VLC-core-Windows-x64-portable.zip`: executable plus pinned VLC runtime and notices; SHA-256 `5b458b62af276c28599baccbe6c3f797caea7ecc15b292ae7c85e9faf96593c3`.
- The portable executable was checked against the final release executable; archive contains libVLC. Neither artifact is a certified production release.
