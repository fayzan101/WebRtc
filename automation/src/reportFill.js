/**
 * Fill a lab report markdown from summary CSV rows + optional failure markdown.
 */

/**
 * @param {object[]} rows
 * @param {string} [cap]
 */
export function markdownMetricTable(rows, cap = 'uncapped') {
  const subset = rows
    .filter((r) => r.uplinkCap === cap)
    .sort(
      (a, b) =>
        String(a.mode).localeCompare(String(b.mode)) || a.n - b.n || String(a.trial).localeCompare(String(b.trial)),
    );
  if (!subset.length) return `_No rows for uplinkCap=${cap}._\n`;

  const lines = [
    `| mode | n | uplink kbps | downlink kbps | CPU client | join ms | loss |`,
    `| --- | --- | --- | --- | --- | --- | --- |`,
  ];
  for (const r of subset) {
    lines.push(
      `| ${r.mode} | ${r.n} | ${fmt(r.uplinkKbpsMean, 2)} | ${fmt(r.downlinkKbpsMean, 2)} | ${fmt(r.cpuClientMean, 2)} | ${Math.round(r.joinTimeMs)} | ${fmt(r.lossMean, 4)} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

/**
 * @param {number} n
 * @param {number} d
 */
function fmt(n, d) {
  return Number.isFinite(n) ? n.toFixed(d) : '—';
}

/**
 * Extract failure N cells from failure-points.md table if present.
 * @param {string} failureMd
 */
export function parseFailureTable(failureMd) {
  /** @type {Record<string, { status: string, failureN: string, notes: string }>} */
  const map = {};
  if (!failureMd) return map;
  for (const line of failureMd.split(/\r?\n/)) {
    const m = /^\|\s*(mesh|sfu)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*(.*)\|$/.exec(line);
    if (!m) continue;
    const mode = m[1].trim();
    const cap = m[2].trim();
    if (cap === 'cap') continue;
    map[`${mode}:${cap}`] = {
      status: m[3].trim(),
      failureN: m[4].trim(),
      notes: m[5].trim(),
    };
  }
  return map;
}

/**
 * @param {object} opts
 */
export function buildFilledReport(opts) {
  const {
    rows,
    failureMd = '',
    authors = 'Faizan Basheer (24K0571), Pankaj Lal (24K0805)',
    environment = 'Lab / single-laptop; Node 18+; Chromium via Puppeteer; LiveKit `--dev`',
    figureRelDir = 'figures',
    sourceNote = 'Figures and tables generated from schema-v1 summary CSV (fixtures or `results/summary/bitrate-vs-n.csv`).',
  } = opts;

  const uncappedTable = markdownMetricTable(rows, 'uncapped');
  const cap1Table = markdownMetricTable(rows, '1Mbps');
  const cap5Table = markdownMetricTable(rows, '5Mbps');
  const failures = parseFailureTable(failureMd);

  const mesh1 = failures['mesh:1Mbps'];
  const mesh5 = failures['mesh:5Mbps'];
  const sfu1 = failures['sfu:1Mbps'];
  const sfu5 = failures['sfu:5Mbps'];

  const meshUplinkTrend = describeUplinkTrend(rows, 'mesh', 'uncapped');
  const sfuUplinkTrend = describeUplinkTrend(rows, 'sfu', 'uncapped');

  return `# Project 23: WebRTC Group Calling — Mesh vs SFU Architecture and Bandwidth Scaling

- **Author(s):** ${authors}
- **Date:** ${new Date().toISOString().slice(0, 10)}
- **Environment:** ${environment}
- **Data note:** ${sourceNote}

---

## 1. Abstract

This project implements group audio calling in **mesh** (N−1 peer connections) and **SFU** (LiveKit) modes, then measures scaling for N = 2…6 with Puppeteer automation. Uncapped summary data show mesh uplink rising with N while SFU uplink stays roughly flat (${meshUplinkTrend}; ${sfuUplinkTrend}). Under uplink caps, failure detection (loss > 5% or mesh floor \`(N−1)×25 kbps\`) produces \`failure-points.md\` for report annotation.

---

## 2. Introduction

- **Problem:** 1:1 WebRTC does not scale; mesh uplink grows with N−1.
- **Goal:** relate architecture choice to throughput demands and access-link bottlenecks.
- **Modes:** Mesh (custom WebSocket signaling) vs SFU (LiveKit).

---

## 3. Background

- **Mesh:** N−1 \`RTCPeerConnection\`s; P2P UDP media; signaling over WebSocket.
- **SFU:** one publish uplink; selective forward without mixing.
- **Protocols:** ICE/STUN, DTLS-SRTP, RTP/RTCP, WebSocket signaling, UDP media.

---

## 4. Architecture and Implementation

### 4.1 Mesh

Node/Express + \`ws\` room registry; React/Vite client; perfect negotiation; automation hooks (\`__webrtcReady\`, \`__waitUntilConnected\`, \`__webrtcStats\`).

### 4.2 SFU

LiveKit \`--dev\`; Express token API; React publish/subscribe client; same automation hook contract.

### 4.3 Automation

Puppeteer + fake media; \`runOnce\` / \`runMatrix\`; \`pidusage\` CPU; schema-v1 JSON; \`summarize\` → CSV + failure points; optional \`tc-uplink.sh\` via \`--tc-iface\`.

---

## 5. Experimental Method

- **Matrix:** N = 2…6; modes mesh/sfu; caps \`uncapped\` / \`1Mbps\` / \`5Mbps\` on capped peer (\`p1\`).
- **Duration / interval:** typically 60–90 s, sample every 2 s; means drop first ~10 s ramp.
- **Failure criteria:** mean loss > 5%, or mesh capped-peer median uplink < \`(N−1)×25 kbps\`; CPU ≥ 90% → CPU-bound inconclusive.
- **tc:** Linux \`scripts/tc-uplink.sh apply <iface> 1mbit|5mbit\` when \`--tc-iface\` is set.

---

## 6. Results

### 6.1 Uncapped scaling

![Uplink vs N](${figureRelDir}/uplink-vs-n.svg)

![Downlink vs N](${figureRelDir}/downlink-vs-n.svg)

![Client CPU vs N](${figureRelDir}/cpu-vs-n.svg)

![Join time vs N](${figureRelDir}/join-vs-n.svg)

${uncappedTable}

### 6.2 Uplink-limited scaling

${cap1Table.trim() === '_No rows for uplinkCap=1Mbps._' ? '_No 1Mbps rows in current summary CSV — run capped matrix on Linux with \`--tc-iface\`._\n' : cap1Table}

${cap5Table.trim() === '_No rows for uplinkCap=5Mbps._' ? '_No 5Mbps rows in current summary CSV._\n' : cap5Table}

![Loss vs N (uncapped reference)](${figureRelDir}/loss-vs-n.svg)

### 6.3 Failure point

| Cap | Mesh fails at N | SFU status at that N |
|-----|-----------------|----------------------|
| 1 Mbps | ${mesh1?.failureN ?? '—'} (${mesh1?.status ?? 'no-data'}) | ${sfu1 ? `${sfu1.status} @ N=${sfu1.failureN}` : '—'} |
| 5 Mbps | ${mesh5?.failureN ?? '—'} (${mesh5?.status ?? 'no-data'}) | ${sfu5 ? `${sfu5.status} @ N=${sfu5.failureN}` : '—'} |

${failureMd ? '#### Detector detail\n\n' + failureMd.trim() + '\n' : '_Run \`npm run summarize\` after capped experiments to populate failure-points.md._\n'}

---

## 7. Discussion

- Uncapped mesh uplink scales upward with N; SFU uplink remains near one stream — matching the O(N−1) vs ~O(1) model.
- Under caps, access-link shaping (when \`tc\` is applied) is expected to fail mesh earlier than SFU; if only CPU ≥ 90% is observed, classify as CPU-bound / inconclusive on a single laptop.
- **Limitations:** single-laptop CPU confound, fake media, audio-first, lab LAN; NIC \`tc\` on one host shapes all local browsers.

---

## 8. Conclusion

Architecture choice maps directly to uplink demand: mesh multiplies sends by N−1 while an SFU keeps client uplink roughly constant, shifting cost to the middlebox and downlink. Measured summary curves and failure-point rules make that bottleneck relationship concrete for the lab report.

---

## 9. Optional Advanced Work

Not started in Phase 8 core polish (simulcast / active speaker / TURN remain optional per IMPLEMENTATION_PLAN).

---

## Appendix A — How to Run

\`\`\`bash
npm install
cp .env.example .env

# Mesh
npm run mesh
npm run mesh:client

# SFU
npm run livekit
npm run sfu
npm run sfu:client

# One run / matrix / summarize / plot / report
npm run run-once -- --mode mesh --n 2 --duration 20 --cap uncapped
npm run matrix -- --dry-run
npm run summarize
npm run plot
npm run fill-report

# Linux uplink cap
sudo ./scripts/tc-uplink.sh apply eth0 1mbit
npm run run-once -- --mode mesh --n 3 --cap 1Mbps --tc-iface eth0 --duration 20
sudo ./scripts/tc-uplink.sh clear eth0
\`\`\`

## Appendix B — Raw Data Index

- Schema: \`schemaVersion: 1\` ([DATA_SCHEMA.md](DATA_SCHEMA.md))
- Runs: \`results/{mesh,sfu}/n{N}-{cap}-{trial}.json\`
- Summary: \`results/summary/bitrate-vs-n.csv\`
- Failure points: \`results/summary/failure-points.md\`
- Fixtures (pre-live): \`dashboard/client/public/fixtures/\`

## Appendix C — Packet Captures

Optional: Wireshark filter \`udp or websocket\` — TCP signaling vs UDP media.
`;
}

/**
 * @param {object[]} rows
 * @param {string} mode
 * @param {string} cap
 */
function describeUplinkTrend(rows, mode, cap) {
  const pts = rows
    .filter((r) => r.mode === mode && r.uplinkCap === cap)
    .sort((a, b) => a.n - b.n);
  if (pts.length < 2) return `${mode} uplink: insufficient points`;
  const lo = pts[0];
  const hi = pts[pts.length - 1];
  return `${mode} uplink ${fmt(lo.uplinkKbpsMean, 0)}→${fmt(hi.uplinkKbpsMean, 0)} kbps (N=${lo.n}→${hi.n})`;
}
