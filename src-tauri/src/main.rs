// Prevents an additional console window on Windows in release builds.
// DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;

use tauri::{Manager, RunEvent};
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
        .manage(SidecarProcess(Mutex::new(None)))
        .setup(|app| {
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
