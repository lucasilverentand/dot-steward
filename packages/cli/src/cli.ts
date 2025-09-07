#!/usr/bin/env bun
import { createProgram } from "./index.ts";

const program = createProgram();
program.parse(process.argv);
