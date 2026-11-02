mod adb;
mod phone;

use std::io::{BufRead, BufReader};
use std::process::Child;
use std::sync::Mutex;

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, State};

/// adb calls block: keep them off the UI thread.
async fn blocking<T: Send + 'static>(
    f: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn adb_ready() -> bool {
    adb::ready()
}

#[tauri::command]
async fn adb_download(app: AppHandle) -> Result<(), String> {
    blocking(move || adb::download(|pct| {
        let _ = app.emit("adb-progress", pct);
    }))
    .await
}

#[tauri::command]
async fn devices() -> Result<Vec<phone::Device>, String> {
    blocking(phone::devices).await
}

#[tauri::command]
async fn inspect(serial: String) -> Result<phone::Inspect, String> {
    blocking(move || phone::inspect(&serial)).await
}

#[derive(Clone, Serialize)]
struct Step {
    id: &'static str,
    status: &'static str,
    error: Option<String>,
}

/// Runs every step needed before the key can be remapped, reporting each one.
#[tauri::command]
async fn setup(app: AppHandle, serial: String) -> Result<(), String> {
    blocking(move || {
        let steps: [(&'static str, fn(&str) -> Result<(), String>); 4] = [
            ("install", phone::install),
            ("stock", phone::disable_stock),
            ("service", phone::enable_service),
            ("ready", phone::wait_service),
        ];
        for (id, step) in steps {
            let _ = app.emit("setup-step", Step { id, status: "running", error: None });
            if let Err(e) = step(&serial) {
                let _ = app.emit("setup-step", Step { id, status: "failed", error: Some(e.clone()) });
                return Err(e);
            }
            let _ = app.emit("setup-step", Step { id, status: "done", error: None });
        }
        Ok(())
    })
    .await
}

#[tauri::command]
async fn set_config(serial: String, config: phone::Config) -> Result<(), String> {
    blocking(move || phone::set_config(&serial, &config)).await
}

#[tauri::command]
async fn learn(serial: String) -> Result<(), String> {
    blocking(move || phone::learn(&serial)).await
}

#[tauri::command]
async fn forget(serial: String) -> Result<(), String> {
    blocking(move || phone::forget(&serial)).await
}

#[tauri::command]
async fn apps(serial: String) -> Result<Value, String> {
    blocking(move || phone::apps(&serial)).await
}

#[tauri::command]
async fn restore(serial: String, uninstall: bool) -> Result<(), String> {
    blocking(move || phone::restore(&serial, uninstall)).await
}

#[derive(Default)]
struct Watcher(Mutex<Option<(String, Child)>>);

#[derive(Clone, Serialize)]
struct PhoneEvent {
    kind: String,
    gesture: Option<String>,
    action: Option<String>,
    ok: Option<bool>,
}

/// Parses the lines KeyService logs under the EKR tag.
fn parse_event(line: &str) -> Option<PhoneEvent> {
    let words: Vec<&str> = line.split_whitespace().collect();
    let ev = |kind: &str| PhoneEvent { kind: kind.into(), gesture: None, action: None, ok: None };
    match words.as_slice() {
        ["key", "down"] => Some(ev("down")),
        ["key", "up"] => Some(ev("up")),
        ["key", "learned", ..] => Some(ev("learned")),
        ["service", "connected"] => Some(ev("service")),
        ["gesture", gesture, action, status] => Some(PhoneEvent {
            kind: "gesture".into(),
            gesture: Some(gesture.to_string()),
            action: Some(action.to_string()),
            ok: Some(*status == "ok"),
        }),
        _ => None,
    }
}

/// Follows the companion's log so key presses show up live in the window.
#[tauri::command]
async fn watch(app: AppHandle, state: State<'_, Watcher>, serial: String) -> Result<(), String> {
    {
        let mut guard = state.0.lock().unwrap();
        if let Some((current, child)) = guard.as_mut() {
            if *current == serial && matches!(child.try_wait(), Ok(None)) {
                return Ok(());
            }
            let _ = child.kill();
        }
        *guard = None;
    }
    let s = serial.clone();
    let since = blocking(move || Ok(phone::device_epoch(&s))).await?;
    let mut args = vec!["-s", serial.as_str(), "logcat", "-v", "raw", "-s", "EKR:I"];
    if let Some(since) = since.as_deref() {
        args.extend(["-T", since]);
    }
    let mut child = adb::spawn(&args)?;
    let stdout = child.stdout.take().ok_or("no logcat output")?;
    *state.0.lock().unwrap() = Some((serial, child));

    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Some(event) = parse_event(line.trim()) {
                let _ = app.emit("phone-event", event);
            }
        }
    });
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .manage(Watcher::default())
        .invoke_handler(tauri::generate_handler![
            adb_ready, adb_download, devices, inspect, setup, set_config, learn, forget, apps,
            restore, watch
        ])
        .build(tauri::generate_context!())
        .expect("failed to start")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                use tauri::Manager;
                if let Some((_, mut child)) = app.state::<Watcher>().0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::parse_event;

    #[test]
    fn parses_service_log_lines() {
        assert_eq!(parse_event("key down").unwrap().kind, "down");
        assert_eq!(parse_event("key learned 0 250").unwrap().kind, "learned");
        let g = parse_event("gesture double app:com.spotify.music ok").unwrap();
        assert_eq!(g.gesture.as_deref(), Some("double"));
        assert_eq!(g.action.as_deref(), Some("app:com.spotify.music"));
        assert_eq!(g.ok, Some(true));
        assert!(parse_event("gesture hold torch failed").unwrap().ok == Some(false));
        assert!(parse_event("something else").is_none());
    }
}
