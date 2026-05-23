//! `--watch` and `--serve` implementation.
//!
//! Uses only the standard library — no additional crates required.
//!
//! Architecture:
//! - Main thread polls file modification times every `POLL_MS` milliseconds.
//!   When a change is detected it re-scans only the changed file(s), rebuilds
//!   the workspace report, atomically writes the JSON output file, and bumps a
//!   shared `AtomicU64` version counter.
//! - When `--serve <port>` is active a background thread runs a minimal HTTP
//!   server.  Each `/events` client gets its own thread that sleeps in a tight
//!   100 ms loop, writing `data: updated\n\n` whenever the version counter
//!   advances.
//!
//! ## Security notes
//! - `TcpStream` read and write timeouts are set on every accepted connection to
//!   prevent a slow-client from holding a thread indefinitely.
//! - The number of concurrent SSE connections is capped at `MAX_SSE_CLIENTS`.
//!   New connections beyond this limit receive a `503` response immediately.
//! - Atomic file writes use a temp file name that includes the process ID so
//!   that concurrent `dslinter` processes writing the same output path do not
//!   overwrite each other's temp file.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, RwLock};
use std::time::{Duration, SystemTime};
use std::{fs, thread};

use anyhow::Context;

/// How often to poll the filesystem for mtime changes.
const POLL_MS: u64 = 150;

/// Maximum number of concurrent SSE (`/events`) connections.
/// Connections beyond this cap receive `503 Service Unavailable`.
const MAX_SSE_CLIENTS: usize = 64;

/// Timeout for reading the HTTP request from each accepted connection.
const READ_TIMEOUT: Duration = Duration::from_secs(5);

/// Timeout for individual write operations on each accepted connection.
const WRITE_TIMEOUT: Duration = Duration::from_secs(30);

/// Maximum bytes read for a single static file response.
const MAX_STATIC_FILE_BYTES: u64 = 16 * 1024 * 1024;

fn quiet_logs() -> bool {
    matches!(
        std::env::var("DSLINTER_QUIET").as_deref(),
        Ok("1") | Ok("true") | Ok("TRUE")
    )
}

// ── Public entry point ───────────────────────────────────────────────────────

pub fn run_watch(
    root: &Path,
    parallel: bool,
    output: PathBuf,
    serve_port: Option<u16>,
    dashboard_static: Option<PathBuf>,
) -> anyhow::Result<()> {
    // Initial full scan.
    let config = crate::config::DslintConfig::load_from_root(root)?;
    let (mut files, mut sources) =
        crate::scan_pipeline::scan_workspace_files(root, &config, parallel)?;
    let paths: Vec<PathBuf> = files.iter().map(|f| f.path.clone()).collect();

    let report = crate::rules::evaluate_workspace(
        root.to_path_buf(),
        files.clone(),
        sources.clone(),
        &config,
    );
    let json = serde_json::to_string_pretty(&report)?;

    // Ensure output directory exists.
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent).with_context(|| {
            format!("failed to create output directory {}", parent.display())
        })?;
    }
    write_atomic(&output, &json)?;
    if !quiet_logs() {
        eprintln!("dslinter: initial scan done — wrote {}", output.display());
    }

    // Shared state for the HTTP server (if --serve).
    let json_arc: Arc<RwLock<String>> = Arc::new(RwLock::new(json));
    let version: Arc<AtomicU64> = Arc::new(AtomicU64::new(0));

    if let Some(port) = serve_port {
        let json_clone = Arc::clone(&json_arc);
        let version_clone = Arc::clone(&version);
        let has_dashboard = dashboard_static.is_some();
        let static_root = dashboard_static;
        thread::spawn(move || {
            if let Err(e) = run_http_server(port, json_clone, version_clone, static_root) {
                if !quiet_logs() {
                    eprintln!("dslinter: serve error: {e}");
                }
            }
        });
        if !quiet_logs() {
            if has_dashboard {
                eprintln!("dslinter: serving dashboard + API on http://127.0.0.1:{port}");
            } else {
                eprintln!("dslinter: serving on http://127.0.0.1:{port}");
            }
        }
    }

    // Build initial mtime snapshot.
    let mut mtimes: HashMap<PathBuf, SystemTime> = paths
        .iter()
        .filter_map(|p| fs::metadata(p).ok().and_then(|m| m.modified().ok()).map(|t| (p.clone(), t)))
        .collect();

    if !quiet_logs() {
        eprintln!("dslinter: watching {} (poll every {POLL_MS} ms) …", root.display());
    }

    loop {
        thread::sleep(Duration::from_millis(POLL_MS));

        // Re-collect the file list to detect new/deleted files.
        let current_paths = match crate::scan::collect_component_files(root, &config) {
            Ok(p) => p,
            Err(_) => continue,
        };

        let mut changed: Vec<PathBuf> = Vec::new();

        // Detect modified or new files.
        for p in &current_paths {
            let mtime = fs::metadata(p).ok().and_then(|m| m.modified().ok());
            match (mtimes.get(p), mtime) {
                (Some(prev), Some(now)) if now != *prev => {
                    mtimes.insert(p.clone(), now);
                    changed.push(p.clone());
                }
                (None, Some(now)) => {
                    mtimes.insert(p.clone(), now);
                    changed.push(p.clone());
                }
                _ => {}
            }
        }

        // Detect deleted files.
        let current_set: std::collections::HashSet<&PathBuf> = current_paths.iter().collect();
        let deleted: Vec<PathBuf> = mtimes
            .keys()
            .filter(|p| !current_set.contains(p))
            .cloned()
            .collect();
        for p in &deleted {
            mtimes.remove(p);
        }
        if !deleted.is_empty() {
            files.retain(|f| !deleted.contains(&f.path));
            for p in &deleted {
                sources.remove(p);
            }
        }

        if changed.is_empty() && deleted.is_empty() {
            continue;
        }

        for path in &changed {
            crate::rescan_file(path, &mut files, &mut sources);
        }
        files.sort_by(|a, b| a.path.cmp(&b.path));

        let new_report = crate::rules::evaluate_workspace(
            root.to_path_buf(),
            files.clone(),
            sources.clone(),
            &config,
        );
        let new_json = match serde_json::to_string_pretty(&new_report) {
            Ok(j) => j,
            Err(e) => {
                eprintln!("dslinter: serialize error: {e}");
                continue;
            }
        };

        if let Err(e) = write_atomic(&output, &new_json) {
            eprintln!("dslinter: write error: {e}");
            continue;
        }

        eprintln!(
            "dslinter: rescanned {} file(s) → {}",
            changed.len(),
            output.display()
        );

        // Update shared JSON and bump version for SSE clients.
        if let Ok(mut guard) = json_arc.write() {
            *guard = new_json;
        }
        version.fetch_add(1, Ordering::Release);
    }
}

// ── Atomic file write ────────────────────────────────────────────────────────

/// Write `content` atomically by first writing to a PID-qualified temp file in
/// the same directory as `path`, then renaming it over the destination.
///
/// Including the process ID in the temp-file name prevents concurrent `dslinter`
/// processes from colliding on the same temp file.
pub(crate) fn write_atomic(path: &Path, content: &str) -> anyhow::Result<()> {
    let pid = std::process::id();
    let tmp = path.with_file_name(format!(
        ".dslinter-{pid}.tmp",
    ));
    fs::write(&tmp, content).with_context(|| format!("write {}", tmp.display()))?;

    #[cfg(windows)]
    {
        fs::remove_file(path)
            .or_else(|err| {
                if err.kind() == std::io::ErrorKind::NotFound {
                    Ok(())
                } else {
                    Err(err)
                }
            })
            .with_context(|| format!("remove {}", path.display()))?;
    }

    fs::rename(&tmp, path).with_context(|| format!("rename {} to {}", tmp.display(), path.display()))?;
    Ok(())
}

// ── Minimal HTTP + SSE server ─────────────────────────────────────────────────

fn run_http_server(
    port: u16,
    json: Arc<RwLock<String>>,
    version: Arc<AtomicU64>,
    dashboard_static: Option<PathBuf>,
) -> anyhow::Result<()> {
    let static_root = dashboard_static.map(|p| {
        p.canonicalize()
            .unwrap_or(p)
    });
    let listener = TcpListener::bind(format!("127.0.0.1:{port}"))
        .with_context(|| format!("bind 127.0.0.1:{port}"))?;
    let sse_count = Arc::new(AtomicUsize::new(0));
    for stream in listener.incoming() {
        match stream {
            Ok(s) => {
                let json = Arc::clone(&json);
                let version = Arc::clone(&version);
                let sse_count = Arc::clone(&sse_count);
                let static_root = static_root.clone();
                thread::spawn(move || {
                    handle_connection(s, json, version, sse_count, static_root);
                });
            }
            Err(_) => continue,
        }
    }
    Ok(())
}

fn handle_connection(
    mut stream: TcpStream,
    json: Arc<RwLock<String>>,
    version: Arc<AtomicU64>,
    sse_count: Arc<AtomicUsize>,
    static_root: Option<PathBuf>,
) {
    // Apply timeouts to prevent slow-client threads from being held open
    // indefinitely (defence against accidental or intentional slow-loris).
    let _ = stream.set_read_timeout(Some(READ_TIMEOUT));
    let _ = stream.set_write_timeout(Some(WRITE_TIMEOUT));

    // Read the HTTP request line + headers (we only need the path).
    let mut buf = [0u8; 4096];
    let n = match stream.read(&mut buf) {
        Ok(n) => n,
        Err(_) => return,
    };
    let request = std::str::from_utf8(&buf[..n]).unwrap_or("");
    let method = parse_request_method(request);
    let path = parse_request_path(request);

    // CORS pre-flight.
    if method == "OPTIONS" {
        let _ = stream.write_all(
            b"HTTP/1.1 204 No Content\r\n\
Access-Control-Allow-Origin: *\r\n\
Access-Control-Allow-Methods: GET, OPTIONS\r\n\
Access-Control-Allow-Headers: *\r\n\
Content-Length: 0\r\n\r\n",
        );
        return;
    }

    match path.trim_end_matches('/') {
        "/dslinter-report.json" => {
            let body = json.read().map(|g| g.clone()).unwrap_or_default();
            let response = format!(
                "HTTP/1.1 200 OK\r\n\
Content-Type: application/json\r\n\
Access-Control-Allow-Origin: *\r\n\
Cache-Control: no-cache\r\n\
Content-Length: {}\r\n\r\n{}",
                body.len(),
                body
            );
            let _ = stream.write_all(response.as_bytes());
        }
        "/events" => {
            // Enforce a cap on concurrent SSE connections to bound resource use.
            if sse_count.fetch_add(1, Ordering::Relaxed) >= MAX_SSE_CLIENTS {
                sse_count.fetch_sub(1, Ordering::Relaxed);
                let _ = stream.write_all(
                    b"HTTP/1.1 503 Service Unavailable\r\n\
Content-Length: 0\r\n\r\n",
                );
                return;
            }

            // Server-Sent Events stream.
            let headers = b"HTTP/1.1 200 OK\r\n\
Content-Type: text/event-stream\r\n\
Cache-Control: no-cache\r\n\
Access-Control-Allow-Origin: *\r\n\
Connection: keep-alive\r\n\r\n";
            if stream.write_all(headers).is_err() {
                sse_count.fetch_sub(1, Ordering::Relaxed);
                return;
            }
            // Send an initial heartbeat comment so the browser connects immediately.
            let _ = stream.write_all(b": connected\n\n");

            let mut last = version.load(Ordering::Acquire);
            let mut idle_ticks: u32 = 0;
            loop {
                thread::sleep(Duration::from_millis(100));
                idle_ticks += 1;
                let current = version.load(Ordering::Acquire);
                if current != last {
                    if stream.write_all(b"data: updated\n\n").is_err() {
                        break; // client disconnected
                    }
                    last = current;
                    idle_ticks = 0;
                } else if idle_ticks >= 150 {
                    // Send a keep-alive comment every ~15 s to prevent proxy timeouts.
                    if stream.write_all(b": keep-alive\n\n").is_err() {
                        break;
                    }
                    idle_ticks = 0;
                }
            }

            sse_count.fetch_sub(1, Ordering::Relaxed);
        }
        other => {
            if method == "GET" {
                if let Some(root) = &static_root {
                    if serve_static(&mut stream, root, other) {
                        return;
                    }
                }
            }
            let _ = stream.write_all(
                b"HTTP/1.1 404 Not Found\r\n\
Content-Length: 0\r\n\r\n",
            );
        }
    }
}

fn parse_request_method(request: &str) -> &str {
    request
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().next())
        .unwrap_or("GET")
}

fn parse_request_path(request: &str) -> &str {
    // First line looks like: "GET /path HTTP/1.1"
    let line = request.lines().next().unwrap_or("");
    let mut parts = line.splitn(3, ' ');
    let _method = parts.next();
    let path = parts.next().unwrap_or("/");
    // Strip query string.
    path.split('?').next().unwrap_or("/")
}

fn percent_decode_path(segment: &str) -> Option<String> {
    let mut out = String::with_capacity(segment.len());
    let bytes = segment.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            if i + 2 >= bytes.len() {
                return None;
            }
            let hi = hex_digit(bytes[i + 1])?;
            let lo = hex_digit(bytes[i + 2])?;
            out.push(char::from((hi << 4) | lo));
            i += 3;
        } else if bytes[i] == b'+' {
            out.push(' ');
            i += 1;
        } else {
            out.push(bytes[i] as char);
            i += 1;
        }
    }
    Some(out)
}

fn hex_digit(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

fn content_type_for_path(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()) {
        Some("html") => "text/html; charset=utf-8",
        Some("js") => "application/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json") => "application/json; charset=utf-8",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("ico") => "image/x-icon",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        Some("map") => "application/json",
        _ => "application/octet-stream",
    }
}

fn path_has_static_extension(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    [
        ".js", ".css", ".map", ".json", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico",
        ".woff", ".woff2", ".ttf", ".eot",
    ]
    .iter()
    .any(|ext| lower.ends_with(ext))
}

fn resolve_static_file(root: &Path, url_path: &str) -> Option<PathBuf> {
    let trimmed = url_path.trim_start_matches('/');
    if trimmed.contains("..") {
        return None;
    }
    let decoded = if trimmed.is_empty() {
        String::new()
    } else {
        percent_decode_path(trimmed)?
    };
    if decoded.contains("..") || decoded.contains('\\') {
        return None;
    }

    let rel = if decoded.is_empty() {
        PathBuf::from("index.html")
    } else {
        PathBuf::from(decoded)
    };

    let candidate = root.join(&rel);
    let canonical = candidate.canonicalize().ok()?;
    let root_canonical = root.canonicalize().ok()?;
    if !canonical.starts_with(&root_canonical) {
        return None;
    }

    if canonical.is_dir() {
        let index = canonical.join("index.html");
        if index.is_file() {
            return index.canonicalize().ok();
        }
        return None;
    }

    if canonical.is_file() {
        return Some(canonical);
    }

    None
}

fn read_static_file_limited(path: &Path) -> Option<Vec<u8>> {
    let meta = fs::metadata(path).ok()?;
    if !meta.is_file() || meta.len() > MAX_STATIC_FILE_BYTES {
        return None;
    }
    fs::read(path).ok()
}

/// Serve a file from `root` for `url_path`. Returns true if a response was sent.
fn serve_static(stream: &mut TcpStream, root: &Path, url_path: &str) -> bool {
    let file = match resolve_static_file(root, url_path) {
        Some(f) => f,
        None => {
            if path_has_static_extension(url_path) {
                return false;
            }
            match resolve_static_file(root, "/index.html") {
                Some(f) => f,
                None => return false,
            }
        }
    };

    let body = match read_static_file_limited(&file) {
        Some(b) => b,
        None => return false,
    };
    let content_type = content_type_for_path(&file);
    let cache_control = if content_type.starts_with("text/html") {
        "no-cache"
    } else {
        "public, max-age=31536000, immutable"
    };
    let response = format!(
        "HTTP/1.1 200 OK\r\n\
Content-Type: {content_type}\r\n\
Access-Control-Allow-Origin: *\r\n\
Cache-Control: {cache_control}\r\n\
Content-Length: {}\r\n\r\n",
        body.len()
    );
    if stream.write_all(response.as_bytes()).is_err() {
        return true;
    }
    stream.write_all(&body).is_ok()
}
