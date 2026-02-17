mod config;
mod runner;

use std::path::PathBuf;

use anyhow::Result;
use clap::{Parser, Subcommand};

use crate::config::load_config;
use crate::runner::{render_plan, run_apply};

#[derive(Parser, Debug)]
#[command(name = "dot-steward")]
#[command(about = "Rust-based automation for workstation setup tasks")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Print deterministic execution order for the config file
    Plan {
        /// Path to TOML config file
        #[arg(short, long, default_value = "dot-steward.toml")]
        config: PathBuf,
    },
    /// Apply tasks in the order they are declared
    Apply {
        /// Path to TOML config file
        #[arg(short, long, default_value = "dot-steward.toml")]
        config: PathBuf,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Plan { config } => {
            let cfg = load_config(&config)?;
            print!("{}", render_plan(&cfg));
        }
        Commands::Apply { config } => {
            let cfg = load_config(&config)?;
            run_apply(&cfg)?;
            println!("Apply complete.");
        }
    }

    Ok(())
}
