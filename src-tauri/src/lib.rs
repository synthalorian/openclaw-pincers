//! OpenClaw Desktop — native backend.
//!
//! Owns the Ed25519 device identity used by the Gateway WS device-auth
//! handshake (protocol v4, v3 signature payload). The private key never
//! leaves the Rust process; the frontend only receives the device id,
//! public key, and signatures.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use ed25519_dalek::{Signer, SigningKey, VerifyingKey};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;

const KEY_FILE: &str = "device_key";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DeviceIdentityInfo {
    device_id: String,
    public_key_b64u: String,
}

fn identity_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir unavailable: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("create app data dir: {e}"))?;
    Ok(dir.join(KEY_FILE))
}

fn load_or_create_key(app: &tauri::AppHandle) -> Result<SigningKey, String> {
    let path = identity_path(app)?;
    if path.exists() {
        let bytes = fs::read(&path).map_err(|e| format!("read device key: {e}"))?;
        let arr: [u8; 32] = bytes
            .try_into()
            .map_err(|_| "device key file is malformed".to_string())?;
        return Ok(SigningKey::from_bytes(&arr));
    }
    let mut secret = [0u8; 32];
    rand::RngCore::fill_bytes(&mut rand::rngs::OsRng, &mut secret);
    let key = SigningKey::from_bytes(&secret);
    fs::write(&path, secret).map_err(|e| format!("write device key: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }
    Ok(key)
}

fn identity_info(key: &SigningKey) -> DeviceIdentityInfo {
    let verifying: VerifyingKey = key.verifying_key();
    let raw = verifying.to_bytes();
    let device_id = hex_lower(&Sha256::digest(raw));
    DeviceIdentityInfo {
        device_id,
        public_key_b64u: URL_SAFE_NO_PAD.encode(raw),
    }
}

fn hex_lower(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Returns the stable device identity (creates it on first run).
#[tauri::command]
fn device_identity(app: tauri::AppHandle) -> Result<DeviceIdentityInfo, String> {
    let key = load_or_create_key(&app)?;
    Ok(identity_info(&key))
}

/// Signs a Gateway device-auth payload string with the device private key.
/// Returns the base64url-encoded Ed25519 signature.
#[tauri::command]
fn sign_device_payload(app: tauri::AppHandle, payload: String) -> Result<String, String> {
    let key = load_or_create_key(&app)?;
    let sig = key.sign(payload.as_bytes());
    Ok(URL_SAFE_NO_PAD.encode(sig.to_bytes()))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalGatewayAuth {
    url: String,
    token: String,
}

fn home_dir() -> Option<PathBuf> {
    // $HOME on unix, %USERPROFILE% on Windows.
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

/// Reads the local OpenClaw config (~/.openclaw/openclaw.json) and returns the
/// loopback gateway URL + auth token when configured. Convenience for
/// first-run onboarding; nothing is written and the token stays on-device.
#[tauri::command]
fn local_gateway_auth() -> Result<Option<LocalGatewayAuth>, String> {
    let home = home_dir().ok_or("home directory not found")?;
    let path = PathBuf::from(home).join(".openclaw").join("openclaw.json");
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("read {}: {e}", path.display()))?;
    let cfg: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("parse {}: {e}", path.display()))?;
    let token = cfg
        .pointer("/gateway/auth/token")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if token.is_empty() {
        return Ok(None);
    }
    let port = cfg
        .pointer("/gateway/port")
        .and_then(|v| v.as_u64())
        .unwrap_or(18789);
    Ok(Some(LocalGatewayAuth {
        url: format!("ws://127.0.0.1:{port}"),
        token,
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            device_identity,
            sign_device_payload,
            local_gateway_auth
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
