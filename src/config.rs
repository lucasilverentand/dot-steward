use std::fs;
use std::path::Path;

use anyhow::{Context, Result};
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
    Ok(parsed)
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
}
