use std::path::PathBuf;

use clap::Parser;

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

    Ok(())
}
