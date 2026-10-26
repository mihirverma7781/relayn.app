use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};
#[derive(Clone, Serialize, Deserialize, Debug, PartialEq)]
pub struct Item {
    pub id: u64,
    pub path: String,
    pub name: String,
}
#[derive(Clone, Serialize, Deserialize, Debug, PartialEq)]
#[serde(default)]
pub struct VideoAdjustments {
    pub brightness: f32,
    pub contrast: f32,
    pub saturation: f32,
    pub gamma: f32,
    pub hue: f32,
    pub invert: bool,
}
impl Default for VideoAdjustments {
    fn default() -> Self {
        Self {
            brightness: 0.,
            contrast: 100.,
            saturation: 100.,
            gamma: 1.,
            hue: 0.,
            invert: false,
        }
    }
}
impl VideoAdjustments {
    pub fn validate(&self) -> Result<(), String> {
        for (value, min, max) in [
            (self.brightness, -100., 100.),
            (self.contrast, 0., 200.),
            (self.saturation, 0., 300.),
            (self.gamma, 0.2, 5.),
            (self.hue, 0., 360.),
        ] {
            if !value.is_finite() || !(min..=max).contains(&value) {
                return Err("Video adjustment is outside its supported range".into());
            }
        }
        if self.invert {
            return Err("Color inversion is not supported by this native adjustment filter".into());
        }
        Ok(())
    }
}
#[derive(Clone, Serialize, Deserialize, Debug, PartialEq)]
#[serde(default)]
pub struct Equalizer {
    pub enabled: bool,
    pub bands: Vec<f32>,
    pub preamp: f32,
}
impl Default for Equalizer {
    fn default() -> Self {
        Self {
            enabled: false,
            bands: vec![0.; 10],
            preamp: 0.,
        }
    }
}
impl Equalizer {
    pub fn validate(&self) -> Result<(), String> {
        if self.bands.len() != 10
            || self
                .bands
                .iter()
                .chain(std::iter::once(&self.preamp))
                .any(|v| !v.is_finite() || !(-20. ..=20.).contains(v))
        {
            return Err(
                "Equalizer requires ten finite bands and a preamp between -20 and +20 dB".into(),
            );
        }
        Ok(())
    }
}
pub const ASPECTS: &[&str] = &[
    "", "16:9", "16:10", "4:3", "1:1", "2.35:1", "2.39:1", "21:9",
];
pub fn network_url(raw: &str) -> Result<url::Url, String> {
    if raw.len() > 8192 {
        return Err("Network address is too long".into());
    }
    let parsed =
        url::Url::parse(raw.trim()).map_err(|_| "Enter a complete HTTP, HTTPS or RTSP URL")?;
    if !["http", "https", "rtsp"].contains(&parsed.scheme()) || parsed.host_str().is_none() {
        return Err("Only HTTP, HTTPS and RTSP network streams are supported".into());
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(
            "Credentials in stream URLs are not supported; use a public stream address".into(),
        );
    }
    Ok(parsed)
}
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(default)]
pub struct Saved {
    pub volume: i32,
    pub muted: bool,
    pub rate: f32,
    pub repeat: String,
    pub aspect: String,
    pub playlist: Vec<Item>,
    pub current: Option<u64>,
    pub crop: String,
    pub shuffle: bool,
    pub video_adjustments: VideoAdjustments,
    pub equalizer: Equalizer,
}
impl Default for Saved {
    fn default() -> Self {
        Self {
            volume: 80,
            muted: false,
            rate: 1.,
            repeat: "off".into(),
            aspect: String::new(),
            playlist: vec![],
            current: None,
            crop: String::new(),
            shuffle: false,
            video_adjustments: VideoAdjustments::default(),
            equalizer: Equalizer::default(),
        }
    }
}
impl Saved {
    pub fn normalize(&mut self) {
        self.volume = self.volume.clamp(0, 150);
        if !self.rate.is_finite() || !(0.25..=4.).contains(&self.rate) {
            self.rate = 1.;
        }
        if !["off", "all", "one"].contains(&self.repeat.as_str()) {
            self.repeat = "off".into();
        }
        if !ASPECTS.contains(&self.aspect.as_str()) {
            self.aspect.clear();
        }
        if !ASPECTS.contains(&self.crop.as_str()) {
            self.crop.clear();
        }
        if self.video_adjustments.validate().is_err() {
            self.video_adjustments = VideoAdjustments::default();
        }
        if self.equalizer.validate().is_err() {
            self.equalizer = Equalizer::default();
        }
        self.playlist.truncate(10000);
        self.playlist.retain(|item| {
            !item.path.is_empty()
                && item.path.len() <= 32768
                && !item.path.contains('\0')
                && if item.path.contains("://") {
                    network_url(&item.path).is_ok()
                } else {
                    Path::new(&item.path).is_absolute()
                }
        });
        let old_current = self.current;
        let mut repaired_current = None;
        let mut used = HashSet::new();
        let mut next = 1;
        for item in &mut self.playlist {
            let original_id = item.id;
            if item.id == 0 || item.id > 9_007_199_254_740_991 || !used.insert(item.id) {
                while used.contains(&next) {
                    next += 1;
                }
                item.id = next;
                used.insert(next);
            }
            if Some(original_id) == old_current && repaired_current.is_none() {
                repaired_current = Some(item.id);
            }
            if item.name.is_empty() || item.name.contains('\0') {
                item.name = Path::new(&item.path)
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into_owned();
            }
        }
        self.current = repaired_current;
        if !self.playlist.iter().any(|i| Some(i.id) == self.current) {
            self.current = None;
        }
    }
    pub fn read(path: &Path) -> Result<Self, String> {
        if !path.exists() {
            return Ok(Self::default());
        }
        let file = fs::File::open(path).map_err(|e| format!("Cannot read saved settings: {e}"))?;
        let mut b = Vec::new();
        file.take(8 * 1024 * 1024 + 1)
            .read_to_end(&mut b)
            .map_err(|e| format!("Cannot read saved settings: {e}"))?;
        if b.len() > 8 * 1024 * 1024 {
            return Err("Saved settings exceed size limit".into());
        }
        let mut saved: Self = serde_json::from_slice(&b).map_err(|e| {
            format!("Settings could not be read; the original file was preserved: {e}")
        })?;
        saved.normalize();
        Ok(saved)
    }
    pub fn write(&self, path: &Path) -> Result<(), String> {
        let parent = path.parent().ok_or("Invalid settings path")?;
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        let mut file = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
        serde_json::to_writer_pretty(&mut file, self).map_err(|e| e.to_string())?;
        file.flush().map_err(|e| e.to_string())?;
        file.as_file().sync_all().map_err(|e| e.to_string())?;
        file.persist(path)
            .map_err(|e| format!("Could not save settings: {e}"))?;
        Ok(())
    }
}
pub fn expand_paths(paths: Vec<String>) -> Result<Vec<PathBuf>, String> {
    let mut result = vec![];
    for raw in paths {
        let path = PathBuf::from(raw);
        if !path.is_absolute() {
            return Err("Only absolute local file paths are accepted".into());
        }
        if !path.is_file() {
            return Err(format!("File not found: {}", path.display()));
        }
        let ext = path
            .extension()
            .and_then(|v| v.to_str())
            .unwrap_or("")
            .to_lowercase();
        if ext == "m3u" || ext == "m3u8" {
            let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
            if meta.len() > 2 * 1024 * 1024 {
                return Err("Playlist is too large (maximum 2 MB)".into());
            }
            let text =
                fs::read_to_string(&path).map_err(|e| format!("Playlist must be UTF-8: {e}"))?;
            for line in text
                .trim_start_matches('\u{feff}')
                .lines()
                .map(str::trim)
                .filter(|s| !s.is_empty() && !s.starts_with('#'))
            {
                if line.contains("://") {
                    return Err("This MVP supports local playlist entries only".into());
                }
                let entry = PathBuf::from(line);
                let entry = if entry.is_absolute() {
                    entry
                } else {
                    path.parent().unwrap().join(entry)
                };
                if !entry.is_file() {
                    return Err(format!("Playlist entry not found: {}", entry.display()));
                }
                result.push(entry);
                if result.len() > 10000 {
                    return Err("Playlist exceeds 10,000 entries".into());
                }
            }
        } else {
            result.push(path);
        }
        if result.len() > 10000 {
            return Err("Playlist exceeds 10,000 entries".into());
        }
    }
    Ok(result)
}
pub fn next_index(current: usize, len: usize, repeat: &str, automatic: bool) -> Option<usize> {
    if len == 0 {
        return None;
    }
    if automatic && repeat == "one" {
        return Some(current);
    }
    if current + 1 < len {
        Some(current + 1)
    } else if repeat == "all" {
        Some(0)
    } else {
        None
    }
}
pub fn folder_media(root: &Path) -> Result<Vec<PathBuf>, String> {
    if !root.is_absolute() || !root.is_dir() {
        return Err("Choose an existing absolute media folder".into());
    }
    let mut pending = vec![(root.to_path_buf(), 0)];
    let mut files = Vec::new();
    let mut examined = 0;
    while let Some((dir, depth)) = pending.pop() {
        if depth > 64 {
            return Err("Folder nesting exceeds 64 levels".into());
        }
        for entry in
            fs::read_dir(&dir).map_err(|e| format!("Cannot read {}: {e}", dir.display()))?
        {
            let entry = entry.map_err(|e| e.to_string())?;
            examined += 1;
            if examined > 200000 {
                return Err("Folder scan exceeds 200,000 entries; choose a smaller folder".into());
            }
            let kind = entry.file_type().map_err(|e| e.to_string())?;
            // Do not follow links outside the explicitly selected tree or into cycles.
            if kind.is_symlink() {
                continue;
            }
            if kind.is_dir() {
                pending.push((entry.path(), depth + 1));
                continue;
            }
            if !kind.is_file() {
                continue;
            }
            let ext = entry
                .path()
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();
            if [
                "mp4", "mkv", "avi", "mov", "m4v", "webm", "wmv", "mpg", "mpeg", "ts", "m2ts",
                "vob", "ogv", "3gp", "flv", "mp3", "flac", "wav", "m4a", "aac", "ogg", "opus",
                "wma", "aiff", "aif", "ape", "alac", "ac3", "mka",
            ]
            .contains(&ext.as_str())
            {
                files.push(entry.path());
                if files.len() > 10000 {
                    return Err("Folder contains more than 10,000 media files".into());
                }
            }
        }
    }
    files.sort();
    Ok(files)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn advances_without_wrapping_unless_requested() {
        assert_eq!(next_index(1, 2, "off", true), None);
        assert_eq!(next_index(1, 2, "all", true), Some(0));
        assert_eq!(next_index(1, 2, "one", true), Some(1));
        assert_eq!(next_index(0, 2, "one", false), Some(1));
    }
    #[test]
    fn legacy_settings_receive_real_effect_defaults() {
        let mut saved: Saved =
            serde_json::from_str(r#"{"volume":125,"aspect":"16:10","playlist":[]}"#).unwrap();
        saved.normalize();
        assert_eq!(saved.volume, 125);
        assert_eq!(saved.aspect, "16:10");
        assert!(!saved.shuffle);
        assert!(!saved.equalizer.enabled);
        assert_eq!(saved.equalizer.bands.len(), 10);
        assert_eq!(saved.video_adjustments, VideoAdjustments::default());
    }
    #[test]
    fn malformed_effects_are_rejected_and_saved_values_are_repaired() {
        let invalid_eq = Equalizer {
            bands: vec![0.; 9],
            ..Default::default()
        };
        assert!(invalid_eq.validate().is_err());
        assert!(Equalizer {
            preamp: f32::INFINITY,
            ..Default::default()
        }
        .validate()
        .is_err());
        assert!(VideoAdjustments {
            gamma: 0.,
            ..Default::default()
        }
        .validate()
        .is_err());
        assert!(VideoAdjustments {
            invert: true,
            ..Default::default()
        }
        .validate()
        .is_err());
        let mut saved = Saved {
            equalizer: invalid_eq,
            crop: "fill".into(),
            video_adjustments: VideoAdjustments {
                contrast: 300.,
                ..Default::default()
            },
            ..Default::default()
        };
        saved.normalize();
        assert_eq!(saved.equalizer, Equalizer::default());
        assert_eq!(saved.video_adjustments, VideoAdjustments::default());
        assert_eq!(saved.crop, "");
    }
    #[test]
    fn folder_import_is_recursive_filtered_and_sorted() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join("album")).unwrap();
        fs::write(dir.path().join("album/b.FLAC"), b"fixture").unwrap();
        fs::write(dir.path().join("a.mp4"), b"fixture").unwrap();
        fs::write(dir.path().join("notes.txt"), b"not media").unwrap();
        fs::write(
            dir.path().join("external.m3u8"),
            "https://example.com/media",
        )
        .unwrap();
        assert_eq!(
            folder_media(dir.path()).unwrap(),
            vec![dir.path().join("a.mp4"), dir.path().join("album/b.FLAC")]
        );
        assert!(folder_media(Path::new("relative")).is_err());
    }
    #[test]
    fn oversized_and_corrupt_settings_are_preserved() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        fs::write(&path, b"{broken").unwrap();
        assert!(Saved::read(&path).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"{broken");
        let file = fs::File::create(&path).unwrap();
        file.set_len(8 * 1024 * 1024 + 1).unwrap();
        assert!(Saved::read(&path).unwrap_err().contains("size limit"));
    }
    #[test]
    fn network_addresses_require_explicit_supported_public_url_shape() {
        assert_eq!(
            network_url(" https://example.com/video.mp4 ")
                .unwrap()
                .host_str(),
            Some("example.com")
        );
        assert!(network_url("rtsp://192.168.1.10:8554/live").is_ok());
        for input in [
            "file:///C:/secret.txt",
            "ftp://example.com/file",
            "smb://host/share",
            "https://user:password@example.com/live",
            "C:/movie.mp4",
            "javascript:alert(1)",
            "http://",
        ] {
            assert!(network_url(input).is_err(), "Accepted {input}");
        }
        assert!(network_url(&format!("https://example.com/{}", "a".repeat(8192))).is_err());
    }
    #[test]
    fn saved_queue_repairs_ids_and_rejects_unsafe_sources() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("media.wav").to_string_lossy().into_owned();
        let mut saved = Saved {
            playlist: vec![
                Item {
                    id: 7,
                    path: path.clone(),
                    name: "first".into(),
                },
                Item {
                    id: 7,
                    path: path.clone(),
                    name: "duplicate".into(),
                },
                Item {
                    id: u64::MAX,
                    path: path.clone(),
                    name: "large".into(),
                },
                Item {
                    id: 9,
                    path: "relative.wav".into(),
                    name: "relative".into(),
                },
                Item {
                    id: 10,
                    path: "ftp://example.com/media.wav".into(),
                    name: "unsupported".into(),
                },
                Item {
                    id: 11,
                    path: "https://user:secret@example.com/media.wav".into(),
                    name: "credential".into(),
                },
                Item {
                    id: 12,
                    path: "https://example.com/media.wav".into(),
                    name: "stream".into(),
                },
            ],
            current: Some(u64::MAX),
            ..Default::default()
        };
        saved.normalize();
        assert_eq!(saved.playlist.len(), 4);
        assert_eq!(
            saved
                .playlist
                .iter()
                .map(|item| item.id)
                .collect::<HashSet<_>>()
                .len(),
            4
        );
        assert_eq!(saved.current, Some(saved.playlist[2].id));
        assert!(saved
            .playlist
            .iter()
            .all(|item| item.id <= 9_007_199_254_740_991));
        let previous = saved.playlist.clone();
        saved.normalize();
        assert_eq!(
            saved.playlist, previous,
            "Normalizing must not churn valid identities"
        );
    }
    #[test]
    fn settings_clamp_untrusted_values() {
        let mut s = Saved {
            volume: 300,
            rate: f32::NAN,
            repeat: "invalid".into(),
            ..Default::default()
        };
        s.normalize();
        assert_eq!(s.volume, 150);
        assert_eq!(s.rate, 1.);
        assert_eq!(s.repeat, "off");
    }
    #[test]
    fn saves_and_restores_unicode() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let mut s = Saved::default();
        s.playlist.push(Item {
            id: 1,
            path: dir
                .path()
                .join("Música/日本語.mp4")
                .to_string_lossy()
                .into_owned(),
            name: "日本語.mp4".into(),
        });
        s.current = Some(1);
        s.write(&path).unwrap();
        s.volume = 32;
        s.write(&path).unwrap();
        let read = Saved::read(&path).unwrap();
        assert_eq!(read.volume, 32);
        assert_eq!(read.playlist, s.playlist);
    }
    #[test]
    fn relative_paths_are_rejected() {
        assert!(expand_paths(vec!["movie.mp4".into()]).is_err());
    }
    #[test]
    fn playlist_paths_are_relative_to_playlist() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("test.wav"), b"fixture").unwrap();
        fs::write(dir.path().join("list.m3u8"), "#EXTM3U\ntest.wav\n").unwrap();
        assert_eq!(
            expand_paths(vec![dir.path().join("list.m3u8").to_string_lossy().into()]).unwrap(),
            vec![dir.path().join("test.wav")]
        );
    }
}
