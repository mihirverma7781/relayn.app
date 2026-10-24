#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod model;
mod surface;
mod vlc;
use model::{Item, Saved};
use serde::{Deserialize, Serialize};
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
    time::Duration,
};
use tauri::{Emitter, Manager, State};
use vlc::{Playback, Vlc};

#[derive(Clone, Serialize)]
struct Snapshot {
    playback: Playback,
    settings: Saved,
    error: Option<String>,
    runtime: String,
}
struct Engine {
    vlc: Option<Vlc>,
    saved: Saved,
    path: PathBuf,
    error: Option<String>,
    persist_allowed: bool,
    last_state: String,
}
type Shared = Arc<Mutex<Engine>>;
impl Engine {
    fn snapshot(&self) -> Snapshot {
        Snapshot {
            playback: if self.saved.current.is_some() {
                self.vlc.as_ref().map(Vlc::snapshot).unwrap_or_default()
            } else {
                Playback {
                    state: "idle".into(),
                    rate: self.saved.rate,
                    ..Playback::default()
                }
            },
            settings: self.saved.clone(),
            error: self.error.clone(),
            runtime: self
                .vlc
                .as_ref()
                .map(|v| v.version.clone())
                .unwrap_or_else(|| "Unavailable".into()),
        }
    }
    fn save(&mut self) -> Result<(), String> {
        if !self.persist_allowed {
            return Err("Settings file was unreadable. Original preserved; repair or rename it before saving.".into());
        }
        self.saved.write(&self.path)
    }
    fn play(&mut self, id: u64) -> Result<(), String> {
        let item = self
            .saved
            .playlist
            .iter()
            .find(|i| i.id == id)
            .ok_or("Playlist item no longer exists")?;
        if !std::path::Path::new(&item.path).is_file() {
            return Err(format!("File is missing or unavailable: {}", item.name));
        }
        let v = self.vlc.as_mut().ok_or("libVLC is not available")?;
        v.open(&item.path)?;
        v.volume(self.saved.volume, self.saved.muted);
        v.rate(self.saved.rate)?;
        v.aspect(&self.saved.aspect);
        self.saved.current = Some(id);
        self.error = None;
        self.last_state = "opening".into();
        self.save()
    }
    fn advance(&mut self, automatic: bool) -> Result<(), String> {
        let index = self
            .saved
            .playlist
            .iter()
            .position(|i| Some(i.id) == self.saved.current)
            .unwrap_or(0);
        if let Some(next) = model::next_index(
            index,
            self.saved.playlist.len(),
            &self.saved.repeat,
            automatic,
        ) {
            let id = self.saved.playlist[next].id;
            self.play(id)?;
        }
        Ok(())
    }
    fn tick(&mut self) {
        let playback = self.vlc.as_ref().map(Vlc::snapshot).unwrap_or_default();
        let state = playback.state;
        if state == "ended" && self.last_state != "ended" {
            if playback.duration == 0 && playback.time == 0 {
                self.error = Some(
                    "No playable media was found. The file may be damaged or unsupported.".into(),
                );
            } else if let Err(e) = self.advance(true) {
                self.error = Some(e);
            }
        }
        if state == "error" && self.last_state != "error" {
            self.error=Some("Playback failed. The file may be damaged, unsupported, or inaccessible. Try another file and check the libVLC plugins.".into());
        }
        self.last_state = state;
    }
}
#[derive(Deserialize)]
struct Action {
    kind: String,
    #[serde(default)]
    value: Option<f64>,
    #[serde(default)]
    text: Option<String>,
    #[serde(default)]
    id: Option<u64>,
}
#[tauri::command]
fn get_state(engine: State<Shared>) -> Result<Snapshot, String> {
    Ok(engine
        .lock()
        .map_err(|_| "Playback lock failed")?
        .snapshot())
}
#[tauri::command]
async fn open_paths(
    paths: Vec<String>,
    replace: bool,
    engine: State<'_, Shared>,
) -> Result<(), String> {
    let state = engine.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let files = model::expand_paths(paths)?;
        if files.is_empty() {
            return Ok(());
        }
        let mut e = state.lock().map_err(|_| "Playback lock failed")?;
        if e.saved.playlist.len() + files.len() > 10000 {
            return Err("Playlist exceeds 10,000 entries".into());
        }
        let was_empty = e.saved.playlist.is_empty();
        let mut id = e.saved.playlist.iter().map(|i| i.id).max().unwrap_or(0) + 1;
        let first = id;
        let items = files
            .into_iter()
            .map(|path| {
                let item = Item {
                    id,
                    path: path.to_string_lossy().into_owned(),
                    name: path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .into_owned(),
                };
                id += 1;
                item
            })
            .collect::<Vec<_>>();
        if replace {
            e.saved.playlist.clear();
        }
        e.saved.playlist.extend(items);
        e.save()?;
        if replace || was_empty {
            e.play(first)?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn action(action: Action, engine: State<'_, Shared>) -> Result<(), String> {
    let state = engine.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut e = state.lock().map_err(|_| "Playback lock failed")?;
        let number = action.value.unwrap_or(0.);
        if !number.is_finite() {
            return Err("Invalid numeric value".into());
        }
        match action.kind.as_str() {
            "play" => {
                let id = action
                    .id
                    .or(e.saved.current)
                    .or_else(|| e.saved.playlist.first().map(|i| i.id))
                    .ok_or("Open a media file first")?;
                e.play(id)?;
            }
            "toggle" => {
                let v = e.vlc.as_ref().ok_or("libVLC is unavailable")?;
                let s = v.snapshot().state;
                if s == "playing" {
                    v.pause(true)
                } else if s == "paused" {
                    v.pause(false)
                } else {
                    let id = e
                        .saved
                        .current
                        .or_else(|| e.saved.playlist.first().map(|i| i.id))
                        .ok_or("Open a media file first")?;
                    e.play(id)?;
                }
            }
            "stop" => {
                if let Some(v) = &e.vlc {
                    v.stop();
                }
                e.last_state = "stopped".into();
            }
            "next" => e.advance(false)?,
            "previous" => {
                let index = e
                    .saved
                    .playlist
                    .iter()
                    .position(|i| Some(i.id) == e.saved.current)
                    .unwrap_or(0);
                if let Some(item) = e.saved.playlist.get(index.saturating_sub(1)) {
                    let id = item.id;
                    e.play(id)?;
                }
            }
            "seek" => e.vlc.as_ref().ok_or("No player")?.seek(number as i64)?,
            "volume" => {
                e.saved.volume = (number as i32).clamp(0, 100);
                if let Some(v) = &e.vlc {
                    v.volume(e.saved.volume, e.saved.muted);
                }
            }
            "mute" => {
                e.saved.muted = !e.saved.muted;
                if let Some(v) = &e.vlc {
                    v.volume(e.saved.volume, e.saved.muted);
                }
            }
            "rate" => {
                if !(0.25..=4.).contains(&number) {
                    return Err("Rate must be between 0.25 and 4".into());
                }
                if let Some(v) = &e.vlc {
                    v.rate(number as f32)?;
                }
                e.saved.rate = number as f32;
            }
            "aspect" => {
                let aspect = action.text.unwrap_or_default();
                if !["", "16:9", "4:3", "1:1", "21:9"].contains(&aspect.as_str()) {
                    return Err("Unsupported aspect ratio".into());
                }
                if let Some(v) = &e.vlc {
                    v.aspect(&aspect);
                }
                e.saved.aspect = aspect;
            }
            "repeat" => {
                let repeat = action.text.unwrap_or_default();
                if !["off", "all", "one"].contains(&repeat.as_str()) {
                    return Err("Invalid repeat mode".into());
                }
                e.saved.repeat = repeat;
            }
            "audio" | "subtitle" => e
                .vlc
                .as_ref()
                .ok_or("No player")?
                .track(&action.kind, number as i32)?,
            "remove" => {
                let id = action.id.ok_or("Missing item")?;
                if e.saved.current == Some(id) {
                    if let Some(v) = &e.vlc {
                        v.stop();
                    }
                    e.saved.current = None;
                }
                e.saved.playlist.retain(|i| i.id != id);
            }
            "move_up" | "move_down" => {
                let id = action.id.ok_or("Missing item")?;
                let index = e
                    .saved
                    .playlist
                    .iter()
                    .position(|i| i.id == id)
                    .ok_or("Item not found")?;
                let to = if action.kind == "move_up" {
                    index.saturating_sub(1)
                } else {
                    (index + 1).min(e.saved.playlist.len() - 1)
                };
                e.saved.playlist.swap(index, to);
            }
            "clear" => {
                if let Some(v) = &e.vlc {
                    v.stop();
                }
                e.saved.playlist.clear();
                e.saved.current = None;
            }
            "dismiss_error" => {
                e.error = None;
                return Ok(());
            }
            _ => return Err("Unknown player command".into()),
        }
        e.save()?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn pick_files(subtitle: bool) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dialog = rfd::FileDialog::new();
        if subtitle {
            Ok(dialog
                .add_filter("Subtitles", &["srt", "ass", "ssa", "vtt", "sub"])
                .pick_file()
                .into_iter()
                .map(|p| p.to_string_lossy().into_owned())
                .collect())
        } else {
            Ok(dialog
                .set_title("Open media or a local M3U playlist")
                .pick_files()
                .unwrap_or_default()
                .into_iter()
                .map(|p| p.to_string_lossy().into_owned())
                .collect())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn load_subtitle(path: String, engine: State<'_, Shared>) -> Result<(), String> {
    let state = engine.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let path = PathBuf::from(path);
        if !path.is_absolute() || !path.is_file() {
            return Err("Subtitle file is missing".into());
        }
        let e = state.lock().map_err(|_| "Playback lock failed")?;
        if e.saved.current.is_none() {
            return Err("Open media before adding subtitles".into());
        }
        e.vlc.as_ref().ok_or("No player")?.subtitle(&path)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn export_playlist(engine: State<'_, Shared>) -> Result<(), String> {
    let entries = engine
        .lock()
        .map_err(|_| "Playback lock failed")?
        .saved
        .playlist
        .clone();
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(path) = rfd::FileDialog::new()
            .add_filter("M3U8 playlist", &["m3u8"])
            .set_file_name("playlist.m3u8")
            .save_file()
        {
            let mut text = String::from("#EXTM3U\n");
            for item in entries {
                if item.path.contains(['\n', '\r']) {
                    return Err(
                        "A filename contains a line break and cannot be exported to M3U".into(),
                    );
                }
                text.push_str(&item.path);
                text.push('\n');
            }
            std::fs::write(path, text).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn place_video(
    window: tauri::WebviewWindow,
    rect: surface::Rect,
    app: tauri::AppHandle,
) -> Result<(), String> {
    if ![rect.x, rect.y, rect.width, rect.height]
        .iter()
        .all(|n| n.is_finite())
        || rect.width < 0.
        || rect.height < 0.
    {
        return Err("Invalid video bounds".into());
    }
    let (tx, rx) = std::sync::mpsc::channel();
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let result = (|| {
            let surface = handle.state::<surface::Surface>();
            let drawable = surface.place(&window, rect)?;
            let e = handle.state::<Shared>();
            let e = e.lock().map_err(|_| "Playback lock failed")?;
            if let Some(v) = &e.vlc {
                v.attach(drawable)?;
            }
            Ok::<(), String>(())
        })();
        let _ = tx.send(result);
    })
    .map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || rx.recv().map_err(|e| e.to_string())?)
        .await
        .map_err(|e| e.to_string())?
}
fn main() {
    tauri::Builder::default()
        .manage(surface::Surface::default())
        .setup(|app| {
            let config = std::env::var_os("ASTER_CONFIG_DIR")
                .map(PathBuf::from)
                .unwrap_or(app.path().app_config_dir()?)
                .join("settings.json");
            let (saved, error, persist_allowed) = match Saved::read(&config) {
                Ok(s) => (s, None, true),
                Err(e) => (Saved::default(), Some(e), false),
            };
            let resource = app.path().resource_dir()?;
            let (vlc, error) = match Vlc::load(&resource) {
                Ok(v) => (Some(v), error),
                Err(e) => (None, Some(e)),
            };
            let state = Arc::new(Mutex::new(Engine {
                vlc,
                saved,
                path: config,
                error,
                persist_allowed,
                last_state: String::new(),
            }));
            app.manage(state.clone());
            let handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(Duration::from_millis(250));
                let mut e = match state.lock() {
                    Ok(e) => e,
                    Err(_) => break,
                };
                e.tick();
                let snapshot = e.snapshot();
                drop(e);
                if handle.get_webview_window("main").is_none() {
                    break;
                }
                let _ = handle.emit("player-state", snapshot);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_state,
            open_paths,
            action,
            pick_files,
            load_subtitle,
            export_playlist,
            place_video
        ])
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                if let Some(state) = window.try_state::<Shared>() {
                    if let Ok(mut e) = state.lock() {
                        if let Some(v) = &e.vlc {
                            v.stop();
                        }
                        let _ = e.save();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("Aster Player failed to start");
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    #[test]
    #[ignore = "requires staged libVLC and npm run fixtures"]
    fn native_engine_playback_and_error_handling() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        std::env::set_var(
            "LIBVLC_DIR",
            root.join(if cfg!(target_os = "macos") {
                "resources/vlc-3.0.24/lib"
            } else {
                "resources/vlc-3.0.24"
            }),
        );
        std::env::set_var("ASTER_TEST_HEADLESS", "1");
        let dir = tempfile::tempdir().unwrap();
        let runtime = Vlc::load(&root.join("resources")).unwrap();
        assert!(runtime.version.starts_with("3.0.24"));
        let mut engine = Engine {
            vlc: Some(runtime),
            saved: Saved::default(),
            path: dir.path().join("settings.json"),
            error: None,
            persist_allowed: true,
            last_state: String::new(),
        };
        for (index, name) in ["tone.wav", "color-motion.avi", "corrupt.mp4"]
            .iter()
            .enumerate()
        {
            let path = root.parent().unwrap().join("work/fixtures").join(name);
            assert!(
                path.is_file(),
                "Run npm run fixtures before native integration tests"
            );
            engine.saved.playlist.push(Item {
                id: index as u64 + 1,
                path: path.to_string_lossy().into_owned(),
                name: name.to_string(),
            });
        }
        for id in [1, 2] {
            engine.play(id).unwrap();
            let mut snap = engine.snapshot();
            for _ in 0..100 {
                std::thread::sleep(Duration::from_millis(50));
                snap = engine.snapshot();
                if snap.playback.state == "playing" && snap.playback.duration > 0 {
                    break;
                }
            }
            assert_eq!(snap.playback.state, "playing");
            assert_eq!(snap.playback.duration, 6000);
            let v = engine.vlc.as_ref().unwrap();
            v.pause(true);
            std::thread::sleep(Duration::from_millis(150));
            assert_eq!(v.snapshot().state, "paused");
            v.seek(2000).unwrap();
            std::thread::sleep(Duration::from_millis(100));
            assert!((v.snapshot().time - 2000).abs() < 500);
            v.rate(1.5).unwrap();
            v.volume(50, true);
            v.aspect("16:9");
            if id == 2 {
                v.subtitle(&root.parent().unwrap().join("work/fixtures/English.srt"))
                    .unwrap();
                v.pause(false);
                std::thread::sleep(Duration::from_millis(250));
                let tracks = v.snapshot().subtitle_tracks;
                assert!(
                    tracks.iter().any(|t| t.id >= 0),
                    "Subtitle should be exposed by libVLC"
                );
            }
            v.stop();
        }
        engine.play(3).unwrap();
        for _ in 0..100 {
            std::thread::sleep(Duration::from_millis(50));
            engine.tick();
            if engine.error.is_some() {
                break;
            }
        }
        assert!(
            engine.error.is_some(),
            "Invalid media must produce an actionable error"
        );
        let restored = Saved::read(&engine.path).unwrap();
        assert_eq!(restored.playlist.len(), 3);
    }
}
