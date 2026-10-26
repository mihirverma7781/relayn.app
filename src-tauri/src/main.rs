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
    loop_a: Option<i64>,
    loop_b: Option<i64>,
}
struct Engine {
    vlc: Option<Vlc>,
    saved: Saved,
    path: PathBuf,
    error: Option<String>,
    persist_allowed: bool,
    last_state: String,
    surface_handle: Arc<Mutex<usize>>,
    loop_a: Option<i64>,
    loop_b: Option<i64>,
    shuffle_remaining: Vec<u64>,
    shuffle_history: Vec<u64>,
    random_state: u64,
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
            loop_a: self.loop_a,
            loop_b: self.loop_b,
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
        if item.path.contains("://") {
            model::network_url(&item.path)?;
        } else if !std::path::Path::new(&item.path).is_file() {
            return Err(format!("File is missing or unavailable: {}", item.name));
        }
        let handle = self.surface_handle.lock().map(|h| *h).unwrap_or(0);
        let v = self.vlc.as_mut().ok_or("libVLC is not available")?;
        if handle != 0 {
            v.attach(handle)?;
        }
        v.open(&item.path)?;
        v.volume(self.saved.volume, self.saved.muted);
        v.rate(self.saved.rate)?;
        v.aspect(&self.saved.aspect);
        v.crop(&self.saved.crop)?;
        v.adjustments(&self.saved.video_adjustments)?;
        v.equalizer(&self.saved.equalizer)?;
        self.saved.current = Some(id);
        self.loop_a = None;
        self.loop_b = None;
        self.shuffle_remaining.retain(|next| *next != id);
        self.error = None;
        self.last_state = "opening".into();
        self.save()
    }
    fn advance(&mut self, automatic: bool) -> Result<(), String> {
        if self.saved.shuffle && !(automatic && self.saved.repeat == "one") {
            if self.shuffle_remaining.is_empty() && self.saved.repeat == "all" {
                self.refill_shuffle();
            }
            if let Some(id) = self.shuffle_remaining.pop() {
                let previous = self.saved.current;
                self.play(id)?;
                if let Some(previous) = previous {
                    self.shuffle_history.push(previous);
                    if self.shuffle_history.len() > 10000 {
                        self.shuffle_history.remove(0);
                    }
                }
            }
            return Ok(());
        }
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
    fn refill_shuffle(&mut self) {
        self.shuffle_remaining = self
            .saved
            .playlist
            .iter()
            .filter(|item| Some(item.id) != self.saved.current)
            .map(|item| item.id)
            .collect();
        for index in (1..self.shuffle_remaining.len()).rev() {
            self.random_state ^= self.random_state << 13;
            self.random_state ^= self.random_state >> 7;
            self.random_state ^= self.random_state << 17;
            let target = self.random_state as usize % (index + 1);
            self.shuffle_remaining.swap(index, target);
        }
        if self.shuffle_remaining.is_empty() && self.saved.repeat == "all" {
            if let Some(id) = self.saved.current {
                self.shuffle_remaining.push(id);
            }
        }
    }
    fn add_files(&mut self, files: Vec<PathBuf>, replace: bool) -> Result<(), String> {
        if files.is_empty() {
            return Ok(());
        }
        if files.len()
            + if replace {
                0
            } else {
                self.saved.playlist.len()
            }
            > 10000
        {
            return Err("Playlist exceeds 10,000 entries".into());
        }
        let was_empty = self.saved.playlist.is_empty();
        let mut id = self
            .saved
            .playlist
            .iter()
            .map(|item| item.id)
            .max()
            .unwrap_or(0)
            .checked_add(1)
            .ok_or("Playlist item IDs exhausted")?;
        // IDs cross JSON/JavaScript, so remain within its exact integer range.
        if id.saturating_add(files.len() as u64) > 9_007_199_254_740_991 {
            return Err("Playlist item IDs exhausted".into());
        }
        let first = id;
        let items = files
            .into_iter()
            .map(|path| {
                let item = Item {
                    id,
                    name: path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .into_owned(),
                    path: path.to_string_lossy().into_owned(),
                };
                id += 1;
                item
            })
            .collect::<Vec<_>>();
        if replace {
            self.saved.playlist.clear();
            self.saved.current = None;
            self.shuffle_history.clear();
        }
        self.saved.playlist.extend(items);
        self.save()?;
        if replace || was_empty {
            self.play(first)?;
        }
        if self.saved.shuffle {
            self.refill_shuffle();
        }
        Ok(())
    }
    fn add_network(&mut self, raw: &str, replace: bool) -> Result<(), String> {
        let url = model::network_url(raw)?;
        if !replace && self.saved.playlist.len() >= 10000 {
            return Err("Playlist exceeds 10,000 entries".into());
        }
        let id = self
            .saved
            .playlist
            .iter()
            .map(|item| item.id)
            .max()
            .unwrap_or(0)
            .checked_add(1)
            .filter(|id| *id <= 9_007_199_254_740_991)
            .ok_or("Playlist item IDs exhausted")?;
        let name = url
            .path_segments()
            .and_then(|mut segments| segments.next_back())
            .filter(|name| !name.is_empty())
            .unwrap_or_else(|| url.host_str().unwrap_or("Network stream"))
            .to_string();
        let was_empty = self.saved.playlist.is_empty();
        if replace {
            self.saved.playlist.clear();
            self.saved.current = None;
            self.shuffle_history.clear();
        }
        self.saved.playlist.push(Item {
            id,
            name,
            path: url.to_string(),
        });
        self.save()?;
        if replace || was_empty {
            self.play(id)?;
        }
        if self.saved.shuffle {
            self.refill_shuffle();
        }
        Ok(())
    }
    fn toggle_ab_loop(&mut self) -> Result<(), String> {
        let playback = self.vlc.as_ref().ok_or("No player")?.snapshot();
        if !playback.seekable || playback.duration <= 0 {
            return Err("A-B repeat requires seekable media".into());
        }
        if self.loop_b.is_some() {
            self.loop_a = None;
            self.loop_b = None;
        } else if let Some(a) = self.loop_a {
            if playback.time <= a + 100 {
                return Err("Point B must be after point A".into());
            }
            self.loop_b = Some(playback.time);
        } else {
            self.loop_a = Some(playback.time);
        }
        Ok(())
    }
    fn tick(&mut self) {
        let playback = self.vlc.as_ref().map(Vlc::snapshot).unwrap_or_default();
        let state = playback.state;
        if state == "playing" {
            if self.last_state != "playing" {
                if let Some(v) = &self.vlc {
                    let _ = v.crop(&self.saved.crop);
                    let _ = v.adjustments(&self.saved.video_adjustments);
                }
            }
            if let (Some(a), Some(b)) = (self.loop_a, self.loop_b) {
                if playback.time >= b {
                    if let Some(v) = &self.vlc {
                        if let Err(error) = v.seek(a) {
                            self.error = Some(error);
                        }
                    }
                }
            }
        }
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
        e.add_files(files, replace)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn action(action: Action, engine: State<'_, Shared>) -> Result<(), String> {
    if action.kind == "snapshot" {
        return save_snapshot(engine).await;
    }
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
                e.loop_a = None;
                e.loop_b = None;
            }
            "next" => e.advance(false)?,
            "previous" => {
                if e.saved.shuffle {
                    if let Some(id) = e.shuffle_history.pop() {
                        e.play(id)?;
                    }
                    return e.save();
                }
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
                e.saved.volume = (number as i32).clamp(0, 150);
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
                if !model::ASPECTS.contains(&aspect.as_str()) {
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
            "crop" => {
                let mut crop = action.text.unwrap_or_default();
                if crop == "none" {
                    crop.clear();
                }
                if !model::ASPECTS.contains(&crop.as_str()) {
                    return Err("Unsupported crop ratio".into());
                }
                e.vlc.as_ref().ok_or("No player")?.crop(&crop)?;
                e.saved.crop = crop;
            }
            "video_adjustments" => {
                let value: model::VideoAdjustments =
                    serde_json::from_str(&action.text.unwrap_or_default())
                        .map_err(|_| "Invalid video adjustments")?;
                value.validate()?;
                e.vlc.as_ref().ok_or("No player")?.adjustments(&value)?;
                e.saved.video_adjustments = value;
            }
            "equalizer" => {
                let value: model::Equalizer =
                    serde_json::from_str(&action.text.unwrap_or_default())
                        .map_err(|_| "Invalid equalizer values")?;
                value.validate()?;
                e.vlc.as_ref().ok_or("No player")?.equalizer(&value)?;
                e.saved.equalizer = value;
            }
            "shuffle" => {
                e.saved.shuffle = number != 0.;
                e.shuffle_history.clear();
                e.refill_shuffle();
            }
            "ab_loop" => e.toggle_ab_loop()?,
            "ab_clear" => {
                e.loop_a = None;
                e.loop_b = None;
            }
            "chapter" => {
                if number.fract() != 0. || number < 0. || number > i32::MAX as f64 {
                    return Err("Invalid chapter number".into());
                }
                e.vlc.as_ref().ok_or("No player")?.chapter(number as i32)?;
            }
            "next_chapter" | "previous_chapter" => {
                let v = e.vlc.as_ref().ok_or("No player")?;
                let p = v.snapshot();
                v.chapter(p.chapter + if action.kind == "next_chapter" { 1 } else { -1 })?;
            }
            "audio_channel" => {
                if number.fract() != 0. || !(1. ..=5.).contains(&number) {
                    return Err("Unsupported audio channel mode".into());
                }
                e.vlc
                    .as_ref()
                    .ok_or("No player")?
                    .audio_channel(number as i32)?;
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
                e.shuffle_remaining.retain(|next| *next != id);
                e.shuffle_history.retain(|next| *next != id);
                if e.saved.current.is_none() {
                    e.loop_a = None;
                    e.loop_b = None;
                }
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
                e.loop_a = None;
                e.loop_b = None;
                e.shuffle_remaining.clear();
                e.shuffle_history.clear();
            }
            "audio_delay" => {
                e.vlc
                    .as_ref()
                    .ok_or("No player")?
                    .set_audio_delay(number as i64)?;
            }
            "subtitle_delay" => {
                e.vlc
                    .as_ref()
                    .ok_or("No player")?
                    .set_subtitle_delay(number as i64)?;
            }
            "step_frame" => {
                e.vlc.as_ref().ok_or("No player")?.next_frame()?;
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
async fn open_folder(replace: bool, engine: State<'_, Shared>) -> Result<(), String> {
    let state = engine.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let Some(folder) = rfd::FileDialog::new()
            .set_title("Open media folder")
            .pick_folder()
        else {
            return Ok(());
        };
        let files = model::folder_media(&folder)?;
        if files.is_empty() {
            return Err("No supported media files were found in this folder".into());
        }
        state
            .lock()
            .map_err(|_| "Playback lock failed")?
            .add_files(files, replace)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn open_network(url: String, replace: bool, engine: State<'_, Shared>) -> Result<(), String> {
    model::network_url(&url)?;
    let state = engine.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        state
            .lock()
            .map_err(|_| "Playback lock failed")?
            .add_network(&url, replace)
    })
    .await
    .map_err(|e| e.to_string())?
}
async fn save_snapshot(engine: State<'_, Shared>) -> Result<(), String> {
    // Validate before showing a dialog; reacquire state afterwards so a stale file cannot be captured.
    let current = {
        let e = engine.lock().map_err(|_| "Playback lock failed")?;
        e.vlc.as_ref().ok_or("No player")?.require_video()?;
        e.saved.current
    };
    let state = engine.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let Some(path) = rfd::FileDialog::new()
            .set_title("Save video snapshot")
            .add_filter("PNG image", &["png"])
            .set_file_name("RelayN-snapshot.png")
            .save_file()
        else {
            return Ok(());
        };
        let e = state.lock().map_err(|_| "Playback lock failed")?;
        if e.saved.current != current {
            return Err("Media changed while choosing a snapshot location; try again".into());
        }
        e.vlc
            .as_ref()
            .ok_or("No player")?
            .take_snapshot(&path.to_string_lossy())
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
    let surface = surface::Surface::default();
    let surface_handle = surface.handle.clone();
    tauri::Builder::default()
        .manage(surface)
        .setup(move |app| {
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
                surface_handle,
                loop_a: None,
                loop_b: None,
                shuffle_remaining: Vec::new(),
                shuffle_history: Vec::new(),
                random_state: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_nanos() as u64)
                    .unwrap_or(1)
                    | 1,
            }));
            if let Ok(mut e) = state.lock() {
                if e.saved.shuffle {
                    e.refill_shuffle();
                }
            }
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
            open_folder,
            open_network,
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
    fn fixture_engine() -> Engine {
        Engine {
            vlc: None,
            saved: Saved::default(),
            path: PathBuf::new(),
            error: None,
            persist_allowed: false,
            last_state: String::new(),
            surface_handle: Arc::new(Mutex::new(0)),
            loop_a: None,
            loop_b: None,
            shuffle_remaining: Vec::new(),
            shuffle_history: Vec::new(),
            random_state: 123456789,
        }
    }
    #[test]
    fn shuffle_bag_contains_each_other_item_once() {
        let mut e = fixture_engine();
        e.saved.playlist = (1..=50)
            .map(|id| Item {
                id,
                path: format!("file{id}.wav"),
                name: format!("file{id}"),
            })
            .collect();
        e.saved.current = Some(10);
        e.refill_shuffle();
        let mut sorted = e.shuffle_remaining.clone();
        sorted.sort();
        assert_eq!(sorted, (1..=50).filter(|id| *id != 10).collect::<Vec<_>>());
        assert_ne!(e.shuffle_remaining, sorted);
        e.saved.playlist.truncate(1);
        e.saved.current = Some(1);
        e.saved.repeat = "all".into();
        e.refill_shuffle();
        assert_eq!(e.shuffle_remaining, vec![1]);
    }
    #[test]
    fn invalid_network_open_preserves_local_queue() {
        let mut e = fixture_engine();
        e.saved.playlist.push(Item {
            id: 1,
            path: "C:/media.wav".into(),
            name: "media.wav".into(),
        });
        e.saved.current = Some(1);
        assert!(e.add_network("file:///C:/private.txt", true).is_err());
        assert_eq!(e.saved.playlist.len(), 1);
        assert_eq!(e.saved.current, Some(1));
        assert!(e
            .add_network("https://user:password@example.com", true)
            .is_err());
        assert_eq!(e.saved.playlist[0].path, "C:/media.wav");
    }
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
            surface_handle: Arc::new(Mutex::new(0)),
            loop_a: None,
            loop_b: None,
            shuffle_remaining: Vec::new(),
            shuffle_history: Vec::new(),
            random_state: 123456789,
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
            for _ in 0..100 {
                if v.snapshot().state == "paused" {
                    break;
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            assert_eq!(v.snapshot().state, "paused");
            v.seek(2000).unwrap();
            for _ in 0..100 {
                if (v.snapshot().time - 2000).abs() < 500 {
                    break;
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            assert!((v.snapshot().time - 2000).abs() < 500);
            v.rate(1.5).unwrap();
            v.volume(50, true);
            v.aspect("16:9");
            let eq = model::Equalizer {
                enabled: true,
                bands: vec![2.; 10],
                preamp: -1.,
            };
            v.equalizer(&eq).unwrap();
            v.equalizer(&model::Equalizer::default()).unwrap();
            assert!(v
                .equalizer(&model::Equalizer {
                    bands: vec![0.; 11],
                    ..Default::default()
                })
                .is_err());
            assert!(v.set_audio_delay(i64::MAX).is_err());
            assert_eq!(v.snapshot().chapter_count, 0);
            assert!(v.chapter(0).is_err());
            assert!(v.chapter(-1).is_err());
            assert!(v.audio_channel(99).is_err());
            if id == 2 {
                let adjustments = model::VideoAdjustments {
                    brightness: 20.,
                    contrast: 120.,
                    saturation: 80.,
                    gamma: 1.2,
                    hue: 20.,
                    invert: false,
                };
                v.adjustments(&adjustments).unwrap();
                assert!((v.adjustment_value(1) - 1.2).abs() < 0.01);
                assert!((v.adjustment_value(2) - 1.2).abs() < 0.01);
                assert!((v.adjustment_value(3) - 20.).abs() < 0.01);
                assert!((v.adjustment_value(4) - 0.8).abs() < 0.01);
                assert!((v.adjustment_value(5) - 1.2).abs() < 0.01);
                v.crop("16:9").unwrap();
                assert!(v.crop("fill").is_err());
                v.crop("").unwrap();
                v.adjustments(&model::VideoAdjustments::default()).unwrap();
                v.subtitle(&root.parent().unwrap().join("work/fixtures/English.srt"))
                    .unwrap();
                v.pause(false);
                for _ in 0..100 {
                    if v.snapshot().subtitle_tracks.iter().any(|t| t.id >= 0) {
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(50));
                }
                let tracks = v.snapshot().subtitle_tracks;
                assert!(
                    tracks.iter().any(|t| t.id >= 0),
                    "Subtitle should be exposed by libVLC"
                );
            }
            v.stop();
        }
        // Exercise A/B repeat in the Rust worker, independent of any WebView timer.
        engine.play(1).unwrap();
        for _ in 0..100 {
            let p = engine.snapshot().playback;
            if p.state == "playing" && p.seekable {
                break;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        engine.vlc.as_ref().unwrap().pause(true);
        for _ in 0..100 {
            if engine.snapshot().playback.state == "paused" {
                break;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        engine.vlc.as_ref().unwrap().seek(1000).unwrap();
        for _ in 0..100 {
            if (engine.snapshot().playback.time - 1000).abs() < 100 {
                break;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        engine.toggle_ab_loop().unwrap();
        assert!(engine.loop_a.is_some());
        assert!(engine.toggle_ab_loop().is_err(), "B must follow A");
        engine.vlc.as_ref().unwrap().seek(2000).unwrap();
        for _ in 0..100 {
            if (engine.snapshot().playback.time - 2000).abs() < 100 {
                break;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        engine.toggle_ab_loop().unwrap();
        assert!(engine.loop_b.unwrap() > engine.loop_a.unwrap());
        engine.vlc.as_ref().unwrap().pause(false);
        for _ in 0..100 {
            engine.tick();
            if engine.snapshot().playback.time < 1500 {
                break;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        assert!(
            engine.snapshot().playback.time < 1500,
            "Native A/B worker should seek to A"
        );
        engine.toggle_ab_loop().unwrap();
        assert_eq!((engine.loop_a, engine.loop_b), (None, None));
        // Replacing a full old queue must count the replacement, not old + new.
        let fixture = root.parent().unwrap().join("work/fixtures/tone.wav");
        engine.saved.playlist = (1..=10000)
            .map(|id| Item {
                id,
                path: fixture.to_string_lossy().into_owned(),
                name: "tone.wav".into(),
            })
            .collect();
        engine.add_files(vec![fixture], true).unwrap();
        assert_eq!(engine.saved.playlist.len(), 1);
        assert_eq!(engine.saved.current, Some(engine.saved.playlist[0].id));
        // Restore corrupt media as a final fixture for the existing error assertion.
        engine.saved.playlist.push(Item {
            id: 3,
            path: root
                .parent()
                .unwrap()
                .join("work/fixtures/corrupt.mp4")
                .to_string_lossy()
                .into_owned(),
            name: "corrupt.mp4".into(),
        });
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
        assert_eq!(restored.playlist.len(), 2);
    }
}
