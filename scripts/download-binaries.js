#!/usr/bin/env node
/**
 * Download latest Stream Gate client binaries from:
 *   https://github.com/free-mba/Stream Gate-rust-deploy/releases/latest
 *
 * Usage:
 *   node scripts/download-binaries.js
 *   node scripts/download-binaries.js --platform mac --arch arm64
 *   node scripts/download-binaries.js --platform mac --arch x64
 *   node scripts/download-binaries.js --platform win
 *   node scripts/download-binaries.js --platform linux
 *
 * Notes:
 * - Writes into ./binaries/
 * - Overwrites existing files
 * - Uses GitHub API; optionally set GH_TOKEN to avoid rate limits
 */

const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');

const UPSTREAM_REPO = 'free-mba/Stream Gate-rust-deploy';
const API_LATEST = `https://api.github.com/repos/${UPSTREAM_REPO}/releases/latest`;

function parseArgs(argv) {
  const args = { platform: 'all', arch: null };
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

function headers() {
  const h = {
    'User-Agent': 'Stream-Gate-binary-downloader',
    Accept: 'application/vnd.github+json'
  };
  if (process.env.GH_TOKEN) h.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  return h;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
  return await res.json();
}

async function downloadToFile(url, destPath) {
  const res = await fetch(url, {
    headers: {
      ...headers(),
      // Some GH endpoints respond better with a generic accept here.
      Accept: 'application/octet-stream'
    },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  if (!res.body) throw new Error(`No response body for ${url}`);

  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

  const tmp = `${destPath}.tmp`;
  const fileStream = fs.createWriteStream(tmp);
  await pipeline(Readable.fromWeb(res.body), fileStream);
  await fs.promises.rename(tmp, destPath);
}

function wantTargets(platform, arch) {
  const p = platform || 'all';
  const a = (arch || '').toLowerCase();

  const targets = [];
  if (p === 'mac') {
    if (a === 'arm64' || a === 'aarch64') targets.push('mac-arm64');
    else if (a === 'x64' || a === 'amd64' || a === 'intel' || a === 'x86_64') targets.push('mac-intel');
    else targets.push('mac-arm64', 'mac-intel');
  } else if (p === 'win') targets.push('win');
  else if (p === 'linux') targets.push('linux');
  else if (p === 'all') targets.push('mac-arm64', 'mac-intel', 'linux', 'win');
  else throw new Error(`Unknown --platform value: ${String(platform)}`);

  return targets;
}

function mappingForTarget(t) {
  switch (t) {
    case 'mac-arm64':
      return { assetName: 'Stream Gate-client-darwin-arm64', outName: 'Stream Gate-client-mac-arm64' };
    case 'mac-intel':
      return { assetName: 'Stream Gate-client-darwin-amd64', outName: 'Stream Gate-client-mac-intel' };
    case 'linux':
      return { assetName: 'Stream Gate-client-linux-amd64', outName: 'Stream Gate-client-linux' };
    case 'win':
      return { assetName: 'Stream Gate-client-windows-amd64.exe', outName: 'Stream Gate-client-win.exe' };
    default:
      throw new Error(`Unknown target: ${t}`);
  }
}

async function main() {
  const { platform, arch } = parseArgs(process.argv);
  const release = await fetchJson(API_LATEST);

  const tag = release?.tag_name || 'latest';
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  if (!assets.length) throw new Error(`No assets found in ${UPSTREAM_REPO} release (${tag})`);

  const outDir = path.resolve(process.cwd(), 'binaries');
  await fs.promises.mkdir(outDir, { recursive: true });

  const targets = wantTargets(platform, arch);
  for (const t of targets) {
    const { assetName, outName } = mappingForTarget(t);
    const asset = assets.find((a) => a && a.name === assetName);
    if (!asset || !asset.browser_download_url) {
      throw new Error(`Missing asset "${assetName}" in ${UPSTREAM_REPO} release (${tag})`);
    }

    const dest = path.join(outDir, outName);
    // eslint-disable-next-line no-console
    console.log(`⬇️  ${assetName} -> binaries/${outName} (release: ${tag})`);
    await downloadToFile(asset.browser_download_url, dest);

    // Explicitly set executable permissions for Mac/Linux binaries
    if (process.platform !== 'win32' && !outName.endsWith('.exe')) {
      await fs.promises.chmod(dest, 0o755);
    }
  }

  // eslint-disable-next-line no-console
  console.log('✅ Done. Binaries are in ./binaries/');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`❌ Failed to download binaries:\n${err?.message || String(err)}`);
  process.exit(1);
});

