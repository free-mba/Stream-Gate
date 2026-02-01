#!/usr/bin/env node
/**
 * Verifies required Stream Gate client binaries exist (and aren't Git LFS pointers).
 *
 * Usage:
 *   node scripts/verify-binaries.js --platform win|mac|linux|all
 */
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { platform: null, arch: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--platform' && argv[i + 1]) {
      args.platform = String(argv[i + 1]).toLowerCase();
      i++;
    } else if (a === '--arch' && argv[i + 1]) {
      args.arch = String(argv[i + 1]).toLowerCase();
      i++;
    }
  }
  return args;
}

function isGitLfsPointer(buf) {
  const head = buf.toString('utf8', 0, Math.min(buf.length, 200));
  return head.includes('version https://git-lfs.github.com/spec/v1');
}

function findCandidatePaths(fileName) {
  // Preferred: keep binaries under a dedicated folder.
  const inBinariesDir = path.resolve(process.cwd(), 'binaries', fileName);
  // Back-compat: allow legacy repo-root placement.
  const inRepoRoot = path.resolve(process.cwd(), fileName);
  return [inBinariesDir, inRepoRoot];
}

function assertBinaryPresent(fileName) {
  const candidates = findCandidatePaths(fileName);
  const p = candidates.find((fp) => fs.existsSync(fp));

  if (!p) {
    throw new Error(
      `Missing required binary: ${fileName}\n` +
        `Expected at: ${candidates.join(' OR ')}\n` +
        `Fix: place ${fileName} under ./binaries/ (preferred) before building.`
    );
  }

  const stat = fs.statSync(p);
  if (!stat.isFile()) {
    throw new Error(`Expected ${fileName} to be a file: ${p}`);
  }

  // Catch common "Git LFS pointer file" situation (file exists but content isn't the binary).
  const headBuf = fs.readFileSync(p, { encoding: null, flag: 'r' }).subarray(0, 200);
  if (isGitLfsPointer(headBuf)) {
    throw new Error(
      `${fileName} looks like a Git LFS pointer file, not the real binary.\n` +
        `Path: ${p}\n` +
        `Fix: enable LFS checkout (e.g. actions/checkout with lfs: true) or run 'git lfs pull' locally.`
    );
  }

  // Heuristic: binaries should be larger than a few KB; pointers are tiny.
  if (stat.size < 10 * 1024) {
    throw new Error(
      `${fileName} is unexpectedly small (${stat.size} bytes).\n` +
        `Path: ${p}\n` +
        `Fix: ensure the correct binary is present (not a placeholder) before building.`
    );
  }
}

function main() {
  const { platform, arch } = parseArgs(process.argv);
  const p = platform || 'all';

  const required = [];
  if (p === 'win') required.push('Stream Gate-client-win.exe');
  else if (p === 'mac') {
    // If arch is specified, verify only that target. Otherwise verify both.
    const a = (arch || '').toLowerCase();
    if (a === 'arm64' || a === 'aarch64') required.push('Stream Gate-client-mac-arm64');
    else if (a === 'x64' || a === 'amd64' || a === 'intel' || a === 'x86_64')
      required.push('Stream Gate-client-mac-intel');
    else required.push('Stream Gate-client-mac-arm64', 'Stream Gate-client-mac-intel');
  }
  else if (p === 'linux') required.push('Stream Gate-client-linux');
  else if (p === 'all')
    required.push(
      'Stream Gate-client-win.exe',
      'Stream Gate-client-mac-arm64',
      'Stream Gate-client-mac-intel',
      'Stream Gate-client-linux'
    );
  else {
    throw new Error(`Unknown --platform value: ${String(platform)}`);
  }

  for (const f of required) assertBinaryPresent(f);
  // eslint-disable-next-line no-console
  console.log(`✅ Required binaries present: ${required.join(', ')}`);
}

try {
  main();
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(`❌ Binary verification failed:\n${err && err.message ? err.message : String(err)}`);
  process.exit(1);
}

