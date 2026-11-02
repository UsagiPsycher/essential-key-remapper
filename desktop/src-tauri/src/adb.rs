//! Finds (or downloads) adb and runs it without flashing console windows.

use std::io::Read;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::OnceLock;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const PLATFORM_TOOLS_URL: &str =
    "https://dl.google.com/android/repository/platform-tools-latest-windows.zip";
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

static ADB: OnceLock<PathBuf> = OnceLock::new();

fn data_dir() -> PathBuf {
    let base = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    base.join("EssentialKeyRemapper")
}

fn own_adb() -> PathBuf {
    data_dir().join("platform-tools").join("adb.exe")
}

/// Our downloaded copy first, then the Android SDK, then PATH.
fn locate() -> Option<PathBuf> {
    let own = own_adb();
    if own.is_file() {
        return Some(own);
    }
    for var in ["ANDROID_HOME", "ANDROID_SDK_ROOT"] {
        if let Some(sdk) = std::env::var_os(var) {
            let p = PathBuf::from(sdk).join("platform-tools").join("adb.exe");
            if p.is_file() {
                return Some(p);
            }
        }
    }
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        let p = PathBuf::from(local).join("Android/Sdk/platform-tools/adb.exe");
        if p.is_file() {
            return Some(p);
        }
    }
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path)
        .map(|d| d.join("adb.exe"))
        .find(|p| p.is_file())
}

pub fn ready() -> bool {
    if ADB.get().is_some() {
        return true;
    }
    match locate() {
        Some(p) => {
            let _ = ADB.set(p);
            true
        }
        None => false,
    }
}

/// Downloads Google's platform-tools and keeps only what adb needs.
pub fn download(progress: impl Fn(u8)) -> Result<(), String> {
    let resp = ureq::get(PLATFORM_TOOLS_URL)
        .call()
        .map_err(|e| format!("download failed: {e}"))?;
    let total: usize = resp
        .header("Content-Length")
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);
    let mut reader = resp.into_reader();
    let mut bytes = Vec::with_capacity(total.max(1 << 20));
    let mut buf = [0u8; 64 * 1024];
    let mut last = 255u8;
    loop {
        let n = reader.read(&mut buf).map_err(|e| format!("download failed: {e}"))?;
        if n == 0 {
            break;
        }
        bytes.extend_from_slice(&buf[..n]);
        if total > 0 {
            let pct = (bytes.len() * 100 / total).min(100) as u8;
            if pct != last {
                last = pct;
                progress(pct);
            }
        }
    }

    let dir = data_dir();
    let mut archive =
        zip::ZipArchive::new(std::io::Cursor::new(bytes)).map_err(|e| format!("bad archive: {e}"))?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let Some(name) = file.enclosed_name() else { continue };
        let keep = matches!(
            name.file_name().and_then(|n| n.to_str()),
            Some("adb.exe" | "AdbWinApi.dll" | "AdbWinUsbApi.dll" | "libwinpthread-1.dll")
        );
        if !keep || file.is_dir() {
            continue;
        }
        let out = dir.join(&name);
        if let Some(parent) = out.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut f = std::fs::File::create(&out).map_err(|e| e.to_string())?;
        std::io::copy(&mut file, &mut f).map_err(|e| e.to_string())?;
    }
    let adb = own_adb();
    if !adb.is_file() {
        return Err("adb.exe missing from the archive".into());
    }
    let _ = ADB.set(adb);
    Ok(())
}

fn command(args: &[&str]) -> Result<Command, String> {
    let adb = ADB.get().ok_or("adb is not available")?;
    let mut cmd = Command::new(adb);
    cmd.args(args).stdin(Stdio::null());
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    Ok(cmd)
}

/// Runs adb and returns stdout. A non-zero exit becomes an error carrying stderr.
pub fn run(args: &[&str]) -> Result<String, String> {
    let out = command(args)?.output().map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&out.stdout).replace("\r\n", "\n");
    if out.status.success() {
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&out.stderr);
        let msg = if stderr.trim().is_empty() { stdout.trim() } else { stderr.trim() };
        Err(msg.to_string())
    }
}

/// `adb -s <serial> shell <cmd>`
pub fn shell(serial: &str, cmd: &str) -> Result<String, String> {
    run(&["-s", serial, "shell", cmd])
}

pub fn spawn(args: &[&str]) -> Result<Child, String> {
    command(args)?
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| e.to_string())
}
