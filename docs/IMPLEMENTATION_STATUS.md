# Implementation status — 2026-10-26

## Current milestone: VLC-compatible core workflows

The player was rebuilt around familiar desktop menus, a central native picture, stable dock/status and a keyboard-editable playlist. Native shuffle, A/B looping, EQ/preamp, picture adjustments, crop, frame advance, chapters, audio channels, folder opening and explicit HTTP/HTTPS/RTSP opening replace simulated controls. Errors are visible and dialogs have focus/Escape behavior. See [VLC_PARITY.md](VLC_PARITY.md) for exact evidence and remaining subsystems.

Doctor, five frontend tests, strict TypeScript/Vite, thirteen native unit tests and the extended headless integration passed. A Windows release visibly rendered the original AVI fixture with pinned libVLC3.0.24 in an isolated profile. Play/pause, native double-click fullscreen, Escape and video hiding under Effects were verified. Browser minimum-size layouts fit. An unsigned NSIS installer built successfully. Audible output, installer execution, signing and macOS acceptance remain outstanding.

Full VLC parity is not complete. Disc/capture/recording, conversion/outgoing streaming, casting, complete filters/preferences, history/resume, media keys/associations and platform acceptance remain. The whole-player request stays incomplete until these are implemented and tested; no placeholder menu claims otherwise.

## Historical milestone — 2026-10-24

The following record describes the earlier logo milestone. Its native startup restriction is resolved for the current isolated Windows run; its artifact hashes apply only to that older build.

## Completed milestone

- Preserved the four user-supplied SVGs unchanged under assets/brand.
- Integrated the sage N in the responsive header and the supplied app icon as favicon.
- Regenerated existing Tauri icon assets, including ICO and ICNS.
- Updated design.md, branding.md and README with approved variant usage.
- Added Vite asset type declarations; fixed doctor discovery for this Windows environment.
- Replaced fixed native integration test delays with bounded state waits after a reproducible pause assertion failure.

## Verification

Frontend tests (3), TypeScript, Vite production build, browser layout checks (12), native Rust check/unit tests (5), doctor compile/run probe and headless libVLC integration (1) passed. Browser screenshots were inspected for the new header mark. Desktop smoke launch failed with Windows Access is denied during Tauri setup; no successful visible playback or audible output is claimed. Mac icon generation is not macOS build verification.

## Next milestones

1. Complete the source/runtime audit and restore native desktop acceptance execution; investigate the denied Tauri startup in this restricted session.
2. Harden queue replacement limits, persisted state validation, IPC snapshot ordering and native surface scroll placement with regression coverage.
3. Implement a separate versioned local library with explicit folder selection, cancellable indexing and corruption/migration tests.
4. Add resume/history and locally extracted metadata/artwork; then assess remaining convenience controls.
5. Run platform packaging, install/uninstall and playback acceptance on Windows and actual Intel/Apple Silicon macOS environments. Signing/notarization credentials and successful remote CI remain unverified.

No production-ready release is claimed. Existing macOS runtime fixes were preserved. No system-wide dependencies were installed during this milestone.

## Development artifact

`outputs/RelayN-Player-0.1.0-N-logo-Windows-x64-portable.zip` contains the Windows release compiled with Tauri's custom-protocol feature and the staged VLC runtime. SHA-256: `1207db0d529743ab04ee917e886960599167e0f072d0cd248e2a18be72810739`. This is an unsigned development build; the current native startup restriction remains unresolved. The archive executable was checked against the release build and the runtime library is present. No updated MSI/NSIS installer or Mac binary was produced in this milestone.
