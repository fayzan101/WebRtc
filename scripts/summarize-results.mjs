#!/usr/bin/env node
/** Phase 6 CLI entry — delegates to @webrtc/automation summarizer. */
import { main } from '../automation/src/summarizeCli.js';

await main(process.argv.slice(2));
