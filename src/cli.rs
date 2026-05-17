//! CLI entry point shared by the `dslinter` binary and the NAPI binding.

use std::path::PathBuf;

use clap::Parser;

use crate::model::Severity;
use crate::watch;

#[derive(Parser)]
#[command(
    name = "dslinter",
    version,
    about = "DSLint — design system linting & component governance (MVP)"
)]
struct Cli {
    /// Repository root to scan.
    #[arg(default_value = ".")]
    path: PathBuf,

    /// Emit JSON report (for dashboards / CI artifacts).
    #[arg(long)]
    json: bool,

    /// Scan files in parallel (recommended for large trees).
    #[arg(short, long)]
    parallel: bool,

    /// Exit with status 1 when any warning-severity finding remains after filters.
    #[arg(long)]
    fail_on_warnings: bool,

    /// Fail when warning count exceeds this limit (inclusive allow).
    #[arg(long)]
    max_warnings: Option<u32>,

    /// Watch for file changes and incrementally re-scan (hot reload).
    /// Writes the JSON report to --output on every change.
    #[arg(long)]
    watch: bool,

    /// Path to write the JSON report file (used with --watch / --serve).
    /// Defaults to `<root>/public/dslint-report.json`.
    #[arg(long, value_name = "PATH")]
    output: Option<PathBuf>,

    /// Start an HTTP server on the given port that serves the JSON report at
    /// `/dslint-report.json` and an SSE update stream at `/events`.
    /// Implies --watch.
    #[arg(long, value_name = "PORT")]
    serve: Option<u16>,
}

/// Run the CLI with `args` (program name optional; clap skips argv[0] when missing).
/// Returns a process exit code (0 = success).
pub fn run_cli(mut args: Vec<String>) -> i32 {
    // clap expects argv[0] to be the program name when present
    if args.first().map(|s| s.as_str()) != Some("dslinter") {
        args.insert(0, "dslinter".to_string());
    }

    let cli = match Cli::try_parse_from(args) {
        Ok(c) => c,
        Err(e) => {
            e.print().ok();
            return e.exit_code();
        }
    };

    let root = std::fs::canonicalize(&cli.path).unwrap_or(cli.path);

    if cli.watch || cli.serve.is_some() {
        let output = cli
            .output
            .unwrap_or_else(|| root.join("public").join("dslint-report.json"));
        return match watch::run_watch(&root, cli.parallel, output, cli.serve) {
            Ok(()) => 0,
            Err(e) => {
                eprintln!("{e:#}");
                1
            }
        };
    }

    let report = match if cli.parallel {
        crate::scan_workspace_parallel(&root)
    } else {
        crate::scan_workspace(&root)
    } {
        Ok(r) => r,
        Err(e) => {
            eprintln!("{e:#}");
            return 1;
        }
    };

    if cli.json {
        match serde_json::to_string_pretty(&report) {
            Ok(s) => println!("{s}"),
            Err(e) => {
                eprintln!("{e:#}");
                return 1;
            }
        }
    } else {
        crate::report::print_human(&report);
    }

    let warn_count = report
        .findings
        .iter()
        .filter(|f| f.severity == Severity::Warning)
        .count() as u32;

    if cli.fail_on_warnings && warn_count > 0 {
        eprintln!(
            "dslint: {warn_count} warning-level finding(s); exiting non-zero (--fail-on-warnings)."
        );
        return 1;
    }

    if let Some(max) = cli.max_warnings {
        if warn_count > max {
            eprintln!(
                "dslint: {warn_count} warning-level finding(s) exceed --max-warnings {max}."
            );
            return 1;
        }
    }

    0
}
