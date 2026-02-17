use std::fs;
use std::path::Path;
use std::{collections::HashSet, fmt::Write as _};

use anyhow::{bail, Context, Result};
use serde::Deserialize;

#[derive(Debug, Deserialize, PartialEq, Eq)]
pub struct Config {
    pub tasks: Vec<Task>,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
pub struct Task {
    pub name: String,
    pub command: String,
    #[serde(default)]
    pub description: Option<String>,
}

pub fn load_config(path: &Path) -> Result<Config> {
    let raw = fs::read_to_string(path)
        .with_context(|| format!("failed to read config at {}", path.display()))?;
    let parsed: Config = toml::from_str(&raw)
        .with_context(|| format!("failed to parse config at {}", path.display()))?;
    validate_config(&parsed)?;
    Ok(parsed)
}

fn validate_config(config: &Config) -> Result<()> {
    if config.tasks.is_empty() {
        bail!("config must contain at least one [[tasks]] entry");
    }

    let mut seen_names = HashSet::new();
    let mut errors = Vec::new();

    for (index, task) in config.tasks.iter().enumerate() {
        let ordinal = index + 1;
        if task.name.trim().is_empty() {
            errors.push(format!("tasks[{ordinal}] has an empty name"));
        } else if !seen_names.insert(task.name.clone()) {
            errors.push(format!("duplicate task name '{}'", task.name));
        }

        if task.command.trim().is_empty() {
            errors.push(format!("task '{}' has an empty command", task.name));
        }
    }

    if errors.is_empty() {
        return Ok(());
    }

    let mut message = String::from("invalid configuration:\n");
    for issue in errors {
        let _ = writeln!(message, "- {issue}");
    }
    bail!(message.trim_end().to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_toml_tasks() {
        let input = r#"
            [[tasks]]
            name = "brew"
            command = "brew bundle"
        "#;

        let cfg: Config = toml::from_str(input).expect("toml should parse");
        assert_eq!(cfg.tasks.len(), 1);
        assert_eq!(cfg.tasks[0].name, "brew");
    }

    #[test]
    fn rejects_duplicate_task_names() {
        let cfg = Config {
            tasks: vec![
                Task {
                    name: "bootstrap".to_owned(),
                    command: "echo first".to_owned(),
                    description: None,
                },
                Task {
                    name: "bootstrap".to_owned(),
                    command: "echo second".to_owned(),
                    description: None,
                },
            ],
        };

        let error = validate_config(&cfg).expect_err("expected duplicate-name validation error");
        assert!(error
            .to_string()
            .contains("duplicate task name 'bootstrap'"));
    }
}
