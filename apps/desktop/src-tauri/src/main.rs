// Evita la consola extra en Windows en builds de release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use tauri_plugin_shell::ShellExt;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // El backend Bun (API + WebSocket + MCP) corre como sidecar local y guarda la base en el
            // directorio de datos de la app. La ventana carga la UI desde ese mismo servidor.
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let (_rx, child) = app
                .shell()
                .sidecar("agent-tracking-server")?
                .env("AGENT_TRACKING_DB", data_dir.join("agent-tracking.db"))
                .env("AGENT_TRACKING_WEB", app.path().resource_dir()?.join("web"))
                .env("PORT", "4317")
                .spawn()?;
            app.manage(std::sync::Mutex::new(Some(child)));
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let state = window.state::<std::sync::Mutex<Option<tauri_plugin_shell::process::CommandChild>>>();
                if let Some(child) = state.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error al iniciar Agent Tracking");
}
