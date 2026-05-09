use std::path::PathBuf;

use clap::Parser;

use dslint::model::Severity;

#[derive(Parser)]
#[command(
    name = "dslint",
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
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let root = std::fs::canonicalize(&cli.path).unwrap_or(cli.path);

    let report = if cli.parallel {
        dslint::scan_workspace_parallel(&root)?
    } else {
        dslint::scan_workspace(&root)?
    };

    if cli.json {
        println!("{}", serde_json::to_string_pretty(&report)?);
    } else {
        dslint::report::print_human(&report);
    }

    let warn_count = report
        .findings
        .iter()
        .filter(|f| f.severity == Severity::Warning)
        .count() as u32;

    if cli.fail_on_warnings && warn_count > 0 {
        eprintln!(
            "dslint: {} warning-level finding(s); exiting non-zero (--fail-on-warnings).",
            warn_count
        );
        std::process::exit(1);
    }

    if let Some(max) = cli.max_warnings {
        if warn_count > max {
            eprintln!(
                "dslint: {} warning-level finding(s) exceed --max-warnings {}.",
                warn_count, max
            );
            std::process::exit(1);
        }
    }

    Ok(())
}
