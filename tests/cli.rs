use std::fs;

use assert_cmd::Command;
use predicates::prelude::*;
use tempfile::tempdir;

#[test]
fn plan_prints_task_summary() {
    let dir = tempdir().expect("tempdir");
    let config_path = dir.path().join("dot-steward.toml");

    fs::write(
        &config_path,
        r#"
        [[tasks]]
        name = "echo-task"
        command = "echo hello"
        "#,
    )
    .expect("write config");

    Command::new(env!("CARGO_BIN_EXE_dot-steward"))
        .args(["plan", "-c"])
        .arg(&config_path)
        .assert()
        .success()
        .stdout(predicate::str::contains("Plan (1 tasks):"))
        .stdout(predicate::str::contains("echo-task"));
}

#[test]
fn validate_rejects_duplicate_task_names() {
    let dir = tempdir().expect("tempdir");
    let config_path = dir.path().join("dot-steward.toml");

    fs::write(
        &config_path,
        r#"
        [[tasks]]
        name = "dupe"
        command = "echo first"

        [[tasks]]
        name = "dupe"
        command = "echo second"
        "#,
    )
    .expect("write config");

    Command::new(env!("CARGO_BIN_EXE_dot-steward"))
        .args(["validate", "-c"])
        .arg(&config_path)
        .assert()
        .failure()
        .stderr(predicate::str::contains("duplicate task name 'dupe'"));
}
