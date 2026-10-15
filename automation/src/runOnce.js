#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { DEFAULT_ROOM_ID } from '@webrtc/shared';
import { parseArgs, usageText } from './parseArgs.js';
import { defaultBaseUrl } from './urls.js';
import { formatTrial, nextTrialNumber, resolveRunPath } from './paths.js';
import { buildRunDocument, expectedMinSamples, validateRunDocument } from './schema.js';
import { closeParticipants, launchParticipants } from './launchParticipants.js';
import { collectStats } from './collectStats.js';
import { createCpuSampler, resolveSfuPid } from './cpuSampler.js';
import { applyCapIfNeeded, clearCapIfNeeded } from './tcUplink.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(repoRoot, '.env') });

/**
 * Core single-run orchestration (injectable for tests).
 * @param {ReturnType<typeof parseArgs>} options
 * @param {object} [deps]
 */
export async function executeRun(options, deps = {}) {
  const {
    launch = launchParticipants,
    collect = collectStats,
    close = closeParticipants,
    createSampler = createCpuSampler,
    writeFileSync = fs.writeFileSync,
    mkdirSync = fs.mkdirSync,
    readdirSync = fs.readdirSync,
    now = () => Date.now(),
    applyCap = applyCapIfNeeded,
    clearCap = clearCapIfNeeded,
  } = deps;

  const baseUrl = options.baseUrl ?? defaultBaseUrl(options.mode);
  const roomId = options.roomId || DEFAULT_ROOM_ID;
  const cappedPeerId = options.cappedPeer || 'p1';
  const sfuPid = resolveSfuPid(process.env);
  const sampler = createSampler({ extraPids: sfuPid > 0 ? [sfuPid] : [] });

  const modeDir = path.join(options.outDir, options.mode);
  mkdirSync(modeDir, { recursive: true });

  const trialNum =
    options.trial != null
      ? Number(options.trial)
      : nextTrialNumber(modeDir, options.n, options.cap, { readdirSync });
  if (!Number.isInteger(trialNum) || trialNum < 1) {
    throw new Error(`Invalid trial: ${options.trial ?? trialNum}`);
  }
  const trial = formatTrial(trialNum);
  const outPath = resolveRunPath(options.outDir, options.mode, {
    n: options.n,
    cap: options.cap,
    trial,
  });

  let browsers = [];
  let tcApplied = false;
  /** @type {string[]} */
  const noteParts = [`Phase 7 runOnce trial ${trial}`, `cappedPeer=${cappedPeerId}`];
  const startedAt = new Date(now()).toISOString();

  try {
    const capResult = await applyCap({
      cap: options.cap,
      tcIface: options.tcIface,
    });
    tcApplied = Boolean(capResult.applied);
    if (capResult.note) noteParts.push(capResult.note);

    const launched = await launch({
      n: options.n,
      mode: options.mode,
      baseUrl,
      roomId,
      joinTimeoutMs: options.joinTimeoutMs,
      headless: options.headless,
      audioFile: options.audioFile,
    });
    browsers = launched.browsers;

    const collected = await collect({
      pages: launched.pages,
      durationSec: options.durationSec,
      sampleIntervalMs: options.sampleIntervalMs,
      sampleCpu: (pids) => sampler.sample(pids),
      sfuPid,
    });

    const endedAt = new Date(now()).toISOString();
    const doc = buildRunDocument({
      mode: options.mode,
      n: options.n,
      uplinkCap: options.cap,
      cappedPeerId,
      durationSec: options.durationSec,
      sampleIntervalMs: options.sampleIntervalMs,
      startedAt,
      endedAt,
      joinTimeMs: collected.joinTimeMs,
      participants: collected.participants,
      sfuSamples: collected.sfuSamples,
      sfuPid,
      chromium: launched.chromiumVersion ?? '',
      notes: noteParts.join('; '),
    });

    const errors = validateRunDocument(doc);
    if (errors.length) {
      throw new Error(`Invalid run document:\n- ${errors.join('\n- ')}`);
    }

    const minSamples = expectedMinSamples(options.durationSec, options.sampleIntervalMs);
    for (const p of doc.participants) {
      if (p.samples.length < minSamples) {
        throw new Error(
          `${p.peerId} has ${p.samples.length} samples; expected >= ${minSamples}`,
        );
      }
    }

    writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
    return { outPath, doc, trial, tcApplied };
  } finally {
    await close(browsers);
    if (options.tcIface) {
      try {
        await clearCap({ tcIface: options.tcIface });
      } catch (err) {
        console.error(
          `warning: failed to clear tc on ${options.tcIface}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }
}

async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    console.error(usageText());
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    console.log(usageText());
    return;
  }

  console.log(
    JSON.stringify(
      {
        msg: 'runOnce start',
        mode: options.mode,
        n: options.n,
        durationSec: options.durationSec,
        cap: options.cap,
        tcIface: options.tcIface ?? null,
        cappedPeer: options.cappedPeer,
        outDir: options.outDir,
      },
      null,
      2,
    ),
  );

  try {
    const result = await executeRun(options);
    console.log(
      JSON.stringify(
        {
          msg: 'runOnce ok',
          outPath: result.outPath,
          runId: result.doc.runId,
          trial: result.trial,
          samplesPerPeer: result.doc.participants.map((p) => ({
            peerId: p.peerId,
            samples: p.samples.length,
          })),
        },
        null,
        2,
      ),
    );
  } catch (err) {
    console.error(err instanceof Error ? err.stack || err.message : err);
    process.exitCode = 1;
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  await main(process.argv.slice(2));
}

export { main };
