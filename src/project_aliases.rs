//! Read common alias declarations without executing a project's configuration.
use oxc_allocator::Allocator;
use oxc_ast::ast::{
    BindingPatternKind, Expression, ObjectProperty, ObjectPropertyKind, PropertyKey,
    VariableDeclarator,
};
use oxc_ast::{visit::walk, Visit};
use oxc_parser::Parser;
use oxc_span::SourceType;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

type Aliases = BTreeMap<String, Vec<PathBuf>>;

fn key_name(key: &PropertyKey<'_>) -> Option<String> {
    match key {
        PropertyKey::StaticIdentifier(key) => Some(key.name.to_string()),
        PropertyKey::StringLiteral(key) => Some(key.value.to_string()),
        _ => None,
    }
}

struct StaticAliases {
    config: PathBuf,
    constants: BTreeMap<String, String>,
    aliases: Aliases,
}

impl StaticAliases {
    fn value(&self, expression: &Expression<'_>) -> Option<String> {
        match expression {
            Expression::StringLiteral(value) => Some(value.value.to_string()),
            Expression::Identifier(value) => self.constants.get(value.name.as_str()).cloned(),
            Expression::CallExpression(call) => {
                let name = match &call.callee {
                    Expression::Identifier(name) => name.name.as_str(),
                    Expression::StaticMemberExpression(member) => member.property.name.as_str(),
                    _ => return None,
                };
                if name == "fileURLToPath" {
                    return call
                        .arguments
                        .first()
                        .and_then(|arg| arg.as_expression())
                        .and_then(|arg| self.value(arg))
                        .or_else(|| Some(self.config.to_string_lossy().into()));
                }
                let values: Option<Vec<_>> = call
                    .arguments
                    .iter()
                    .map(|arg| self.value(arg.as_expression()?))
                    .collect();
                let values = values?;
                match name {
                    "dirname" => Some(
                        Path::new(values.first()?)
                            .parent()?
                            .to_string_lossy()
                            .into(),
                    ),
                    "resolve" | "join" => {
                        let mut path = self.config.parent()?.to_path_buf();
                        for value in values {
                            path.push(value);
                        }
                        Some(path.to_string_lossy().into())
                    }
                    _ => None,
                }
            }
            Expression::NewExpression(call) if matches!(&call.callee, Expression::Identifier(id) if id.name == "URL") =>
            {
                let relative = self.value(call.arguments.first()?.as_expression()?)?;
                Some(
                    self.config
                        .parent()?
                        .join(relative)
                        .to_string_lossy()
                        .into(),
                )
            }
            _ => None,
        }
    }

    fn alias_object(&mut self, expression: &Expression<'_>) {
        let Expression::ObjectExpression(object) = expression else {
            return;
        };
        for property in &object.properties {
            let ObjectPropertyKind::ObjectProperty(property) = property else {
                continue;
            };
            if let (Some(name), Some(value)) =
                (key_name(&property.key), self.value(&property.value))
            {
                self.aliases
                    .insert(name, vec![self.config.parent().unwrap().join(value)]);
            }
        }
    }
}

impl<'a> Visit<'a> for StaticAliases {
    fn visit_variable_declarator(&mut self, declaration: &VariableDeclarator<'a>) {
        if let BindingPatternKind::BindingIdentifier(id) = &declaration.id.kind {
            if let Some(value) = declaration
                .init
                .as_ref()
                .and_then(|value| self.value(value))
            {
                self.constants.insert(id.name.to_string(), value);
            }
        }
        walk::walk_variable_declarator(self, declaration);
    }

    fn visit_object_property(&mut self, property: &ObjectProperty<'a>) {
        if key_name(&property.key).as_deref() == Some("alias") {
            self.alias_object(&property.value);
            if let Expression::ArrayExpression(array) = &property.value {
                for element in &array.elements {
                    let Some(Expression::ObjectExpression(object)) = element.as_expression() else {
                        continue;
                    };
                    let mut find = None;
                    let mut replacement = None;
                    for item in &object.properties {
                        let ObjectPropertyKind::ObjectProperty(item) = item else {
                            continue;
                        };
                        match key_name(&item.key).as_deref() {
                            Some("find") => find = self.value(&item.value),
                            Some("replacement") => replacement = self.value(&item.value),
                            _ => {}
                        }
                    }
                    if let (Some(find), Some(replacement)) = (find, replacement) {
                        self.aliases
                            .insert(find, vec![self.config.parent().unwrap().join(replacement)]);
                    }
                }
            }
        }
        walk::walk_object_property(self, property);
    }
}

fn read_ts_aliases(file: &Path, seen: &mut std::collections::HashSet<PathBuf>) -> Aliases {
    let mut aliases = Aliases::new();
    let file = std::fs::canonicalize(file).unwrap_or_else(|_| file.to_path_buf());
    if !seen.insert(file.clone()) {
        return aliases;
    }
    let Some(config) = crate::catalog::read_json(&file) else {
        return aliases;
    };
    let dir = file.parent().unwrap();
    let mut related = Vec::new();
    if let Some(parent) = config["extends"]
        .as_str()
        .filter(|parent| parent.starts_with('.'))
    {
        let parent = dir.join(parent);
        related.push(if parent.extension().is_none() {
            parent.with_extension("json")
        } else {
            parent
        });
    }
    for reference in config["references"].as_array().into_iter().flatten() {
        if let Some(path) = reference["path"].as_str() {
            let target = dir.join(path);
            related.push(if target.is_dir() {
                target.join("tsconfig.json")
            } else {
                target
            });
        }
    }
    for parent in related {
        aliases.extend(read_ts_aliases(&parent, seen));
    }
    let base = dir.join(config["compilerOptions"]["baseUrl"].as_str().unwrap_or("."));
    if let Some(paths) = config["compilerOptions"]["paths"].as_object() {
        for (pattern, targets) in paths {
            aliases.insert(
                pattern.clone(),
                targets
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(|value| value.as_str())
                    .map(|value| base.join(value))
                    .collect(),
            );
        }
    }
    aliases
}

pub(crate) fn read_aliases(dir: &Path) -> Aliases {
    let mut aliases = Aliases::new();
    for name in ["tsconfig.json", "jsconfig.json"] {
        aliases.extend(read_ts_aliases(
            &dir.join(name),
            &mut std::collections::HashSet::new(),
        ));
    }
    for name in [
        "vite.config.ts",
        "vite.config.js",
        "vite.config.mts",
        "vite.config.mjs",
    ] {
        let config = dir.join(name);
        let Ok(source) = std::fs::read_to_string(&config) else {
            continue;
        };
        let allocator = Allocator::default();
        let parsed = Parser::new(&allocator, &source, SourceType::tsx()).parse();
        let mut reader = StaticAliases {
            config,
            constants: BTreeMap::from([("__dirname".into(), dir.to_string_lossy().into())]),
            aliases: Aliases::new(),
        };
        reader.visit_program(&parsed.program);
        aliases.extend(reader.aliases);
    }
    aliases
}
