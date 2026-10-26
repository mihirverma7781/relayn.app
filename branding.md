# RelayN Player — Brand & Product Identity

> **Working brand name:** RelayN Player  
> **Product category:** Universal local audio and video player for Windows and macOS  
> **Working tagline:** Your media. In motion.  
> **Status:** Product branding direction; confirm final legal, trademark, domain, and app-store clearance before public release.

This document is the source of truth for the product's name, positioning, visual direction, interface language, and brand-related implementation decisions. Read it before changing the UI, app metadata, icons, copy, or onboarding.

---

## 1. Product essence

**RelayN Player is a dependable, thoughtfully designed desktop home for the media people already own.**

It plays local audio and video across a broad range of formats. It should feel capable and precise without looking like a broadcast console, a developer tool, a streaming service, or a reskinned legacy player.

### Brand idea: Relay

A relay receives and passes something along reliably. For this product, the metaphor is the handoff between a local media file and the moment a person wants to experience it: open the file, play it, and stay immersed.

The final **N** is a deliberate visual/name distinction for the brand, not a claim that the word has a separate dictionary meaning. Preserve the spelling **RelayN** in branded contexts and **RelayN Player** in full product references.

### Brand attributes

- **Technical, not intimidating**
- **Quietly capable**
- **Precise and responsive**
- **Local-first and user-controlled**
- **Modern, editorial, and considered**
- **Trustworthy rather than flashy**

### Product principles

1. **The media is the hero.** Chrome, controls, and decoration should never compete with the content.
2. **Local-first by default.** Do not imply cloud libraries, streaming catalogs, telemetry, recommendations, or account requirements unless the product actually implements them.
3. **Broad media support.** Audio and video are equally important. Avoid music-only language or visual identity.
4. **Power without clutter.** Put common playback actions within easy reach; organize advanced actions in clear menus and contextual controls.
5. **Respect platform conventions.** Behave like a polished desktop app on both Windows and macOS.
6. **Be honest.** Do not invent format support, performance claims, privacy guarantees, or features.

---

## 2. Naming and writing rules

### Canonical names

- Brand: `RelayN`
- Full product name: `RelayN Player`
- Generic description: `Universal local media player`
- App identifier, package name, executable, bundle ID, and repository naming: inspect existing conventions and update only when safe and consistent.

Use `RelayN Player` for user-facing full product references, such as the About screen, installer, and website metadata. Use `RelayN` for compact UI branding, the app icon context, and short headings.

### Do

- Write the name exactly as `RelayN` or `RelayN Player`.
- Use plain, confident language.
- Describe features in terms of what the user can do.
- Prefer concise labels: `Open file`, `Open folder`, `Playback speed`, `Audio track`, `Subtitles`, `Repeat`, `Shuffle`, `Playback history` (only if implemented).
- Keep audio and video language balanced.

### Don't

- Do not rename it to `Relayn`, `Relay N`, `Relay-V`, or any other variation without explicit approval.
- Do not use the tagline as a hard-coded substitute for the product name.
- Do not call it a streaming service, media server, or cloud library.
- Do not use generic hype such as “revolutionary,” “next-generation,” or “the ultimate player.”
- Do not introduce AI recommendations, social features, accounts, or online catalog language unless implemented.
- Do not use Marvel, DC, Star Trek, or other third-party franchise names, logos, characters, or artwork in the product identity.

### Voice examples

Prefer:
- “Open a file to start playing.”
- “Choose an audio track.”
- “Subtitles are unavailable for this file.”
- “RelayN Player couldn’t open this file. Try another format or check that the file is accessible.”

Avoid:
- “Welcome to the future of entertainment!”
- “Your ultimate AI-powered media universe awaits.”
- Technical error dumps as the only explanation; show a useful summary and offer details when appropriate.

---

## 3. Visual identity

### Design direction

**Modern editorial software with a restrained technical character.** Think precision, quiet confidence, and a carefully designed media workspace. The interface should be comfortable for long sessions and make playback controls feel obvious without filling every surface with cards.

Use a neutral, low-distraction foundation. Let album art, video, and the user's own media supply the color.

### Suggested color tokens

Treat these as starting design tokens, not permission to recolor every existing component blindly. Map them to the project's current design system and preserve accessible contrast.

#### Dark theme (primary playback experience)

| Token | Hex | Usage |
|---|---|---|
| `--relay-bg` | `#171A19` | Main application background |
| `--relay-surface` | `#202523` | Panels and elevated surfaces |
| `--relay-surface-raised` | `#292F2C` | Menus, popovers, hover surfaces |
| `--relay-text` | `#F2F1E9` | Primary text |
| `--relay-text-muted` | `#A7AEA8` | Secondary text |
| `--relay-border` | `#39413C` | Subtle separators and outlines |
| `--relay-accent` | `#A9C3AD` | Primary accent, active states, progress |
| `--relay-accent-strong` | `#C0D5C3` | Hover/focus emphasis on dark surfaces |
| `--relay-danger` | `#E58B83` | Destructive/error state |
| `--relay-warning` | `#E4C27D` | Warning state |

#### Light theme (if supported)

| Token | Hex | Usage |
|---|---|---|
| `--relay-bg` | `#F4F3ED` | Main background |
| `--relay-surface` | `#FFFFFF` | Main panels |
| `--relay-surface-raised` | `#ECEDE6` | Menus and secondary surfaces |
| `--relay-text` | `#202522` | Primary text |
| `--relay-text-muted` | `#69716B` | Secondary text |
| `--relay-border` | `#D9DDD5` | Separators and outlines |
| `--relay-accent` | `#54775E` | Primary accent |
| `--relay-accent-strong` | `#3E6048` | Hover/focus emphasis |

Use semantic tokens (`background`, `surface`, `text`, `muted`, `border`, `accent`, `danger`, `warning`) instead of scattering raw hex values through components. If the repository already has a token system, extend it rather than adding a competing one.

### Typography

- Prefer the existing system-native UI font stack for a desktop app.
- If the project already uses a bundled font, inspect it before introducing another.
- Use a clear hierarchy: compact but readable controls, strong page/section titles, subdued secondary metadata.
- Avoid oversized marketing-style headings inside the actual player.
- Use tabular numerals for playback time and duration when available.
- Avoid using monospaced text for ordinary interface labels; reserve it for technical metadata or logs.

### Shape, spacing, and surfaces

- Use a consistent spacing scale based on the existing implementation.
- Favor clean geometry, subtle borders, restrained radii, and deliberate negative space.
- Prefer a few purposeful surfaces over a dashboard made of cards.
- Keep the main playback canvas visually dominant.
- Use shadows sparingly; avoid heavy floating layers.
- Avoid glassmorphism, excessive blur, neon gradients, glowing borders, and decorative gradients without functional purpose.

### Iconography

- Use one consistent icon family already present in the project, if possible.
- Playback icons should be recognizable, visually balanced, and have tooltips/accessibility labels.
- Do not use emoji as core interface icons.
- Do not create a literal relay-device illustration, superhero mark, or franchise-inspired symbol.

### Logo and app icon concept

The approved identity is the user-supplied **abstract N** in `assets/brand/`. It supersedes the earlier two-endpoint signal-line concept. Preserve these SVGs unchanged; do not invent a replacement logo.

- `relayn-app-icon.svg`: ivory N on charcoal, used for native icons and favicon. `assets/app-icon.svg` is an identical compatibility copy.
- `relayn-symbol-sage.svg`: sage mark for the dark application header.
- `relayn-symbol-ivory.svg`: neutral mark on dark backgrounds.
- `relayn-symbol-dark.svg`: dark mark on light backgrounds; this asset does not imply that a light application theme is implemented.

- Keep the icon simple enough to work at 16, 32, 48, 128, and 256 pixels.
- Use each supplied variant on its documented background; preserve its original colors and proportions.
- Ensure the icon reads clearly in monochrome and in both light and dark contexts.
- Avoid literal play-button-only logos, audio wave clichés, gradients, tiny detail, and visual similarity to existing media player logos.
- If icon assets already exist, inspect them before replacing them. Do not generate a new logo automatically if the repo already has an approved one.

---

## 4. Product UI guidance

### Main player

- Keep the media canvas central and uncluttered.
- Make play/pause, seek, volume, and fullscreen (for video) discoverable.
- Display elapsed and total time clearly; use a seek bar with an accessible hit area.
- Make controls fade or recede only when appropriate, without hiding essential functionality from keyboard or assistive-technology users.
- For audio, show useful file metadata and optional artwork when available. Do not show empty placeholder artwork as if it were real metadata.
- For video, avoid decorative side panels that steal space from the video.

### Library and file navigation

- Treat the user's local files as the source of truth.
- Make opening a file or folder a first-class action.
- Do not assume users have imported their entire library or granted broad filesystem access.
- Make empty states calm and helpful, with one clear primary action.
- Avoid mock media, fake usage statistics, invented “recently popular” content, or prefilled fictional libraries in production.

### Playback and settings

- Group settings into understandable sections: Playback, Audio, Video, Subtitles, Appearance, Library/Files, Keyboard shortcuts, and About—only where applicable.
- Keep controls and labels consistent across audio and video.
- Surface unavailable options in a clear disabled state or omit them when appropriate.
- Preserve existing behavior unless a change is required to meet the brand and usability direction.

### Accessibility and interaction

- All interactive elements need keyboard access, visible focus states, and meaningful accessible names.
- Do not rely on color alone to communicate state.
- Respect reduced-motion preferences.
- Ensure text and controls meet WCAG AA contrast where practical.
- Use tooltips for icon-only actions, but do not rely on tooltips as the only accessible label.
- Support sensible keyboard shortcuts and avoid conflicting with operating-system conventions.

### Motion

- Motion should clarify state changes, not decorate the app.
- Use short, subtle transitions for menus, control visibility, and state changes.
- Respect reduced-motion preferences.
- Avoid animated backgrounds, looping flourishes, and long transitions that slow playback interactions.

---

## 5. Brand and app metadata

Search the codebase for all user-facing product identity strings and update them consistently where safe.

Potential locations include:
- package manifests (`package.json`, Rust `Cargo.toml`, workspace manifests)
- Tauri configuration and bundle metadata
- app title and window title
- About dialog and settings
- installer and bundle display names
- desktop shortcut and executable display names
- `Info.plist`, bundle identifiers, Windows resource metadata, if present
- README, project documentation, screenshots, sample config, and release notes
- HTML `<title>`, description, Open Graph metadata, and favicon references, if a web surface exists
- splash/loading/empty/error screens
- CI/CD packaging labels and artifact names

### Important implementation safeguards

1. **Inspect before editing.** Identify the actual stack, app structure, and current naming conventions first.
2. **Do not perform a blind global replacement.** `Relay`, `relay`, or `N` may appear in unrelated identifiers, dependencies, API names, test fixtures, or protocol terminology.
3. **Do not change technical identifiers unnecessarily.** Package names, bundle IDs, executable names, deep links, storage paths, and migration keys can be compatibility-sensitive. Change them only when needed, and document any required migration.
4. **Preserve app functionality.** Branding changes must not alter playback behavior, file permissions, codec integration, update behavior, or persistence.
5. **Do not claim unsupported features.** All visible feature copy must reflect the implementation.
6. **Avoid adding dependencies solely for branding.** Reuse the project's existing icon, styling, and metadata mechanisms where possible.
7. **Keep the name consistent.** User-facing full product name is `RelayN Player`; short brand is `RelayN`.
8. **Keep platform differences intentional.** Use each OS's expected app naming and metadata conventions.

---

## 6. Codex implementation task

When asked to implement this branding in the repository:

1. Read this file completely before making changes.
2. Inspect the project tree, current UI, styles/tokens, app metadata, package manifests, build configuration, and existing icons.
3. Produce a short inventory of the relevant files and planned edits before modifying anything.
4. Implement the brand consistently in existing structures rather than rebuilding the application or introducing a new design system.
5. Update user-facing names and metadata to `RelayN Player` / `RelayN` where safe.
6. Apply the design tokens using the current styling architecture. Consolidate repeated values into shared tokens where appropriate.
7. Improve inconsistent visual details only where they conflict with this brief; do not redesign unrelated flows or remove useful controls.
8. Inspect audio playback, video playback, empty states, settings, menus, and window/app metadata after changes.
9. Run the relevant formatter, lint, type-check, tests, and build commands available in the repository. Do not claim checks passed unless they were run successfully.
10. Summarize files changed, key decisions, validation performed, and any remaining manual work.

### Scope boundaries

- Do not replace the media engine or change playback architecture as part of a branding task.
- Do not add new features just to make the interface look fuller.
- Do not remove existing features just because they do not appear in this document.
- Do not overwrite existing user data or settings.
- Do not fabricate screenshots, app-store assets, website content, legal approvals, or registration status.
- If a requested change could break existing app identity, deep links, installation, updates, or persisted data, explain the risk and ask before making the destructive change.

---

## 7. Suggested product copy

Use these as optional defaults, adapting to the actual screens and capabilities.

- **Tagline:** Your media. In motion.
- **Short description:** A thoughtful desktop player for your local audio and video.
- **Long description:** RelayN Player brings your local audio and video into one focused playback experience, with practical controls and a clean interface designed for everyday use.
- **Empty library title:** Your media starts here
- **Empty library body:** Open an audio or video file from your device to begin playback.
- **Primary action:** Open file
- **Secondary action:** Open folder
- **About line:** RelayN Player — Universal local media player
- **Error heading:** Couldn't open this file
- **Error body:** Check that the file is accessible, then try again. If the problem continues, view the technical details.

Do not show library-specific copy in screens that do not implement a library.

---

## 8. Quality bar

Before calling the branding pass complete, confirm:

- [ ] `RelayN` and `RelayN Player` are spelled consistently in user-facing surfaces.
- [ ] Existing code identifiers and compatibility-sensitive values were not blindly renamed.
- [ ] The interface feels restrained, precise, and media-first.
- [ ] Audio and video are both represented in product copy.
- [ ] Colors are centralized in the existing token system where practical.
- [ ] Light/dark themes, if supported, remain legible.
- [ ] Keyboard focus, accessible labels, and reduced motion remain intact.
- [ ] No fake content, unsupported feature claims, or third-party franchise assets were introduced.
- [ ] Relevant checks/builds were run and their actual results reported.
- [ ] Remaining domain, trademark, icon, and distribution decisions are explicitly marked as unverified.

---

## 9. Legal and availability note

`RelayN Player` is the chosen working brand for product implementation. This file does not certify trademark availability, domain ownership, company-name availability, or app-store acceptance. Before public distribution, perform appropriate trademark and naming checks in intended markets and confirm domain availability and pricing at checkout.

## Current desktop workflow direction — 2026-10-26

The user explicitly requested VLC-compatible player flows and UI organization. This supersedes the earlier editorial-shell preference where they conflict. Preserve RelayN’s approved abstract N assets, spelling, palette and voice; use familiar menus and native playback workflows. Do not use VLC’s cone/logo or claim affiliation with VideoLAN. Native behavior must be implemented and verified before a feature is advertised.
