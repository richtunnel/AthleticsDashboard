#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const rawArgs = process.argv.slice(2);
const flagArgs = rawArgs.filter((arg) => arg.startsWith("-"));

// Ensure type-checking runs without emitting files
if (!flagArgs.some((arg) => arg === "--noEmit" || arg.startsWith("--noEmit="))) {
  flagArgs.push("--noEmit");
}

const result = spawnSync("tsc", ["--project", "tsconfig.json", ...flagArgs], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
