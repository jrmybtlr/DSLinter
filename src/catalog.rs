//! Import-aware identities, separate from the legacy name-based governance summaries.
use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::{Component, Path, PathBuf};

use oxc_allocator::Allocator;
use oxc_ast::ast::{
    BindingPatternKind, Declaration, ExportDefaultDeclarationKind, ImportDeclarationSpecifier,
    Statement,
};
use oxc_parser::Parser;
use oxc_span::SourceType;

use crate::config::DslintConfig;
use crate::model::{
    CatalogComponent, ExampleNode, ExampleSource, FileScan, PlaygroundSpec, ProviderCandidate, UsageLocation,
};

#[derive(Default)]
struct Module {
    imports: BTreeMap<String, (String, String)>,
    exports: BTreeMap<String, (Option<String>, String)>,
    stars: Vec<String>,
    dependencies: Vec<String>,
}

fn primitive_framework(source: &str) -> Option<&'static str> {
    if matches!(source, "reka-ui" | "radix-vue") {
        Some("vue")
    } else if source.starts_with("@radix-ui/react-")
        || source == "radix-ui"
        || source.starts_with("@base-ui/react")
    {
        Some("react")
    } else {
        None
    }
}

fn module_info(path: &Path, source: &str) -> Module {
    let mut info = Module::default();
    let source = if path.extension().is_some_and(|e| e == "vue") {
        let re = regex::Regex::new(r"(?s)<script\b[^>]*>(.*?)</script>").expect("script regex");
        re.captures_iter(source)
            .filter_map(|c| c.get(1))
            .map(|m| m.as_str())
            .collect::<Vec<_>>()
            .join("\n")
    } else {
        source.to_string()
    };
    let allocator = Allocator::default();
    let ty = if path.extension().is_some_and(|e| e == "vue") {
        SourceType::tsx()
    } else {
        SourceType::from_path(path).unwrap_or_else(|_| SourceType::tsx())
    };
    let parsed = Parser::new(&allocator, &source, ty).parse();
    for stmt in &parsed.program.body {
        match stmt {
            Statement::ImportDeclaration(import) => {
                if import.import_kind.is_type() {
                    continue;
                }
                let spec = import.source.value.to_string();
                info.dependencies.push(spec.clone());
                for binding in import.specifiers.iter().flatten() {
                    let (local, imported) = match binding {
                        ImportDeclarationSpecifier::ImportSpecifier(s)
                            if !s.import_kind.is_type() =>
                        {
                            (s.local.name.to_string(), s.imported.name().to_string())
                        }
                        ImportDeclarationSpecifier::ImportDefaultSpecifier(s) => {
                            (s.local.name.to_string(), "default".into())
                        }
                        ImportDeclarationSpecifier::ImportNamespaceSpecifier(s) => {
                            (s.local.name.to_string(), "*".into())
                        }
                        _ => continue,
                    };
                    info.imports.insert(local, (spec.clone(), imported));
                }
            }
            Statement::ExportNamedDeclaration(export) if !export.export_kind.is_type() => {
                if let Some(source) = &export.source {
                    info.dependencies.push(source.value.to_string());
                }
                if let Some(decl) = &export.declaration {
                    let names: Vec<String> = match decl {
                        Declaration::FunctionDeclaration(f) => {
                            f.id.iter().map(|id| id.name.to_string()).collect()
                        }
                        Declaration::ClassDeclaration(c) => {
                            c.id.iter().map(|id| id.name.to_string()).collect()
                        }
                        Declaration::VariableDeclaration(v) => v
                            .declarations
                            .iter()
                            .filter_map(|d| match &d.id.kind {
                                BindingPatternKind::BindingIdentifier(id) => {
                                    Some(id.name.to_string())
                                }
                                _ => None,
                            })
                            .collect(),
                        _ => vec![],
                    };
                    for name in names {
                        info.exports.insert(name.clone(), (None, name));
                    }
                }
                for spec in &export.specifiers {
                    if !spec.export_kind.is_type() {
                        info.exports.insert(
                            spec.exported.name().to_string(),
                            (
                                export.source.as_ref().map(|s| s.value.to_string()),
                                spec.local.name().to_string(),
                            ),
                        );
                    }
                }
            }
            Statement::ExportDefaultDeclaration(export) => {
                let name = match &export.declaration {
                    ExportDefaultDeclarationKind::Identifier(i) => i.name.to_string(),
                    ExportDefaultDeclarationKind::FunctionDeclaration(f) => {
                        f.id.as_ref()
                            .map(|i| i.name.to_string())
                            .unwrap_or_else(|| "default".into())
                    }
                    ExportDefaultDeclarationKind::ClassDeclaration(c) => {
                        c.id.as_ref()
                            .map(|i| i.name.to_string())
                            .unwrap_or_else(|| "default".into())
                    }
                    _ => "default".into(),
                };
                info.exports.insert("default".into(), (None, name));
            }
            Statement::ExportAllDeclaration(export) if !export.export_kind.is_type() => {
                info.stars.push(export.source.value.to_string())
            }
            _ => {}
        }
    }
    if path.extension().is_some_and(|e| e == "vue") {
        info.exports
            .insert("default".into(), (None, "default".into()));
    }
    info
}

fn clean(path: PathBuf) -> PathBuf {
    let mut out = PathBuf::new();
    for part in path.components() {
        match part {
            Component::ParentDir => {
                out.pop();
            }
            Component::CurDir => {}
            p => out.push(p.as_os_str()),
        }
    }
    out
}

struct Graph {
    modules: BTreeMap<PathBuf, Module>,
    packages: Vec<(String, PathBuf, serde_json::Value)>,
    aliases: BTreeMap<PathBuf, BTreeMap<String, Vec<PathBuf>>>,
}

impl Graph {
    fn resolve_file(&self, path: PathBuf) -> Option<PathBuf> {
        let path = clean(path);
        if self.modules.contains_key(&path) {
            return Some(path);
        }
        for ext in ["tsx", "jsx", "vue", "ts", "js", "mts", "mjs"] {
            let candidate = PathBuf::from(format!("{}.{}", path.display(), ext));
            if self.modules.contains_key(&candidate) {
                return Some(candidate);
            }
            let candidate = path.join(format!("index.{ext}"));
            if self.modules.contains_key(&candidate) {
                return Some(candidate);
            }
        }
        // TypeScript code can import .js while its source is .ts/.tsx.
        if path.extension().is_some_and(|e| e == "js") {
            for ext in ["ts", "tsx"] {
                let candidate = path.with_extension(ext);
                if self.modules.contains_key(&candidate) {
                    return Some(candidate);
                }
            }
        }
        None
    }

    fn resolve_module(&self, from: &Path, spec: &str) -> Option<PathBuf> {
        let parent = from.parent()?;
        if spec.starts_with('.') {
            return self.resolve_file(parent.join(spec));
        }
        for dir in parent.ancestors() {
            {
                if let Some(paths) = self.aliases.get(dir) {
                    for (pattern, targets) in paths {
                        let (prefix, suffix) =
                            pattern.split_once('*').unwrap_or((pattern.as_str(), ""));
                        let tail = if pattern.contains('*') {
                            spec.strip_prefix(prefix)
                                .and_then(|s| s.strip_suffix(suffix))
                        } else {
                            spec.strip_prefix(pattern)
                                .filter(|tail| tail.is_empty() || tail.starts_with('/'))
                        };
                        if let Some(tail) = tail {
                            for target in targets {
                                let path = if pattern.contains('*') {
                                    PathBuf::from(target.to_string_lossy().replace('*', tail))
                                } else {
                                    target.join(tail.trim_start_matches('/'))
                                };
                                if let Some(path) = self.resolve_file(path) {
                                    return Some(path);
                                }
                            }
                        }
                    }
                }
            }
            if let Some(tail) = spec.strip_prefix("@/").or_else(|| spec.strip_prefix("~/")) {
                for prefix in ["src", "resources/js", ""] {
                    if let Some(path) = self.resolve_file(dir.join(prefix).join(tail)) {
                        return Some(path);
                    }
                }
            }
        }
        for (name, dir, package) in &self.packages {
            let subpath = if spec == name {
                Some("")
            } else {
                spec.strip_prefix(&format!("{name}/"))
            };
            if let Some(tail) = subpath {
                let key = if tail.is_empty() {
                    ".".to_string()
                } else {
                    format!("./{tail}")
                };
                let exports = &package["exports"];
                let value = if exports.is_string() || exports.get("import").is_some() {
                    exports
                } else {
                    &exports[&key]
                };
                let target = value
                    .as_str()
                    .or_else(|| value["source"].as_str())
                    .or_else(|| value["import"].as_str())
                    .or_else(|| value["default"].as_str());
                if let Some(target) = target {
                    if let Some(path) = self.resolve_file(dir.join(target)) {
                        return Some(path);
                    }
                }
                for target in [
                    tail,
                    package["source"].as_str().unwrap_or("src/index"),
                    package["module"].as_str().unwrap_or("index"),
                    package["main"].as_str().unwrap_or("src/index"),
                ] {
                    if let Some(path) = self.resolve_file(dir.join(target)) {
                        return Some(path);
                    }
                }
            }
        }
        None
    }

    fn origin(
        &self,
        path: &Path,
        name: &str,
        seen: &mut HashSet<(PathBuf, String)>,
    ) -> Option<(PathBuf, String)> {
        if !seen.insert((path.into(), name.into())) {
            return None;
        }
        let module = self.modules.get(path)?;
        if let Some((source, local)) = module.exports.get(name) {
            if let Some(source) = source {
                if let Some(target) = self.resolve_module(path, source) {
                    return self.origin(&target, local, seen);
                }
                return primitive_framework(source).map(|_| (path.into(), name.into()));
            }
            if let Some((source, imported)) = module.imports.get(local) {
                if let Some(target) = self.resolve_module(path, source) {
                    return self.origin(&target, imported, seen);
                }
                return primitive_framework(source).map(|_| (path.into(), name.into()));
            }
            return Some((path.into(), local.clone()));
        }
        for star in &module.stars {
            if name == "default" {
                continue;
            }
            if let Some(target) = self.resolve_module(path, star) {
                if let Some(origin) = self.origin(&target, name, seen) {
                    return Some(origin);
                }
            }
        }
        None
    }

    fn reachable_modules(&self, start: &Path) -> HashSet<PathBuf> {
        let mut seen = HashSet::new();
        let mut pending = vec![start.to_path_buf()];
        while let Some(path) = pending.pop() {
            if !seen.insert(path.clone()) {
                continue;
            }
            if let Some(module) = self.modules.get(&path) {
                for spec in module.dependencies.iter().chain(module.stars.iter()) {
                    if let Some(target) = self.resolve_module(&path, spec) {
                        pending.push(target);
                    }
                }
            }
        }
        seen
    }

    fn binding_origin(&self, path: &Path, name: &str) -> Option<(PathBuf, String)> {
        let module = self.modules.get(path)?;
        let (root, member) = name.split_once('.').unwrap_or((name, ""));
        if let Some((spec, imported)) = module.imports.get(root) {
            let export = if imported == "*" { member } else { imported };
            return self.origin(
                &self.resolve_module(path, spec)?,
                export,
                &mut HashSet::new(),
            );
        }
        Some((path.into(), name.into()))
    }
}

pub(crate) fn read_json(path: &Path) -> Option<serde_json::Value> {
    let source = std::fs::read_to_string(path).ok()?;
    // JSONC is parsed as JavaScript so comment markers inside strings remain intact.
    let allocator = Allocator::default();
    let wrapped = format!("({source})");
    let parsed = Parser::new(&allocator, &wrapped, SourceType::tsx()).parse();
    let mut text = source;
    for comment in parsed.program.comments.iter().rev() {
        let start = comment.span.start.saturating_sub(1) as usize;
        let end = comment.span.end.saturating_sub(1) as usize;
        if end <= text.len() {
            text.replace_range(start..end, &" ".repeat(end - start));
        }
    }
    let trailing = regex::Regex::new(r",\s*([}\]])").expect("JSONC regex");
    serde_json::from_str(&trailing.replace_all(&text, "$1")).ok()
}

fn tree_cost(tree: &ExampleNode, bindings: &BTreeMap<String, String>) -> (usize, usize) {
    match tree {
        ExampleNode::Placeholder { .. } => (1, 1),
        ExampleNode::Text { .. } => (0, 1),
        ExampleNode::Element { name, children, .. } => {
            let unresolved =
                usize::from(name.starts_with(char::is_uppercase) && !bindings.contains_key(name));
            children.iter().fold((unresolved, 1), |(a, b), child| {
                let (x, y) = tree_cost(child, bindings);
                (a + x, b + y)
            })
        }
    }
}

pub fn build_catalog(
    root: &Path,
    files: &[FileScan],
    sources: &HashMap<PathBuf, String>,
    config: &DslintConfig,
) -> Vec<CatalogComponent> {
    let mut graph = Graph {
        modules: BTreeMap::new(),
        packages: vec![],
        aliases: BTreeMap::new(),
    };
    let mut package_dirs = HashSet::new();
    for file in files {
        graph.modules.insert(
            file.path.clone(),
            module_info(
                &file.path,
                sources.get(&file.path).map(String::as_str).unwrap_or(""),
            ),
        );
        for dir in file
            .path
            .parent()
            .into_iter()
            .flat_map(Path::ancestors)
            .take_while(|p| p.starts_with(root))
        {
            if package_dirs.insert(dir.to_path_buf()) {
                graph
                    .aliases
                    .insert(dir.into(), crate::project_aliases::read_aliases(dir));
                if let Some(package) = read_json(&dir.join("package.json")) {
                    if let Some(name) = package["name"].as_str() {
                        graph.packages.push((name.into(), dir.into(), package));
                    }
                }
            }
        }
    }
    let mut out = vec![];
    let mut by_origin = HashMap::new();
    for file in files {
        if !crate::scan::in_include_scope(root, &file.path, config)
            || file.path.to_string_lossy().contains(".playground.")
        {
            continue;
        }
        let module = &graph.modules[&file.path];
        let vue = file.path.extension().is_some_and(|e| e == "vue");
        for (export, (source, local)) in &module.exports {
            let primitive = source
                .as_deref()
                .or_else(|| module.imports.get(local).map(|(source, _)| source.as_str()))
                .and_then(primitive_framework)
                .filter(|_| export.starts_with(char::is_uppercase));
            if source.is_some() && primitive.is_none() {
                continue;
            }
            let definition = file
                .definitions
                .iter()
                .find(|d| d.name == *local)
                .or_else(|| {
                    if vue {
                        let name = crate::util::kebab::component_name_from_path(&file.path)?;
                        file.definitions.iter().find(|d| d.name == name)
                    } else {
                        None
                    }
                });
            if definition.is_none() && primitive.is_none() {
                continue;
            }
            let identity = if primitive.is_some() { export } else { local };
            let origin = (file.path.clone(), identity.clone());
            if by_origin.contains_key(&origin) {
                continue;
            }
            let rel = file
                .path
                .strip_prefix(root)
                .unwrap_or(&file.path)
                .to_string_lossy()
                .replace('\\', "/");
            let name = if primitive.is_some() {
                export.clone()
            } else if local == "default" || vue {
                crate::util::kebab::component_name_from_path(&file.path)
                    .unwrap_or_else(|| "Component".into())
            } else {
                local.clone()
            };
            if config.hidden_components.contains(&name)
                || config.hidden_paths.iter().any(|p| rel.starts_with(p))
            {
                continue;
            }
            let id = format!("{rel}#{identity}");
            by_origin.insert(origin, out.len());
            out.push(CatalogComponent {
                id: id.clone(),
                name,
                framework: primitive
                    .unwrap_or(if vue { "vue" } else { "react" })
                    .into(),
                preview: PlaygroundSpec {
                    provider_candidates: vec![],
                    id,
                    export_name: export.clone(),
                    rel_path: rel,
                    declared_props: definition
                        .map(|def| def.declared_props.clone())
                        .unwrap_or_default(),
                    declared_prop_kinds: BTreeMap::new(),
                    declared_prop_options: definition
                        .map(|def| def.declared_prop_options.clone())
                        .unwrap_or_default(),
                    declared_prop_defaults: definition
                        .map(|def| def.declared_prop_defaults.clone())
                        .unwrap_or_default(),
                    group: None,
                    example_tree: None,
                },
                usages: vec![],
                bindings: BTreeMap::new(),
                dependencies: module.dependencies.clone(),
                example_source: None,
            });
        }
    }
    for file in files {
        if file.path.to_string_lossy().contains(".playground.") {
            continue;
        }
        for usage in &file.usages {
            let Some(origin) = graph.binding_origin(&file.path, &usage.component) else {
                continue;
            };
            let Some(&index) = by_origin.get(&origin) else {
                continue;
            };
            let component = &mut out[index];
            component.usages.push(UsageLocation {
                path: file.path.clone(),
                line: usage.line,
                props: usage.props.clone(),
                prop_values: usage.prop_values.clone(),
            });
            let mut names: Vec<String> =
                graph.modules[&file.path].imports.keys().cloned().collect();
            fn tree_names(tree: &ExampleNode, names: &mut Vec<String>) {
                if let ExampleNode::Element { name, children, .. } = tree {
                    names.push(name.clone());
                    for child in children {
                        tree_names(child, names);
                    }
                }
            }
            if let Some(tree) = &usage.example_tree {
                tree_names(tree, &mut names);
            }
            let mut bindings = BTreeMap::new();
            for name in names {
                if let Some(origin) = graph.binding_origin(&file.path, &name) {
                    if by_origin.contains_key(&origin) {
                        let rel = origin
                            .0
                            .strip_prefix(root)
                            .unwrap_or(&origin.0)
                            .to_string_lossy()
                            .replace('\\', "/");
                        bindings.insert(name, format!("{rel}#{}", origin.1));
                    }
                }
            }
            bindings.insert(usage.component.clone(), component.id.clone());
            let better_example = usage.example_tree.as_ref().is_some_and(|tree| {
                component.preview.example_tree.as_ref().is_none_or(|old| {
                    tree_cost(tree, &bindings) < tree_cost(old, &component.bindings)
                })
            });
            if component.example_source.is_none() || better_example {
                component.preview.example_tree = usage.example_tree.clone();
                component.example_source = Some(ExampleSource {
                    path: file
                        .path
                        .strip_prefix(root)
                        .unwrap_or(&file.path)
                        .to_string_lossy()
                        .replace('\\', "/"),
                    line: usage.line,
                });
                component.bindings = bindings;
            }
        }
    }
    // Resolve by source reachability, never by a workspace-wide component name.
    let mut reachable = HashMap::new();
    for component in &out {
        let path = root.join(&component.preview.rel_path);
        reachable
            .entry(path.clone())
            .or_insert_with(|| graph.reachable_modules(&path));
    }
    let candidates: Vec<_> = out
        .iter()
        .map(|component| {
            (
                component.framework.clone(),
                ProviderCandidate {
                    aliases: {
                        let module = &graph.modules[&root.join(&component.preview.rel_path)];
                        module
                            .exports
                            .get(&component.preview.export_name)
                            .map(|(_, local)| {
                                module
                                    .imports
                                    .get(local)
                                    .map(|(_, imported)| imported)
                                    .unwrap_or(local)
                            })
                            .filter(|name| name.starts_with(char::is_uppercase))
                            .cloned()
                            .into_iter()
                            .collect()
                    },
                    id: component.id.clone(),
                    name: component.name.clone(),
                    rel_path: component.preview.rel_path.clone(),
                    export_name: component.preview.export_name.clone(),
                },
            )
        })
        .collect();
    for component in &mut out {
        let modules = &reachable[&root.join(&component.preview.rel_path)];
        component.preview.provider_candidates = candidates
            .iter()
            .filter(|(framework, candidate)| {
                framework == &component.framework
                    && candidate.id != component.id
                    && modules.contains(&root.join(&candidate.rel_path))
            })
            .map(|(_, candidate)| candidate.clone())
            .collect();
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    out
}
