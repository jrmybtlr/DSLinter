use std::fs;
use std::path::Path;

fn put(root: &Path, path: &str, source: &str) {
    let target = root.join(path);
    fs::create_dir_all(target.parent().unwrap()).unwrap();
    fs::write(target, source).unwrap();
}

#[test]
fn catalog_scope_does_not_hide_alias_barrel_or_workspace_usage() {
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path();
    put(
        root,
        ".dslinter.json",
        r#"{"include_dirs":["packages/ui/src"]}"#,
    );
    put(
        root,
        "package.json",
        r#"{"workspaces":["packages/*","apps/*"]}"#,
    );
    put(
        root,
        "packages/ui/package.json",
        r#"{"name":"@test/ui","exports":"./src/index.ts"}"#,
    );
    put(
        root,
        "packages/ui/src/Button.tsx",
        "export function Button({label}: {label: string}) { return <button>{label}</button> }",
    );
    put(
        root,
        "packages/ui/src/Other.tsx",
        "export function Button() { return <button>Other</button> }",
    );
    put(
        root,
        "packages/ui/src/index.ts",
        "export { Button as Action } from './Button';",
    );
    put(root, "apps/web/Page.tsx", "import { Action as Save } from '@test/ui'; export function Page() { return <Save label=\"Save\" /> }");
    let report = dslinter::scan_workspace(root).unwrap();
    assert_eq!(report.schema_version, 4);
    assert_eq!(report.components.len(), 2);
    let button = report
        .components
        .iter()
        .find(|c| c.id == "packages/ui/src/Button.tsx#Button")
        .unwrap();
    assert_eq!(button.usages.len(), 1);
    assert!(button.usages[0].path.ends_with("apps/web/Page.tsx"));
    assert!(report
        .components
        .iter()
        .find(|c| c.id.ends_with("Other.tsx#Button"))
        .unwrap()
        .usages
        .is_empty());
}

#[test]
fn discovers_default_exports_and_template_only_vue_components() {
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path();
    put(
        root,
        "src/Hello.vue",
        "<template><button>Hello</button></template>",
    );
    put(
        root,
        "src/Card.tsx",
        "export default function({title}: {title: string}) { return <div>{title}</div> }",
    );
    put(
        root,
        "src/Page.tsx",
        "import Card from './Card'; export const Page = () => <Card title=\"Hello\" />;",
    );
    let report = dslinter::scan_workspace(root).unwrap();
    let vue = report
        .components
        .iter()
        .find(|c| c.name == "Hello")
        .unwrap();
    assert_eq!(vue.framework, "vue");
    assert_eq!(vue.preview.export_name, "default");
    assert!(report
        .files
        .iter()
        .find(|f| f.path.ends_with("Hello.vue"))
        .unwrap()
        .parse_errors
        .is_empty());
    let card = report.components.iter().find(|c| c.name == "Card").unwrap();
    assert_eq!(card.usages.len(), 1);
}

#[test]
fn resolves_jsonc_paths_and_namespace_barrels_without_name_guessing() {
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path();
    put(
        root,
        "tsconfig.json",
        "{ // aliases\n \"compilerOptions\": {\"paths\": {\"@/*\":[\"src/*\"],},},}",
    );
    put(
        root,
        "src/ui/Button.tsx",
        "export const Button = () => <button>Click</button>;",
    );
    put(root, "src/ui/index.ts", "export * from './Button';");
    put(
        root,
        "src/Page.tsx",
        "import * as UI from '@/ui'; export function Page(){ return <UI.Button /> }",
    );
    let report = dslinter::scan_workspace(root).unwrap();
    assert_eq!(
        report
            .components
            .iter()
            .find(|c| c.name == "Button")
            .unwrap()
            .usages
            .len(),
        1
    );
}

#[test]
fn workspace_scan_respects_nested_ignores_and_negation() {
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path();
    put(
        root,
        "app/.gitignore",
        "/generated\n*.test.tsx\n!Keep.test.tsx\n",
    );
    put(
        root,
        "app/generated/Noise.tsx",
        "export function Noise(){ return null }",
    );
    put(
        root,
        "app/Hidden.test.tsx",
        "export function Hidden(){ return null }",
    );
    put(
        root,
        "app/Keep.test.tsx",
        "export function Keep(){ return null }",
    );
    let report = dslinter::scan_workspace(root).unwrap();
    assert_eq!(report.components.len(), 1);
    assert_eq!(report.components[0].name, "Keep");
}

#[test]
fn resolves_custom_typescript_and_static_vite_aliases() {
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path();
    put(
        root,
        "tsconfig.json",
        r#"{"compilerOptions":{"baseUrl":".","paths":{"design/*":["src/ui/*"]}}}"#,
    );
    put(root, "vite.config.ts", "import {fileURLToPath} from 'node:url'; export default { resolve: { alias: { widgets: fileURLToPath(new URL('./src/ui', import.meta.url)) } } };");
    put(
        root,
        "src/ui/Button.tsx",
        "export const Button = () => <button>Click</button>;",
    );
    put(root, "src/Page.tsx", "import {Button as A} from 'design/Button'; import {Button as B} from 'widgets/Button'; export const Page = () => <><A/><B/></>;");
    let report = dslinter::scan_workspace(root).unwrap();
    assert_eq!(
        report
            .components
            .iter()
            .find(|component| component.name == "Button")
            .unwrap()
            .usages
            .len(),
        2
    );
}

#[test]
fn discovers_vue_primitive_reexports_as_public_component_contracts() {
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path();
    put(
        root,
        "ui/index.ts",
        "export { SelectRoot as Select, SelectValue, useForwardProps } from 'reka-ui';",
    );
    put(root, "Page.vue", "<script setup>import { Select, SelectValue } from './ui';</script>\n<template><Select><SelectValue /></Select></template>");
    let report = dslinter::scan_workspace(root).unwrap();
    let select = report
        .components
        .iter()
        .find(|component| component.id == "ui/index.ts#Select")
        .unwrap();
    assert_eq!(select.framework, "vue");
    assert_eq!(select.preview.export_name, "Select");
    assert_eq!(select.usages.len(), 1);
    assert!(select.dependencies.contains(&"reka-ui".to_string()));
    assert!(report
        .components
        .iter()
        .all(|component| component.name != "useForwardProps"));
}
