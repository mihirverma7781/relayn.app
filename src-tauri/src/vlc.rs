use crate::model::{Equalizer, VideoAdjustments};
use libloading::Library;
use serde::Serialize;
use std::{
    ffi::{c_char, c_int, c_void, CStr, CString},
    path::{Path, PathBuf},
    ptr,
};

type Ptr = *mut c_void;
#[repr(C)]
struct TrackDescription {
    id: c_int,
    name: *mut c_char,
    next: *mut TrackDescription,
}
macro_rules! api {
    ($($name:ident: $t:ty),* $(,)?) => {
        struct Api { $($name:$t),* }
        impl Api { unsafe fn load(lib:&Library)->Result<Self,String>{ Ok(Self{$($name:*lib.get::<$t>(concat!(stringify!($name),"\0").as_bytes()).map_err(|e|format!("Missing libVLC 3 API {}: {e}",stringify!($name)))?),*}) } }
    }
}
api! {
 libvlc_new:unsafe extern "C" fn(c_int,*const *const c_char)->Ptr,
 libvlc_release:unsafe extern "C" fn(Ptr),
 libvlc_get_version:unsafe extern "C" fn()->*const c_char,
 libvlc_media_player_new:unsafe extern "C" fn(Ptr)->Ptr,
 libvlc_media_player_release:unsafe extern "C" fn(Ptr),
 libvlc_media_new_path:unsafe extern "C" fn(Ptr,*const c_char)->Ptr,
 libvlc_media_new_location:unsafe extern "C" fn(Ptr,*const c_char)->Ptr,
 libvlc_media_release:unsafe extern "C" fn(Ptr),
 libvlc_media_get_meta:unsafe extern "C" fn(Ptr,c_int)->*mut c_char,
 libvlc_free:unsafe extern "C" fn(Ptr),
 libvlc_media_player_set_media:unsafe extern "C" fn(Ptr,Ptr),
 libvlc_media_player_play:unsafe extern "C" fn(Ptr)->c_int,
 libvlc_media_player_set_pause:unsafe extern "C" fn(Ptr,c_int),
 libvlc_media_player_stop:unsafe extern "C" fn(Ptr),
 libvlc_media_player_get_state:unsafe extern "C" fn(Ptr)->c_int,
 libvlc_media_player_get_time:unsafe extern "C" fn(Ptr)->i64,
 libvlc_media_player_get_length:unsafe extern "C" fn(Ptr)->i64,
 libvlc_media_player_set_time:unsafe extern "C" fn(Ptr,i64),
 libvlc_media_player_is_seekable:unsafe extern "C" fn(Ptr)->c_int,
 libvlc_media_player_get_rate:unsafe extern "C" fn(Ptr)->f32,
 libvlc_media_player_set_rate:unsafe extern "C" fn(Ptr,f32)->c_int,
 libvlc_audio_set_volume:unsafe extern "C" fn(Ptr,c_int)->c_int,
 libvlc_audio_set_mute:unsafe extern "C" fn(Ptr,c_int),
 libvlc_audio_get_track_description:unsafe extern "C" fn(Ptr)->*mut TrackDescription,
 libvlc_audio_get_track:unsafe extern "C" fn(Ptr)->c_int,
 libvlc_audio_set_track:unsafe extern "C" fn(Ptr,c_int)->c_int,
 libvlc_video_get_spu_description:unsafe extern "C" fn(Ptr)->*mut TrackDescription,
 libvlc_video_get_spu:unsafe extern "C" fn(Ptr)->c_int,
 libvlc_video_set_spu:unsafe extern "C" fn(Ptr,c_int)->c_int,
 libvlc_track_description_list_release:unsafe extern "C" fn(*mut TrackDescription),
 libvlc_media_player_add_slave:unsafe extern "C" fn(Ptr,c_int,*const c_char,c_int)->c_int,
 libvlc_video_set_aspect_ratio:unsafe extern "C" fn(Ptr,*const c_char),
 libvlc_video_set_key_input:unsafe extern "C" fn(Ptr,c_int),
 libvlc_video_set_mouse_input:unsafe extern "C" fn(Ptr,c_int),
 libvlc_audio_get_delay:unsafe extern "C" fn(Ptr)->i64,
 libvlc_audio_set_delay:unsafe extern "C" fn(Ptr,i64)->c_int,
 libvlc_video_get_spu_delay:unsafe extern "C" fn(Ptr)->i64,
 libvlc_video_set_spu_delay:unsafe extern "C" fn(Ptr,i64)->c_int,
 libvlc_video_take_snapshot:unsafe extern "C" fn(Ptr,c_int,*const c_char,c_int,c_int)->c_int,
 libvlc_media_player_next_frame:unsafe extern "C" fn(Ptr),
 libvlc_video_set_crop_geometry:unsafe extern "C" fn(Ptr,*const c_char),
 libvlc_video_set_adjust_int:unsafe extern "C" fn(Ptr,u32,c_int),
 libvlc_video_set_adjust_float:unsafe extern "C" fn(Ptr,u32,f32),
 libvlc_audio_equalizer_new:unsafe extern "C" fn()->Ptr,
 libvlc_audio_equalizer_release:unsafe extern "C" fn(Ptr),
 libvlc_audio_equalizer_set_amp_at_index:unsafe extern "C" fn(Ptr,f32,u32)->c_int,
 libvlc_audio_equalizer_set_preamp:unsafe extern "C" fn(Ptr,f32)->c_int,
 libvlc_media_player_set_equalizer:unsafe extern "C" fn(Ptr,Ptr)->c_int,
 libvlc_video_get_size:unsafe extern "C" fn(Ptr,u32,*mut u32,*mut u32)->c_int,
 libvlc_media_player_get_chapter_count:unsafe extern "C" fn(Ptr)->c_int,
 libvlc_media_player_get_chapter:unsafe extern "C" fn(Ptr)->c_int,
 libvlc_media_player_set_chapter:unsafe extern "C" fn(Ptr,c_int),
 libvlc_audio_get_channel:unsafe extern "C" fn(Ptr)->c_int,
 libvlc_audio_set_channel:unsafe extern "C" fn(Ptr,c_int)->c_int
}
#[derive(Clone, Serialize)]
pub struct Track {
    pub id: i32,
    pub name: String,
}
#[derive(Clone, Serialize, Default)]
pub struct Playback {
    pub state: String,
    pub time: i64,
    pub duration: i64,
    pub seekable: bool,
    pub rate: f32,
    pub audio_tracks: Vec<Track>,
    pub subtitle_tracks: Vec<Track>,
    pub audio_track: i32,
    pub subtitle_track: i32,
    pub audio_delay: i64,
    pub subtitle_delay: i64,
    pub chapter: i32,
    pub chapter_count: i32,
    pub audio_channel: i32,
    pub title: String,
    pub artist: String,
    pub album: String,
}
pub struct Vlc {
    api: Api,
    instance: Ptr,
    player: Ptr,
    media: Ptr,
    _core: Option<Library>,
    _lib: Library,
    pub version: String,
}
// Access is serialized by Engine's mutex. No libVLC callback touches Rust or the UI.
unsafe impl Send for Vlc {}

fn library_path(dir: &Path, filename: &str) -> Option<PathBuf> {
    let direct = dir.join(filename);
    if direct.is_file() {
        return Some(direct);
    }
    #[cfg(target_os = "macos")]
    {
        let prefix = filename.strip_suffix(".dylib")?;
        return std::fs::read_dir(dir)
            .ok()?
            .flatten()
            .map(|entry| entry.path())
            .find(|candidate| {
                candidate.is_file()
                    && candidate
                        .file_name()
                        .and_then(|name| name.to_str())
                        .is_some_and(|name| {
                            name.starts_with(&format!("{prefix}.")) && name.ends_with(".dylib")
                        })
            });
    }
    #[cfg(not(target_os = "macos"))]
    {
        None
    }
}
impl Vlc {
    pub fn load(resource_dir: &Path) -> Result<Self, String> {
        let mut dirs = Vec::<PathBuf>::new();
        if let Some(p) = std::env::var_os("LIBVLC_DIR") {
            dirs.push(p.into());
        }
        #[cfg(target_os = "macos")]
        dirs.push(resource_dir.join("vlc/lib"));
        dirs.push(resource_dir.join("vlc"));
        #[cfg(windows)]
        {
            dirs.push(PathBuf::from("C:/Program Files/VideoLAN/VLC"));
        }
        #[cfg(target_os = "macos")]
        {
            dirs.push(PathBuf::from("/Applications/VLC.app/Contents/MacOS/lib"));
        }
        let filename = if cfg!(windows) {
            "libvlc.dll"
        } else {
            "libvlc.dylib"
        };
        let (dir, lib_path) = dirs
            .into_iter()
            .find_map(|dir| library_path(&dir, filename).map(|lib| (dir, lib)))
            .ok_or("libVLC 3 is missing. Install VLC 3 matching this app's architecture, or set LIBVLC_DIR to its library directory.")?;
        let plugins = if dir.join("plugins").is_dir() {
            dir.join("plugins")
        } else {
            dir.parent().unwrap_or(&dir).join("plugins")
        };
        std::env::set_var("VLC_PLUGIN_PATH", plugins);
        unsafe {
            let core_name = if cfg!(windows) {
                "libvlccore.dll"
            } else {
                "libvlccore.dylib"
            };
            let core_path = library_path(&dir, core_name)
                .ok_or_else(|| format!("Cannot find libVLC core beside {}", lib_path.display()))?;
            let core = Some(
                Library::new(core_path)
                    .map_err(|e| format!("Cannot load libVLC core at {}: {e}", dir.display()))?,
            );
            let lib = Library::new(lib_path).map_err(|e| format!("Cannot load libVLC: {e}"))?;
            let api = Api::load(&lib)?;
            let version = CStr::from_ptr((api.libvlc_get_version)())
                .to_string_lossy()
                .into_owned();
            if !version.starts_with("3.") {
                return Err(format!("libVLC 3 required; found {version}"));
            }
            let mut args = vec![
                CString::new("--no-video-title-show").unwrap(),
                CString::new("--no-metadata-network-access").unwrap(),
                CString::new("--no-stats").unwrap(),
            ];
            #[cfg(target_os = "macos")]
            {
                args.push(CString::new("--no-videotoolbox").unwrap());
                args.push(CString::new("--avcodec-hw=none").unwrap());
            }
            if std::env::var_os("ASTER_TEST_HEADLESS").is_some() {
                args.push(CString::new("--vout=dummy").unwrap());
                args.push(CString::new("--aout=dummy").unwrap());
            }
            let argv: Vec<_> = args.iter().map(|a| a.as_ptr()).collect();
            let instance = (api.libvlc_new)(argv.len() as i32, argv.as_ptr());
            if instance.is_null() {
                return Err(
                    "libVLC initialization failed. Verify the runtime and plugins directory."
                        .into(),
                );
            }
            let player = (api.libvlc_media_player_new)(instance);
            if player.is_null() {
                (api.libvlc_release)(instance);
                return Err("Cannot create media player".into());
            }
            (api.libvlc_video_set_key_input)(player, 0);
            (api.libvlc_video_set_mouse_input)(player, 0);
            Ok(Self {
                api,
                instance,
                player,
                media: ptr::null_mut(),
                _core: core,
                _lib: lib,
                version,
            })
        }
    }
    pub fn attach(&self, drawable: usize) -> Result<(), String> {
        unsafe {
            #[cfg(windows)]
            {
                let set = self
                    ._lib
                    .get::<unsafe extern "C" fn(Ptr, Ptr)>(b"libvlc_media_player_set_hwnd\0")
                    .map_err(|e| e.to_string())?;
                set(self.player, drawable as Ptr);
            }
            #[cfg(target_os = "macos")]
            {
                let set = self
                    ._lib
                    .get::<unsafe extern "C" fn(Ptr, Ptr)>(b"libvlc_media_player_set_nsobject\0")
                    .map_err(|e| e.to_string())?;
                set(self.player, drawable as Ptr);
            }
            Ok(())
        }
    }
    pub fn open(&mut self, path: &str) -> Result<(), String> {
        let remote = path.contains("://");
        if remote {
            crate::model::network_url(path)?;
        }
        let path = CString::new(path).map_err(|_| "File path contains a null byte")?;
        unsafe {
            let media = if remote {
                (self.api.libvlc_media_new_location)(self.instance, path.as_ptr())
            } else {
                (self.api.libvlc_media_new_path)(self.instance, path.as_ptr())
            };
            if media.is_null() {
                return Err("Cannot open media".into());
            }
            (self.api.libvlc_media_player_stop)(self.player);
            (self.api.libvlc_media_player_set_media)(self.player, media);
            if !self.media.is_null() {
                (self.api.libvlc_media_release)(self.media);
            }
            self.media = media;
            if (self.api.libvlc_media_player_play)(self.player) != 0 {
                return Err(
                    "Playback could not start. Check file permissions and codec plugins.".into(),
                );
            }
            Ok(())
        }
    }
    pub fn stop(&self) {
        unsafe { (self.api.libvlc_media_player_stop)(self.player) }
    }
    pub fn pause(&self, pause: bool) {
        unsafe { (self.api.libvlc_media_player_set_pause)(self.player, pause as i32) }
    }
    pub fn seek(&self, time: i64) -> Result<(), String> {
        unsafe {
            if (self.api.libvlc_media_player_is_seekable)(self.player) == 0 {
                return Err("This media is not seekable".into());
            }
            (self.api.libvlc_media_player_set_time)(self.player, time.max(0));
            Ok(())
        }
    }
    pub fn volume(&self, v: i32, mute: bool) {
        unsafe {
            (self.api.libvlc_audio_set_volume)(self.player, v.clamp(0, 150));
            (self.api.libvlc_audio_set_mute)(self.player, mute as i32);
        }
    }
    pub fn rate(&self, v: f32) -> Result<(), String> {
        unsafe {
            if (self.api.libvlc_media_player_set_rate)(self.player, v) != 0 {
                Err("Playback rate is unsupported for this media".into())
            } else {
                Ok(())
            }
        }
    }
    pub fn aspect(&self, v: &str) {
        let v = CString::new(v).unwrap();
        unsafe { (self.api.libvlc_video_set_aspect_ratio)(self.player, v.as_ptr()) }
    }
    pub fn crop(&self, ratio: &str) -> Result<(), String> {
        if !crate::model::ASPECTS.contains(&ratio) {
            return Err("Unsupported crop ratio".into());
        }
        let ratio = CString::new(ratio).map_err(|_| "Invalid crop ratio")?;
        unsafe {
            (self.api.libvlc_video_set_crop_geometry)(self.player, ratio.as_ptr());
        }
        Ok(())
    }
    pub fn adjustments(&self, value: &VideoAdjustments) -> Result<(), String> {
        value.validate()?;
        unsafe {
            (self.api.libvlc_video_set_adjust_int)(
                self.player,
                0,
                i32::from(value != &VideoAdjustments::default()),
            );
            (self.api.libvlc_video_set_adjust_float)(self.player, 1, value.contrast / 100.);
            (self.api.libvlc_video_set_adjust_float)(self.player, 2, 1. + value.brightness / 100.);
            (self.api.libvlc_video_set_adjust_float)(self.player, 3, value.hue);
            (self.api.libvlc_video_set_adjust_float)(self.player, 4, value.saturation / 100.);
            (self.api.libvlc_video_set_adjust_float)(self.player, 5, value.gamma);
        }
        Ok(())
    }
    pub fn equalizer(&self, value: &Equalizer) -> Result<(), String> {
        value.validate()?;
        unsafe {
            if !value.enabled {
                return if (self.api.libvlc_media_player_set_equalizer)(self.player, ptr::null_mut())
                    == 0
                {
                    Ok(())
                } else {
                    Err("Cannot disable equalizer".into())
                };
            }
            let eq = (self.api.libvlc_audio_equalizer_new)();
            if eq.is_null() {
                return Err("Cannot create native equalizer".into());
            }
            let result = (|| {
                if (self.api.libvlc_audio_equalizer_set_preamp)(eq, value.preamp) != 0 {
                    return Err("Cannot set equalizer preamp".into());
                }
                for (index, amp) in value.bands.iter().enumerate() {
                    if (self.api.libvlc_audio_equalizer_set_amp_at_index)(eq, *amp, index as u32)
                        != 0
                    {
                        return Err("Cannot set equalizer band".into());
                    }
                }
                if (self.api.libvlc_media_player_set_equalizer)(self.player, eq) != 0 {
                    return Err("Cannot apply equalizer to this audio output".into());
                }
                Ok(())
            })();
            (self.api.libvlc_audio_equalizer_release)(eq);
            result
        }
    }
    pub fn next_frame(&self) -> Result<(), String> {
        self.require_video()?;
        unsafe {
            (self.api.libvlc_media_player_next_frame)(self.player);
        }
        Ok(())
    }
    pub fn require_video(&self) -> Result<(), String> {
        let (mut width, mut height) = (0, 0);
        unsafe {
            if (self.api.libvlc_video_get_size)(self.player, 0, &mut width, &mut height) != 0
                || width == 0
                || height == 0
            {
                return Err("No active video track is available".into());
            }
        }
        Ok(())
    }
    pub fn chapter(&self, target: i32) -> Result<(), String> {
        unsafe {
            let count = (self.api.libvlc_media_player_get_chapter_count)(self.player);
            if target < 0 || target >= count {
                return Err("This chapter is unavailable for the current media".into());
            }
            (self.api.libvlc_media_player_set_chapter)(self.player, target);
        }
        Ok(())
    }
    pub fn audio_channel(&self, channel: i32) -> Result<(), String> {
        if !(1..=5).contains(&channel) {
            return Err("Unsupported audio channel mode".into());
        }
        unsafe {
            if (self.api.libvlc_audio_set_channel)(self.player, channel) != 0 {
                return Err("This audio output does not support the selected channel mode".into());
            }
        }
        Ok(())
    }
    #[cfg(test)]
    pub fn adjustment_value(&self, option: u32) -> f32 {
        unsafe {
            let get = self
                ._lib
                .get::<unsafe extern "C" fn(Ptr, u32) -> f32>(b"libvlc_video_get_adjust_float\0")
                .unwrap();
            get(self.player, option)
        }
    }
    pub fn track(&self, kind: &str, id: i32) -> Result<(), String> {
        unsafe {
            let r = if kind == "audio" {
                (self.api.libvlc_audio_set_track)(self.player, id)
            } else {
                (self.api.libvlc_video_set_spu)(self.player, id)
            };
            if r == 0 {
                Ok(())
            } else {
                Err("The selected track is unavailable".into())
            }
        }
    }
    pub fn subtitle(&self, path: &Path) -> Result<(), String> {
        let uri = url::Url::from_file_path(path).map_err(|_| "Invalid subtitle path")?;
        let uri = CString::new(uri.as_str()).unwrap();
        unsafe {
            if (self.api.libvlc_media_player_add_slave)(self.player, 0, uri.as_ptr(), 1) == 0 {
                Ok(())
            } else {
                Err("Cannot load this subtitle file".into())
            }
        }
    }
    pub fn set_audio_delay(&self, delay_ms: i64) -> Result<(), String> {
        if !(-600000..=600000).contains(&delay_ms) {
            return Err("Audio delay must be between -600000 and 600000 ms".into());
        }
        unsafe {
            // libvlc delay is in microseconds
            if (self.api.libvlc_audio_set_delay)(self.player, delay_ms * 1000) == 0 {
                Ok(())
            } else {
                Err("Unable to set audio delay".into())
            }
        }
    }
    pub fn set_subtitle_delay(&self, delay_ms: i64) -> Result<(), String> {
        if !(-600000..=600000).contains(&delay_ms) {
            return Err("Subtitle delay must be between -600000 and 600000 ms".into());
        }
        unsafe {
            // libvlc delay is in microseconds
            if (self.api.libvlc_video_set_spu_delay)(self.player, delay_ms * 1000) == 0 {
                Ok(())
            } else {
                Err("Unable to set subtitle delay".into())
            }
        }
    }
    pub fn take_snapshot(&self, path: &str) -> Result<(), String> {
        self.require_video()?;
        let p = CString::new(path).map_err(|_| "Invalid snapshot path")?;
        unsafe {
            if (self.api.libvlc_video_take_snapshot)(self.player, 0, p.as_ptr(), 0, 0) == 0 {
                Ok(())
            } else {
                Err("Could not capture video snapshot".into())
            }
        }
    }
    unsafe fn tracks(&self, head: *mut TrackDescription) -> Vec<Track> {
        let mut out = Vec::new();
        let mut p = head;
        while !p.is_null() && out.len() < 256 {
            let t = &*p;
            out.push(Track {
                id: t.id,
                name: if t.name.is_null() {
                    format!("Track {}", t.id)
                } else {
                    CStr::from_ptr(t.name).to_string_lossy().into_owned()
                },
            });
            p = t.next;
        }
        (self.api.libvlc_track_description_list_release)(head);
        out
    }
    unsafe fn meta(&self, key: i32) -> String {
        if self.media.is_null() {
            return String::new();
        }
        let p = (self.api.libvlc_media_get_meta)(self.media, key);
        if p.is_null() {
            return String::new();
        }
        let s = CStr::from_ptr(p).to_string_lossy().into_owned();
        (self.api.libvlc_free)(p.cast());
        s
    }
    pub fn snapshot(&self) -> Playback {
        unsafe {
            let state = (self.api.libvlc_media_player_get_state)(self.player);
            Playback {
                state: match state {
                    0 => "idle",
                    1 => "opening",
                    2 => "buffering",
                    3 => "playing",
                    4 => "paused",
                    5 => "stopped",
                    6 => "ended",
                    _ => "error",
                }
                .into(),
                time: (self.api.libvlc_media_player_get_time)(self.player).max(0),
                duration: (self.api.libvlc_media_player_get_length)(self.player).max(0),
                seekable: (self.api.libvlc_media_player_is_seekable)(self.player) != 0,
                rate: (self.api.libvlc_media_player_get_rate)(self.player),
                audio_tracks: self
                    .tracks((self.api.libvlc_audio_get_track_description)(self.player)),
                subtitle_tracks: self
                    .tracks((self.api.libvlc_video_get_spu_description)(self.player)),
                audio_track: (self.api.libvlc_audio_get_track)(self.player),
                subtitle_track: (self.api.libvlc_video_get_spu)(self.player),
                audio_delay: (self.api.libvlc_audio_get_delay)(self.player) / 1000,
                subtitle_delay: (self.api.libvlc_video_get_spu_delay)(self.player) / 1000,
                chapter: (self.api.libvlc_media_player_get_chapter)(self.player),
                chapter_count: (self.api.libvlc_media_player_get_chapter_count)(self.player).max(0),
                audio_channel: (self.api.libvlc_audio_get_channel)(self.player),
                title: self.meta(0),
                artist: self.meta(1),
                album: self.meta(4),
            }
        }
    }
}
impl Drop for Vlc {
    fn drop(&mut self) {
        unsafe {
            (self.api.libvlc_media_player_stop)(self.player);
            (self.api.libvlc_media_player_release)(self.player);
            if !self.media.is_null() {
                (self.api.libvlc_media_release)(self.media);
            }
            (self.api.libvlc_release)(self.instance);
        }
    }
}
