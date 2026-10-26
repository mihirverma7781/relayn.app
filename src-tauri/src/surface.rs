use std::sync::{Arc, Mutex};
use tauri::WebviewWindow;

#[cfg(windows)]
mod pointer_input {
    use tauri::{Emitter, WebviewWindow};
    use windows_sys::Win32::{
        Foundation::{HWND, LPARAM, LRESULT, WPARAM},
        UI::{
            Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass},
            WindowsAndMessaging::{
                WM_LBUTTONDBLCLK, WM_LBUTTONDOWN, WM_MBUTTONDOWN, WM_NCDESTROY, WM_RBUTTONDOWN,
            },
        },
    };

    const SUBCLASS_ID: usize = 0x524c594e;

    struct InputContext {
        window: WebviewWindow,
    }

    unsafe extern "system" fn host_proc(
        hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        id: usize,
        data: usize,
    ) -> LRESULT {
        if message == WM_NCDESTROY {
            // The host is owned by the OS parent window. Reclaim exactly once when
            // that host is destroyed, including during failed app initialization.
            RemoveWindowSubclass(hwnd, Some(host_proc), id);
            drop(Box::from_raw(data as *mut InputContext));
            return DefSubclassProc(hwnd, message, wparam, lparam);
        }
        if matches!(
            message,
            WM_LBUTTONDOWN | WM_LBUTTONDBLCLK | WM_MBUTTONDOWN | WM_RBUTTONDOWN
        ) {
            let window = (*(data as *const InputContext)).window.clone();
            // Focus the WebView itself, not just the containing native window.
            // libVLC's keyboard handling stays disabled so app shortcuts work.
            let webview: &tauri::Webview = window.as_ref();
            let _ = webview.set_focus();
            if message == WM_LBUTTONDBLCLK {
                let _ = window.emit("video-double-click", ());
            }
        }
        DefSubclassProc(hwnd, message, wparam, lparam)
    }

    pub unsafe fn install(hwnd: HWND, window: &WebviewWindow) -> Result<(), String> {
        let context = Box::into_raw(Box::new(InputContext {
            window: window.clone(),
        }));
        if SetWindowSubclass(hwnd, Some(host_proc), SUBCLASS_ID, context as usize) == 0 {
            drop(Box::from_raw(context));
            return Err("Could not connect native video input".into());
        }
        Ok(())
    }
}

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
                        | windows_sys::Win32::System::SystemServices::SS_NOTIFY
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
                if let Err(error) = pointer_input::install(child, window) {
                    DestroyWindow(child);
                    return Err(error);
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
            use objc::declare::ClassDecl;
            use objc::runtime::{Class, Object, Sel};
            use objc::{class, msg_send, sel, sel_impl};
            #[repr(C)]
            #[derive(Clone, Copy)]
            struct Point {
                x: f64,
                y: f64,
            }
            unsafe impl objc::Encode for Point {
                fn encode() -> objc::Encoding {
                    unsafe { objc::Encoding::from_str("{CGPoint=dd}") }
                }
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

            static INIT_CLASS: std::sync::Once = std::sync::Once::new();
            INIT_CLASS.call_once(|| {
                if let Some(mut decl) = ClassDecl::new("RelayNVideoView", class!(NSView)) {
                    extern "C" fn hit_test(_this: &Object, _cmd: Sel, _pt: Point) -> *mut Object {
                        std::ptr::null_mut()
                    }
                    decl.add_method(
                        sel!(hitTest:),
                        hit_test as extern "C" fn(&Object, Sel, Point) -> *mut Object,
                    );
                    decl.register();
                }
            });
            let view_class = Class::get("RelayNVideoView").unwrap_or_else(|| class!(NSView));

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
                let allocated: *mut Object = msg_send![view_class, alloc];
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
