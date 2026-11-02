//! Everything done on the phone, through adb.

use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::adb;

pub const PKG: &str = "com.ekremapper.companion";
const SERVICE: &str = "com.ekremapper.companion/com.ekremapper.companion.KeyService";
const SERVICE_SHORT: &str = "com.ekremapper.companion/.KeyService";
const CONTROL: &str = "content://com.ekremapper.companion.control";
/// Must match versionCode in android/app/build.gradle.kts.
const COMPANION_VERSION: i64 = 1;
static COMPANION_APK: &[u8] = include_bytes!("../companion/companion.apk");

/// The packages behind the stock Essential key behaviour.
const NOTHING_PKGS: [&str; 2] = ["com.nothing.ntessentialspace", "com.nothing.ntessentialrecorder"];

#[derive(Serialize)]
pub struct Device {
    pub serial: String,
    /// "device", "unauthorized", "offline"…
    pub state: String,
    pub model: String,
}

pub fn devices() -> Result<Vec<Device>, String> {
    let out = adb::run(&["devices", "-l"])?;
    Ok(out
        .lines()
        .skip(1)
        .filter_map(|line| {
            let mut parts = line.split_whitespace();
            let serial = parts.next()?.to_string();
            let state = parts.next()?.to_string();
            let model = parts
                .find_map(|p| p.strip_prefix("model:"))
                .unwrap_or("")
                .replace('_', " ");
            Some(Device { serial, state, model })
        })
        .collect())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Inspect {
    pub name: String,
    pub manufacturer: String,
    pub android: String,
    pub has_key: bool,
    pub installed: bool,
    pub outdated: bool,
    pub stock_disabled: bool,
    pub service_enabled: bool,
    /// Live state reported by the companion app, when it answers.
    pub companion: Option<Value>,
}

fn prop(serial: &str, name: &str) -> String {
    adb::shell(serial, &format!("getprop {name}"))
        .map(|s| s.trim().to_string())
        .unwrap_or_default()
}

fn packages(serial: &str, flags: &str) -> Vec<String> {
    adb::shell(serial, &format!("pm list packages {flags}"))
        .unwrap_or_default()
        .lines()
        .filter_map(|l| l.trim().strip_prefix("package:").map(str::to_string))
        .collect()
}

fn enabled_services(serial: &str) -> Vec<String> {
    let raw = adb::shell(serial, "settings get secure enabled_accessibility_services")
        .unwrap_or_default();
    let raw = raw.trim();
    if raw.is_empty() || raw == "null" {
        return vec![];
    }
    raw.split(':').map(str::to_string).filter(|s| !s.is_empty()).collect()
}

fn is_ours(component: &str) -> bool {
    component == SERVICE || component == SERVICE_SHORT
}

pub fn companion_state(serial: &str) -> Option<Value> {
    let out = adb::shell(serial, &format!("content read --uri {CONTROL}/state")).ok()?;
    serde_json::from_str(out.trim()).ok()
}

pub fn inspect(serial: &str) -> Result<Inspect, String> {
    let all = packages(serial, "");
    let disabled = packages(serial, "-d");
    let present: Vec<&str> = NOTHING_PKGS
        .iter()
        .copied()
        .filter(|p| all.iter().any(|a| a == p))
        .collect();
    let installed = all.iter().any(|a| a == PKG);
    let companion = if installed { companion_state(serial) } else { None };
    let version = companion
        .as_ref()
        .and_then(|c| c["versionCode"].as_i64())
        .unwrap_or(0);

    let mut name = adb::shell(serial, "settings get global device_name")
        .map(|s| s.trim().to_string())
        .unwrap_or_default();
    if name.is_empty() || name == "null" {
        name = prop(serial, "ro.product.model");
    }

    Ok(Inspect {
        name,
        manufacturer: prop(serial, "ro.product.manufacturer"),
        android: prop(serial, "ro.build.version.release"),
        has_key: present.contains(&NOTHING_PKGS[0]),
        installed,
        outdated: installed && companion.is_some() && version < COMPANION_VERSION,
        stock_disabled: !present.is_empty() && present.iter().all(|p| disabled.iter().any(|d| d == p)),
        service_enabled: enabled_services(serial).iter().any(|s| is_ours(s)),
        companion,
    })
}

pub fn install(serial: &str) -> Result<(), String> {
    let path = std::env::temp_dir().join("ekr-companion.apk");
    std::fs::write(&path, COMPANION_APK).map_err(|e| e.to_string())?;
    let path_str = path.to_string_lossy().to_string();
    let result = adb::run(&["-s", serial, "install", "-r", &path_str]);
    let _ = std::fs::remove_file(&path);
    let out = result?;
    if out.contains("Success") {
        Ok(())
    } else {
        Err(out.trim().to_string())
    }
}

pub fn disable_stock(serial: &str) -> Result<(), String> {
    let all = packages(serial, "");
    for pkg in NOTHING_PKGS.iter().filter(|p| all.iter().any(|a| a == *p)) {
        adb::shell(serial, &format!("pm disable-user --user 0 {pkg}"))?;
    }
    Ok(())
}

pub fn enable_service(serial: &str) -> Result<(), String> {
    let mut list = enabled_services(serial);
    if !list.iter().any(|s| is_ours(s)) {
        list.push(SERVICE.to_string());
    }
    adb::shell(
        serial,
        &format!("settings put secure enabled_accessibility_services '{}'", list.join(":")),
    )?;
    adb::shell(serial, "settings put secure accessibility_enabled 1")?;
    // Lets the "Do not disturb" action work. Older builds may lack the command.
    let _ = adb::shell(serial, &format!("cmd notification allow_dnd {PKG}"));
    Ok(())
}

/// Waits for Android to bind the accessibility service.
pub fn wait_service(serial: &str) -> Result<(), String> {
    for _ in 0..30 {
        if companion_state(serial).is_some_and(|s| s["service"].as_bool() == Some(true)) {
            return Ok(());
        }
        std::thread::sleep(std::time::Duration::from_millis(300));
    }
    Err("service did not start".into())
}

fn call(serial: &str, method: &str, arg: Option<&str>) -> Result<(), String> {
    let mut cmd = format!("content call --uri {CONTROL} --method {method}");
    if let Some(arg) = arg {
        cmd.push_str(&format!(" --arg '{arg}'"));
    }
    let out = adb::shell(serial, &cmd)?;
    if out.contains("Error") || out.contains("Exception") {
        return Err(out.trim().to_string());
    }
    Ok(())
}

#[derive(Deserialize, Serialize)]
pub struct Config {
    pub single: String,
    pub double: String,
    pub hold: String,
    pub haptics: bool,
}

pub fn set_config(serial: &str, config: &Config) -> Result<(), String> {
    let json = serde_json::to_string(config).map_err(|e| e.to_string())?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(json);
    call(serial, "set", Some(&b64))
}

pub fn learn(serial: &str) -> Result<(), String> {
    call(serial, "learn", None)
}

pub fn forget(serial: &str) -> Result<(), String> {
    call(serial, "forget", None)
}

pub fn apps(serial: &str) -> Result<Value, String> {
    let out = adb::shell(serial, &format!("content read --uri {CONTROL}/apps"))?;
    serde_json::from_str(out.trim()).map_err(|e| e.to_string())
}

/// Puts the phone back as it was: stock key behaviour, our service off, optionally the app gone.
pub fn restore(serial: &str, uninstall: bool) -> Result<(), String> {
    let list: Vec<String> = enabled_services(serial).into_iter().filter(|s| !is_ours(s)).collect();
    if list.is_empty() {
        adb::shell(serial, "settings delete secure enabled_accessibility_services")?;
    } else {
        adb::shell(
            serial,
            &format!("settings put secure enabled_accessibility_services '{}'", list.join(":")),
        )?;
    }
    let all = packages(serial, "");
    for pkg in NOTHING_PKGS.iter().filter(|p| all.iter().any(|a| a == *p)) {
        adb::shell(serial, &format!("pm enable --user 0 {pkg}"))?;
    }
    if uninstall {
        adb::run(&["-s", serial, "uninstall", PKG])?;
    }
    Ok(())
}

/// Device clock in seconds, so logcat only replays what happens from now on.
pub fn device_epoch(serial: &str) -> Option<String> {
    let out = adb::shell(serial, "date +%s").ok()?;
    let secs = out.trim();
    secs.parse::<u64>().ok().map(|s| format!("{s}.000"))
}
