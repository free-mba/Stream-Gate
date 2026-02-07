/**
 * DNSService - DNS checking and validation utilities
 *
 * Single Responsibility: DNS diagnostics
 *
 * Provides utilities for:
 * - Parsing DNS server addresses
 * - Pinging hosts
 * - Resolving domains with specific DNS servers
 */

import { spawn } from 'child_process';
import dns from 'dns';
import { Worker } from 'worker_threads';
import path from 'path';
import Logger from '../core/Logger';

interface DnsServerInfo {
  ip: string;
  port: number;
  serverForNode: string;
}

interface PingResult {
  ok: boolean;
  timeMs: number;
}

interface DnsResolveResult {
  ok: boolean;
  timeMs: number;
  answers: any[];
  error?: string;
}

interface DnsCheckResult {
  ok: boolean;
  server?: string;
  ip?: string;
  port?: number;
  domain?: string;
  ping?: PingResult;
  dns?: DnsResolveResult;
  status?: string;
  error?: string;
}

interface CheckSingleServerPayload {
  server?: string;
  domain?: string;
  pingTimeoutMs?: number;
  dnsTimeoutMs?: number;
}

interface StartScanPayload {
  servers: string[];
  domain?: string;
  mode?: string;
  timeout?: number;
  workers?: number;
}

export default class DNSService {
  private logger: Logger;
  private scanWorker: Worker | null;
  private isScanning: boolean;
  private workerPath: string;

  constructor(logger: Logger, workerPath: string) {
    this.logger = logger;
    this.workerPath = workerPath;
    this.scanWorker = null;
    this.isScanning = false;
  }

  // ... (methods skipped)

  async startScan(
    payload: StartScanPayload,
    onProgress?: (completed: number, total: number) => void,
    onResult?: (result: any) => void,
    onComplete?: () => void
  ): Promise<void> {
    if (this.scanWorker) {
      await this.stopScan();
    }

    const servers = payload.servers || [];
    const domain = payload.domain || 'google.com';
    const mode = payload.mode || 'stream';
    const timeout = payload.timeout || 3;
    const concurrency = Math.min(Math.max(1, payload.workers || 50), 500);

    this.logger.info(`Starting DNS Scan: ${servers.length} servers, mode=${mode}, concurrency=${concurrency}`);

    // Use injected workerPath which should be resolved by main.ts using app.getAppPath()
    if (!require('fs').existsSync(this.workerPath)) {
      this.logger.warn(`Worker script not found at ${this.workerPath}`);
    } else {
      this.logger.info(`DNS Worker found at: ${this.workerPath}`);
    }

    this.scanWorker = new Worker(this.workerPath);

    let completed = 0;
    let active = 0;
    let queueIndex = 0;
    const total = servers.length;
    this.isScanning = true;

    const processQueue = () => {
      if (!this.isScanning) return;

      while (active < concurrency && queueIndex < total) {
        const server = servers[queueIndex++];
        if (this.scanWorker) {
          this.scanWorker.postMessage({ server, domain, mode, timeout });
          active++;
        }
      }

      if (active === 0 && queueIndex >= total) {
        this.stopScan();
        if (onComplete) onComplete();
      }
    };

    this.scanWorker.on('message', (msg) => {
      active--;
      completed++;

      if (onResult) onResult(msg);
      if (onProgress) onProgress(completed, total);

      processQueue();
    });

    this.scanWorker.on('error', (err) => {
      this.logger.error('DNS Worker Error:', err);
    });

    this.scanWorker.on('exit', (code) => {
      if (code !== 0 && this.isScanning) {
        this.logger.error(`DNS Worker stopped with exit code ${code}`);
      }
    });

    // Initial fill
    processQueue();
  }

  async stopScan(): Promise<void> {
    this.isScanning = false;
    if (this.scanWorker) {
      await this.scanWorker.terminate();
      this.scanWorker = null;
      this.logger.info('DNS Scan stopped');
    }
  }
}
