use std::fmt::Write as _;
use std::process::Command;

use anyhow::{bail, Context, Result};

use crate::config::{Config, Task};

pub fn render_plan(config: &Config) -> String {
    let mut output = format!("Plan ({} tasks):\n", config.tasks.len());
    for (index, task) in config.tasks.iter().enumerate() {
        let _ = writeln!(output, "{}. {} -> {}", index + 1, task.name, task.command);
        if let Some(description) = task.description.as_deref() {
            let _ = writeln!(output, "   description: {description}");
        }
    }
    output
}

pub fn run_apply(config: &Config) -> Result<()> {
    for task in &config.tasks {
        run_task(task)?;
    }
    Ok(())
}

fn run_task(task: &Task) -> Result<()> {
    let status = Command::new("sh")
        .arg("-c")
        .arg(&task.command)
        .status()
        .with_context(|| format!("failed to spawn command for task {}", task.name))?;

    if !status.success() {
        bail!("task '{}' failed with status {status}", task.name);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plan_contains_tasks() {
        let cfg = Config {
            tasks: vec![Task {
                name: "example".to_owned(),
                command: "echo hi".to_owned(),
                description: None,
            }],
        };

        let plan = render_plan(&cfg);
        assert!(plan.contains("example"));
        assert!(plan.contains("echo hi"));
    }
}
