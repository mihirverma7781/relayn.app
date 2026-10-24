use std::sync::{Arc, Mutex};
use tauri::WebviewWindow;

#[derive(Default, Clone)]
pub struct Surface {
    pub handle: Arc<Mutex<usize>>,
}

#[derive(serde::Deserialize, Clone)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub visible: bool,
}

impl Surface {
    pub fn place(&self, window: &WebviewWindow, rect: Rect) -> Result<usize, String> {
        let mut handle = self
            .handle
            .lock()
            .map_err(|_| "Video surface lock failed")?;
        #[cfg(windows)]
        unsafe {
            use windows_sys::Win32::UI::WindowsAndMessaging::*;
            let parent = window.hwnd().map_err(|e| e.to_string())?.0 as *mut std::ffi::c_void;
            if *handle == 0 {
                let class: Vec<u16> = "STATIC\0".encode_utf16().collect();
                let child = CreateWindowExW(
                    0,
                    class.as_ptr(),
                    std::ptr::null(),
                    WS_CHILD
                        | WS_CLIPSIBLINGS
                        | WS_CLIPCHILDREN
                        | windows_sys::Win32::System::SystemServices::SS_BLACKRECT,
                    0,
                    0,
                    1,
                    1,
                    parent,
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    std::ptr::null(),
                );
                if child.is_null() {
                    return Err("Could not create the native video surface".into());
                }
                *handle = child as usize;
            }
            let scale = window.scale_factor().map_err(|e| e.to_string())?;
            let hwnd = *handle as *mut std::ffi::c_void;
            SetWindowPos(
                hwnd,
                HWND_TOP,
                (rect.x * scale).round() as i32,
                (rect.y * scale).round() as i32,
                (rect.width * scale).round().max(1.) as i32,
                (rect.height * scale).round().max(1.) as i32,
                SWP_NOACTIVATE,
            );
            ShowWindow(hwnd, if rect.visible { SW_SHOWNA } else { SW_HIDE });
        }
        #[cfg(target_os = "macos")]
        unsafe {
            use objc::runtime::Object;
            use objc::{class, msg_send, sel, sel_impl};
            #[repr(C)]
            #[derive(Clone, Copy)]
            struct Point {
                x: f64,
                y: f64,
            }
            #[repr(C)]
            #[derive(Clone, Copy)]
            struct Size {
                width: f64,
                height: f64,
            }
            #[repr(C)]
            #[derive(Clone, Copy)]
            struct Frame {
                origin: Point,
                size: Size,
            }
            let native = window.ns_window().map_err(|e| e.to_string())? as *mut Object;
            let content: *mut Object = msg_send![native, contentView];
            let bounds: Frame = msg_send![content, bounds];
            let frame = Frame {
                origin: Point {
                    x: rect.x,
                    y: bounds.size.height - rect.y - rect.height,
                },
                size: Size {
                    width: rect.width,
                    height: rect.height,
                },
            };
            if *handle == 0 {
                let allocated: *mut Object = msg_send![class!(NSView), alloc];
                let view: *mut Object = msg_send![allocated, initWithFrame: frame];
                let _: () = msg_send![view, setWantsLayer: 1i8];
                let _: () = msg_send![content, addSubview: view positioned: 1i64 relativeTo: std::ptr::null_mut::<Object>()];
                let _: () = msg_send![view, release];
                *handle = view as usize;
            }
            let view = *handle as *mut Object;
            let _: () = msg_send![view, setFrame: frame];
            let _: () = msg_send![view, setHidden: if rect.visible { 0i8 } else { 1i8 }];
        }
        Ok(*handle)
    }
}
