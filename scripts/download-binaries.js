#!/usr/bin/env node
/**
 * Download latest Stream Gate client binaries.
 * 
 * This version uses the /releases/latest/download/ proxy to avoid API limits
 * and connectivity issues with api.github.com.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const UPSTREAM_REPO = 'Fox-Fig/slipstream-rust-plus-deploy';

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

async function downloadToFile(url, destPath) {
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

  const MAX_RETRIES = 5;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // -k: insecure, -L: follow redirects, -f: fail on 4xx/5xx, -s: silent
    // --retry: curl's internal retry mechanism
    const command = `curl -k -L -f -s --retry 5 --retry-delay 5 --connect-timeout 20 -o "${destPath}" "${url}"`;
    try {
      // eslint-disable-next-line no-console
      console.log(`📡 [Attempt ${attempt}/${MAX_RETRIES}] Downloading: ${url}`);
      execSync(command, { stdio: 'inherit' });

      if (fs.existsSync(destPath) && fs.statSync(destPath).size > 100000) {
        return;
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`⚠️  Attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        const delay = attempt * 3000;
        // eslint-disable-next-line no-console
        console.log(`⏳ Waiting ${delay}ms before next attempt...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw new Error(`Failed to download ${url} after ${MAX_RETRIES} attempts.`);
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
  else if (p === 'linux') {
    if (a === 'arm64' || a === 'aarch64') targets.push('linux-arm64');
    else targets.push('linux-amd64');
  }
  else if (p === 'all') targets.push('mac-arm64', 'mac-intel', 'linux-amd64', 'linux-arm64', 'win');
  else throw new Error(`Unknown --platform value: ${String(platform)}`);

  return targets;
}

function mappingForTarget(t) {
  switch (t) {
    case 'mac-arm64':
      return { assetName: 'slipstream-client-darwin-arm64', outName: 'stream-client-mac-arm64' };
    case 'mac-intel':
      return { assetName: 'slipstream-client-darwin-amd64', outName: 'stream-client-mac-intel' };
    case 'linux-amd64':
      return { assetName: 'slipstream-client-linux-amd64', outName: 'stream-client-linux' };
    case 'linux-arm64':
      return { assetName: 'slipstream-client-linux-arm64', outName: 'stream-client-linux-arm64' };
    case 'win':
      return { assetName: 'slipstream-client-windows-amd64.exe', outName: 'stream-client-win.exe' };
    default:
      throw new Error(`Unknown target: ${t}`);
  }
}

async function main() {
  const { platform, arch } = parseArgs(process.argv);
  const outDir = path.resolve(process.cwd(), 'binaries');
  await fs.promises.mkdir(outDir, { recursive: true });

  const targets = wantTargets(platform, arch);
  for (const t of targets) {
    const { assetName, outName } = mappingForTarget(t);
    const url = `https://github.com/${UPSTREAM_REPO}/releases/latest/download/${assetName}`;

    const dest = path.join(outDir, outName);
    // eslint-disable-next-line no-console
    console.log(`⬇️  ${assetName} -> binaries/${outName}`);
    await downloadToFile(url, dest);

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
