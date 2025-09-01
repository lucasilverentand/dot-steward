# Examples

This directory contains example configurations for the Dot Steward library.

## Basic Plan

`basic.plan.ts` demonstrates how to define a plan with multiple profiles and items:

- A base profile that sets up a git config, editor environment variable, and updates the `$PATH`.
- A Linux profile that installs packages with `apt`.
- A macOS profile that uses `brew` to install formulas and casks.

These examples are intended for illustration and do not execute any actions by themselves.
