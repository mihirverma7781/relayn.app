use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};
#[derive(Clone, Serialize, Deserialize, Debug, PartialEq)]
pub struct Item {
    pub id: u64,
    pub path: String,
    pub name: String,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Saved {
    pub volume: i32,
    pub muted: bool,
    pub rate: f32,
    pub repeat: String,
    pub aspect: String,
    pub playlist: Vec<Item>,
    pub current: Option<u64>,
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
        }
    }
}
impl Saved {
    pub fn normalize(&mut self) {
        self.volume = self.volume.clamp(0, 100);
        if !self.rate.is_finite() || !(0.25..=4.).contains(&self.rate) {
            self.rate = 1.;
        }
        if !["off", "all", "one"].contains(&self.repeat.as_str()) {
            self.repeat = "off".into();
        }
        if !["", "16:9", "4:3", "1:1", "21:9"].contains(&self.aspect.as_str()) {
            self.aspect.clear();
        }
        self.playlist.truncate(10000);
        if !self.playlist.iter().any(|i| Some(i.id) == self.current) {
            self.current = None;
        }
    }
    pub fn read(path: &Path) -> Result<Self, String> {
        if !path.exists() {
            return Ok(Self::default());
        }
        let b = fs::read(path).map_err(|e| format!("Cannot read saved settings: {e}"))?;
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
    fn settings_clamp_untrusted_values() {
        let mut s = Saved {
            volume: 300,
            rate: f32::NAN,
            repeat: "invalid".into(),
            ..Default::default()
        };
        s.normalize();
        assert_eq!(s.volume, 100);
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
            path: "C:/Música/日本語.mp4".into(),
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
