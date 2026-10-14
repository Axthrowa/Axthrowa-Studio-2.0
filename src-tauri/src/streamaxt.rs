//! Bot sekmesi: StreamAxT (Node) sunucusunu başlatır, izler ve kapatır.
//!
//! StreamAxT ayrı bir Node uygulamasıdır (`Desktop\Projeler`). Bot sekmesi onu
//! `<exe klasörü>\streamaxt` altından çalıştırıp `http://127.0.0.1:<port>` adresini
//! gömer. Uygulama kapanırken çocuk süreç de kapatılır; kullanıcı elle durdurduysa
//! (`data\yya-kapali` işareti) bir sonraki açılışta kendiliğinden başlatılmaz.

use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde_json::{json, Value};

const DEFAULT_PORT: u16 = 3001;
const OFF_MARKER: &str = "yya-kapali";
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

static CHILD: Mutex<Option<Child>> = Mutex::new(None);

pub fn port() -> u16 {
  std::env::var("YYA_STREAMAXT_PORT")
    .ok()
    .and_then(|v| v.trim().parse().ok())
    .unwrap_or(DEFAULT_PORT)
}

/// `dist/index.js` içeren StreamAxT klasörü.
pub fn find_dir() -> Option<PathBuf> {
  let mut cands: Vec<PathBuf> = Vec::new();
  if let Ok(p) = std::env::var("YYA_STREAMAXT_DIR") {
    cands.push(PathBuf::from(p));
  }
  if let Ok(exe) = std::env::current_exe() {
    if let Some(dir) = exe.parent() {
      cands.push(dir.join("streamaxt"));
    }
  }
  cands.into_iter().find(|d| d.join("dist").join("index.js").is_file())
}

/// PATH içinde (ve bilinen kurulum yolunda) `node.exe` ara.
pub fn find_node() -> Option<PathBuf> {
  let path_var = std::env::var("PATH").unwrap_or_default();
  find_in_path(&path_var, if cfg!(windows) { "node.exe" } else { "node" }).or_else(|| {
    let p = PathBuf::from(r"C:\Program Files\nodejs\node.exe");
    p.is_file().then_some(p)
  })
}

pub fn find_in_path(path_var: &str, exe: &str) -> Option<PathBuf> {
  let sep = if cfg!(windows) { ';' } else { ':' };
  path_var
    .split(sep)
    .map(|d| d.trim().trim_matches('"'))
    .filter(|d| !d.is_empty())
    .map(|d| Path::new(d).join(exe))
    .find(|p| p.is_file())
}

/// Sunucu ayakta mı? (`/health` "ok" dönüyorsa)
pub fn healthy(port: u16) -> bool {
  let addr: SocketAddr = ([127, 0, 0, 1], port).into();
  let Ok(mut s) = TcpStream::connect_timeout(&addr, Duration::from_millis(400)) else {
    return false;
  };
  let _ = s.set_read_timeout(Some(Duration::from_millis(800)));
  let _ = s.set_write_timeout(Some(Duration::from_millis(800)));
  if s
    .write_all(b"GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
    .is_err()
  {
    return false;
  }
  let mut buf = String::new();
  let _ = s.read_to_string(&mut buf);
  buf.contains("\"status\":\"ok\"")
}

/// Windows: çocuğu bir "job"a bağla; uygulama nasıl ölürse ölsün (çökme, görev
/// yöneticisi, güncelleyici) StreamAxT de kapanır ve 3001 portu takılı kalmaz.
#[cfg(windows)]
fn bind_to_our_lifetime(child: &Child) {
  use std::os::windows::io::AsRawHandle;
  use windows::core::PCWSTR;
  use windows::Win32::Foundation::HANDLE;
  use windows::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
  };
  unsafe {
    let Ok(job) = CreateJobObjectW(None, PCWSTR::null()) else {
      return;
    };
    let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
    info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    if SetInformationJobObject(
      job,
      JobObjectExtendedLimitInformation,
      &info as *const _ as *const std::ffi::c_void,
      std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
    )
    .is_err()
    {
      return;
    }
    // Tutamaç bilerek kapatılmaz: süreç bitince işletim sistemi kapatır → çocuk ölür.
    let _ = AssignProcessToJobObject(job, HANDLE(child.as_raw_handle()));
  }
}

#[cfg(not(windows))]
fn bind_to_our_lifetime(_child: &Child) {}

fn own_child_alive() -> Option<u32> {
  let mut g = CHILD.lock().ok()?;
  let alive = match g.as_mut() {
    Some(c) => matches!(c.try_wait(), Ok(None)).then(|| c.id()),
    None => None,
  };
  if alive.is_none() {
    *g = None;
  }
  alive
}

fn marker(dir: &Path) -> PathBuf {
  dir.join("data").join(OFF_MARKER)
}

pub fn status() -> Value {
  let port = port();
  let dir = find_dir();
  let running = healthy(port);
  let own = own_child_alive();
  json!({
    "installed": dir.is_some(),
    "dir": dir.as_ref().map(|d| d.to_string_lossy().to_string()),
    "node": find_node().is_some(),
    "running": running,
    "own": own.is_some(),
    "external": running && own.is_none(),
    "disabled": dir.as_ref().map(|d| marker(d).exists()).unwrap_or(false),
    "port": port,
    "url": format!("http://127.0.0.1:{port}/"),
  })
}

fn tail_log(dir: &Path) -> String {
  let text = std::fs::read_to_string(dir.join("streamaxt.log")).unwrap_or_default();
  let lines: Vec<&str> = text.lines().rev().take(6).collect();
  lines.into_iter().rev().collect::<Vec<_>>().join("\n")
}

/// Aynı anda iki `start` (açılıştaki otomatik başlatma + arayüz) ikinci bir
/// kopya başlatıyordu: o kopya `EADDRINUSE` ile çöküyor, panel de ilk kopyanın
/// izini kaybediyordu (günlükte "address already in use 127.0.0.1:3001").
static START_LOCK: Mutex<()> = Mutex::new(());

/// Sunucuyu başlat (zaten ayaktaysa ya da açılıyorsa hiçbir şey yapmaz).
pub fn start() -> Result<Value, String> {
  let _kilit = START_LOCK.lock().unwrap_or_else(|e| e.into_inner());
  let port = port();
  let dir = find_dir().ok_or_else(|| {
    "StreamAxT klasörü bulunamadı (uygulamanın yanında `streamaxt` olmalı).".to_string()
  })?;
  let _ = std::fs::remove_file(marker(&dir));
  if healthy(port) {
    return Ok(status());
  }
  // Kendi kopyamız hâlâ açılıyor: ikincisini başlatma, onu bekle
  if own_child_alive().is_none() {
    spawn_child(&dir, port)?;
  }

  let t0 = Instant::now();
  while t0.elapsed() < Duration::from_secs(12) {
    if healthy(port) {
      return Ok(status());
    }
    if own_child_alive().is_none() {
      return Err(format!("StreamAxT hemen kapandı:\n{}", tail_log(&dir)));
    }
    std::thread::sleep(Duration::from_millis(250));
  }
  Err(format!("StreamAxT 12 sn içinde yanıt vermedi:\n{}", tail_log(&dir)))
}

fn spawn_child(dir: &Path, port: u16) -> Result<(), String> {
  let node = find_node().ok_or_else(|| "Node.js 22+ bulunamadı — nodejs.org üzerinden kurun.".to_string())?;

  let log_path = dir.join("streamaxt.log");
  if std::fs::metadata(&log_path).map(|m| m.len() > 1_000_000).unwrap_or(false) {
    let _ = std::fs::remove_file(&log_path);
  }
  let log = std::fs::OpenOptions::new()
    .create(true)
    .append(true)
    .open(&log_path)
    .map_err(|e| format!("günlük açılamadı: {e}"))?;
  let log2 = log.try_clone().map_err(|e| e.to_string())?;

  let mut cmd = Command::new(node);
  cmd
    .arg("dist/index.js")
    .current_dir(dir)
    .env("PORT", port.to_string())
    .stdin(Stdio::null())
    .stdout(Stdio::from(log))
    .stderr(Stdio::from(log2));
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(CREATE_NO_WINDOW);
  }
  let child = cmd.spawn().map_err(|e| format!("başlatılamadı: {e}"))?;
  bind_to_our_lifetime(&child);
  if let Ok(mut g) = CHILD.lock() {
    *g = Some(child);
  }
  Ok(())
}

fn kill_tree(pid: u32) {
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    let _ = Command::new("taskkill")
      .args(["/PID", &pid.to_string(), "/T", "/F"])
      .creation_flags(CREATE_NO_WINDOW)
      .stdout(Stdio::null())
      .stderr(Stdio::null())
      .status();
  }
  #[cfg(not(windows))]
  {
    let _ = Command::new("kill").arg(pid.to_string()).status();
  }
}

/// `netstat -ano` çıktısından, verilen portu dinleyen sürecin PID'si.
pub fn parse_listening_pid(netstat: &str, port: u16) -> Option<u32> {
  let needle = format!(":{port}");
  netstat.lines().find_map(|l| {
    let cols: Vec<&str> = l.split_whitespace().collect();
    // TCP  0.0.0.0:3001  0.0.0.0:0  LISTENING  17984
    if cols.len() >= 5
      && cols[0].eq_ignore_ascii_case("TCP")
      && cols[3].eq_ignore_ascii_case("LISTENING")
      && cols[1].ends_with(&needle)
    {
      return cols[4].parse().ok();
    }
    None
  })
}

fn external_pid(port: u16) -> Option<u32> {
  let mut cmd = Command::new("netstat");
  cmd.args(["-ano", "-p", "tcp"]);
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(CREATE_NO_WINDOW);
  }
  let out = cmd.output().ok()?;
  parse_listening_pid(&String::from_utf8_lossy(&out.stdout), port)
}

/// Durdur. `force`: bizim başlatmadığımız (harici) örneği de kapat.
pub fn stop(force: bool) -> Result<Value, String> {
  if let Some(dir) = find_dir() {
    let _ = std::fs::create_dir_all(dir.join("data"));
    let _ = std::fs::write(marker(&dir), b"1");
  }
  let taken = CHILD.lock().ok().and_then(|mut g| g.take());
  if let Some(mut c) = taken {
    kill_tree(c.id());
    let _ = c.kill();
    let _ = c.wait();
  } else if force {
    if let Some(pid) = external_pid(port()) {
      kill_tree(pid);
    }
  }
  std::thread::sleep(Duration::from_millis(300));
  Ok(status())
}

/// Uygulama kapanırken çağrılır (`process::exit` yıkıcıları çalıştırmaz).
pub fn shutdown() {
  if let Some(mut c) = CHILD.lock().ok().and_then(|mut g| g.take()) {
    kill_tree(c.id());
    let _ = c.kill();
  }
}

/// Uygulama açılışında: kurulu, Node var, elle kapatılmamış ve çalışmıyorsa başlat.
pub fn autostart() {
  std::thread::spawn(|| {
    std::thread::sleep(Duration::from_secs(2));
    let Some(dir) = find_dir() else { return };
    if marker(&dir).exists() || healthy(port()) || find_node().is_none() {
      return;
    }
    match start() {
      Ok(_) => yya_log!("[streamaxt] otomatik başlatıldı (port {})", port()),
      Err(e) => yya_warn!("[streamaxt] otomatik başlatma: {e}"),
    }
  });
}

#[tauri::command]
pub async fn streamaxt_status() -> Result<Value, String> {
  tauri::async_runtime::spawn_blocking(status).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn streamaxt_start() -> Result<Value, String> {
  tauri::async_runtime::spawn_blocking(start).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn streamaxt_stop(force: Option<bool>) -> Result<Value, String> {
  tauri::async_runtime::spawn_blocking(move || stop(force.unwrap_or(false)))
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn netstat_dinleyen_pid_bulunur() {
    let out = "  TCP    0.0.0.0:3001           0.0.0.0:0              LISTENING       17984\r\n\
               TCP    [::]:3001              [::]:0                 LISTENING       17984\r\n\
               TCP    127.0.0.1:8843         127.0.0.1:50000        ESTABLISHED     222\r\n";
    assert_eq!(parse_listening_pid(out, 3001), Some(17984));
  }

  #[test]
  fn netstat_yalniz_tam_port_eslesir() {
    let out = "  TCP    0.0.0.0:30011          0.0.0.0:0              LISTENING       5\r\n\
               TCP    127.0.0.1:3001         127.0.0.1:60000        ESTABLISHED     6\r\n";
    // ":30011" ":3001" ile bitmez; ESTABLISHED satırı dinleyen değildir.
    assert_eq!(parse_listening_pid(out, 3001), None);
  }

  #[test]
  fn path_icinde_exe_aranir() {
    let d = std::env::temp_dir().join("yya-streamaxt-test-path");
    let _ = std::fs::create_dir_all(&d);
    let exe = if cfg!(windows) { "node.exe" } else { "node" };
    std::fs::write(d.join(exe), b"").unwrap();
    let sep = if cfg!(windows) { ";" } else { ":" };
    let path = format!("{}{}{}", "/yok/klasor", sep, d.display());
    assert_eq!(find_in_path(&path, exe), Some(d.join(exe)));
    assert_eq!(find_in_path("/yok/klasor", exe), None);
    let _ = std::fs::remove_dir_all(&d);
  }
}
