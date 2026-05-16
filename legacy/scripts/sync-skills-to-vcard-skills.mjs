#!/usr/bin/env node
import { existsSync, cpSync, rmSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const defaultTarget = resolve(repoRoot, "..", "vcard-skills");

const args = process.argv.slice(2);
const options = {
  target: process.env.VCARD_SKILLS_REPO || defaultTarget,
  message: "Sync skills from VCard",
  push: true,
  dryRun: false,
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--target") options.target = resolve(args[++i]);
  else if (arg === "--message" || arg === "-m") options.message = args[++i];
  else if (arg === "--no-push") options.push = false;
  else if (arg === "--dry-run") options.dryRun = true;
  else if (arg === "--help" || arg === "-h") {
    printHelp();
    process.exit(0);
  } else {
    fail(`Unknown argument: ${arg}`);
  }
}

const sourceSkills = resolve(repoRoot, "skills");
const targetRepo = resolve(options.target);
const targetSkills = resolve(targetRepo, "skills");

main();

function main() {
  assertPath(sourceSkills, "source skills directory");
  assertPath(targetRepo, "target repository");
  assertPath(resolve(targetRepo, ".git"), "target .git directory");

  const branch = git(["branch", "--show-current"], targetRepo).trim();
  if (!branch) fail("Target repository is in detached HEAD state.");

  const initialStatus = git(["status", "--porcelain"], targetRepo).trim();
  if (initialStatus) {
    fail(
      [
        "Target repository has uncommitted changes. Commit or stash them first:",
        initialStatus,
      ].join("\n"),
    );
  }

  log(`Source: ${relative(process.cwd(), sourceSkills) || sourceSkills}`);
  log(`Target: ${targetRepo}`);
  log(`Branch: ${branch}`);

  if (options.dryRun) {
    log("Dry run: no files copied, no commit created, no push performed.");
    return;
  }

  git(["pull", "--ff-only", "origin", branch], targetRepo, { stdio: "inherit" });

  rmSync(targetSkills, { recursive: true, force: true });
  cpSync(sourceSkills, targetSkills, {
    recursive: true,
    dereference: false,
    force: true,
  });

  const changed = git(["status", "--porcelain"], targetRepo).trim();
  if (!changed) {
    log("No skill changes to sync.");
    return;
  }

  git(["add", "skills"], targetRepo);
  git(["commit", "-m", options.message], targetRepo, { stdio: "inherit" });

  if (options.push) {
    git(["push", "origin", branch], targetRepo, { stdio: "inherit" });
  } else {
    log("Skipped push because --no-push was provided.");
  }
}

function git(args, cwd, opts = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: opts.stdio || "pipe",
  });

  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    fail(`git ${args.join(" ")} failed${detail ? `:\n${detail}` : ""}`);
  }

  return result.stdout || "";
}

function assertPath(path, label) {
  if (!existsSync(path)) fail(`Missing ${label}: ${path}`);
}

function log(message) {
  console.log(`[sync-skills] ${message}`);
}

function fail(message) {
  console.error(`[sync-skills] ${message}`);
  process.exit(1);
}

function printHelp() {
  console.log(`Sync local skills to the vcard-skills repository and push.

Usage:
  node scripts/sync-skills-to-vcard-skills.mjs [options]

Options:
  --target <path>     Target vcard-skills checkout. Defaults to ../vcard-skills
  -m, --message <msg> Commit message. Defaults to "Sync skills from VCard"
  --no-push           Commit locally but do not push
  --dry-run           Validate paths and target state without changing files
  -h, --help          Show this help

Environment:
  VCARD_SKILLS_REPO   Alternative target checkout path
`);
}
