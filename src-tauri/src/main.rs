// Prevents an additional console window on Windows in release builds.
// DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;

use tauri::{Emitter, Manager, RunEvent, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, ShortcutState};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Holds the running sidecar process so we can terminate it on exit.
struct SidecarProcess(Mutex<Option<CommandChild>>);

/// The sidecar name must match the `externalBin` entry in `tauri.conf.json`
/// (Tauri appends the target triple + extension to resolve the binary in
/// `binaries/`, e.g. `iracing-bridge-x86_64-pc-windows-msvc.exe`).
const SIDECAR_NAME: &str = "iracing-bridge";

fn spawn_bridge(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let command = app.shell().sidecar(SIDECAR_NAME)?;
    let (mut rx, child) = command.spawn()?;

    // Keep the child handle so we can kill it when the app closes.
    app.state::<SidecarProcess>()
        .0
        .lock()
        .unwrap()
        .replace(child);

    // Forward the sidecar's stdout/stderr to our logs for debugging.
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    println!("[bridge] {}", String::from_utf8_lossy(&line).trim_end());
                }
                CommandEvent::Stderr(line) => {
                    eprintln!("[bridge] {}", String::from_utf8_lossy(&line).trim_end());
                }
                CommandEvent::Error(err) => {
                    eprintln!("[bridge] process error: {err}");
                }
                CommandEvent::Terminated(payload) => {
                    eprintln!("[bridge] terminated: {payload:?}");
                }
                _ => {}
            }
        }
    });

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        // Global shortcut plugin: Ctrl+Shift+L toggles overlay lock mode.
        // The handler emits an event to the frontend which owns the lock state.
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        let _ = app.emit("overlay://toggle-lock", ());
                    }
                })
                .build(),
        )
        .manage(SidecarProcess(Mutex::new(None)))
        // Closing the main window shuts the whole app down: eagerly close every
        // auxiliary overlay/widget window so none is left orphaned on screen.
        // Programmatic closes here don't run the frontend's "forget" handler, so
        // the remembered-windows list survives for restore-on-next-launch.
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { .. } = event {
                    let app = window.app_handle();
                    for (label, w) in app.webview_windows() {
                        if label != "main" {
                            let _ = w.close();
                        }
                    }
                }
            }
        })
        .setup(|app| {
            // Register the overlay lock/unlock hotkey (Ctrl+Shift+L).
            // This fires even when iRacing has focus, allowing the user to
            // toggle the overlay without clicking into the telemetry window.
            use tauri_plugin_global_shortcut::Shortcut;
            let shortcut = Shortcut::new(
                Some(Modifiers::CONTROL | Modifiers::SHIFT),
                Code::KeyL,
            );
            if let Err(err) = app.handle().global_shortcut().register(shortcut) {
                eprintln!("[overlay] failed to register hotkey Ctrl+Shift+L: {err}");
            }

            // Launch the Python telemetry bridge as soon as the app starts.
            if let Err(err) = spawn_bridge(app.handle()) {
                eprintln!("[bridge] failed to spawn sidecar: {err}");
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // Make sure the sidecar is terminated when the app exits so it
            // never lingers as an orphan process.
            if let RunEvent::ExitRequested { .. } = event {
                if let Some(child) = app_handle
                    .state::<SidecarProcess>()
                    .0
                    .lock()
                    .unwrap()
                    .take()
                {
                    let _ = child.kill();
                }
            }
        });
}
