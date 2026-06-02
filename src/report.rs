//! Human-readable CLI output and JSON serialization.

use crate::model::{Severity, WorkspaceReport};

pub fn report_to_json(report: &WorkspaceReport) -> serde_json::Result<String> {
    serde_json::to_string(report)
}

pub fn print_human(report: &WorkspaceReport) {
    println!("DSLinter — {}", report.root.display());
    println!(
        "Scanned {} component sources · {} findings · {} duplicate definition names\n",
        report.files.len(),
        report.findings.len(),
        report.duplicate_components.len()
    );

    println!("Governance scores (0–100, heuristic MVP)");
    println!(
        "  design_system_health .. {}",
        report.scores.design_system_health
    );
    println!("  ux_consistency ...... {}", report.scores.ux_consistency);
    println!("  accessibility ....... {}", report.scores.accessibility);
    println!("  maintainability ..... {}", report.scores.maintainability);

    println!("\nMost-used components (PascalCase JSX / Vue template)");
    for row in report.usage_by_component.iter().take(20) {
        println!(
            "  {:30} ×{:4}  {:2} files  max {:2} props / tag",
            row.component, row.reference_count, row.file_count, row.max_props_on_single_use,
        );
    }

    if !report.duplicate_components.is_empty() {
        println!("\nDuplicate component definitions");
        for d in &report.duplicate_components {
            println!("  {} →", d.name);
            for p in &d.locations {
                println!("      {}", p.display());
            }
        }
    }

    println!("\nFindings");
    if report.findings.is_empty() {
        println!("  (none)");
        return;
    }
    for f in &report.findings {
        let line = f
            .line
            .map(|l| l.to_string())
            .unwrap_or_else(|| "-".to_string());
        let sev = match f.severity {
            Severity::Error => "error",
            Severity::Warning => "warn",
            Severity::Info => "info",
        };
        println!(
            "  [{}] {} {}:{} — {}",
            sev,
            f.rule_id,
            f.path.display(),
            line,
            f.message
        );
    }
}
