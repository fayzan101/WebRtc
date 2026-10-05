# Lab Report Template

Copy this structure into your submission document (PDF/Markdown). Replace bracketed prompts with measured results.

---

## Title

**Project 23: WebRTC Group Calling — Mesh vs SFU Architecture and Bandwidth Scaling**

- Author(s):
- Date:
- Environment (OS / CPU / single-laptop? / LAN):

---

## 1. Abstract

[3–5 sentences: what you built, what you measured, the main finding about where mesh breaks vs SFU.]

---

## 2. Introduction

- Problem: 1:1 WebRTC does not scale; mesh uplink grows with N
- Goal: relate architecture to throughput demands and access-link bottlenecks
- Modes compared: Mesh vs SFU (LiveKit)

---

## 3. Background

Briefly explain:

- Mesh: N−1 peer connections; P2P UDP
- SFU: one uplink; forward without mixing
- Relevant protocols: WebSocket signaling, ICE/STUN, DTLS-SRTP, RTP/RTCP, UDP media

---

## 4. Architecture and Implementation

### 4.1 Mesh

- Signaling server design
- Offer/answer + ICE trickle
- Diagram

### 4.2 SFU

- LiveKit `--dev`
- Client publish/subscribe flow
- Diagram

### 4.3 Automation

- Puppeteer + fake media
- Stats collection method

---

## 5. Experimental Method

- Matrix: N = 2..6; modes; caps 1 Mbps and 5 Mbps on one client
- Duration, sample interval, repeats
- Failure criteria
- How `tc` was applied (interface, direction)

---

## 6. Results

### 6.1 Uncapped scaling

[Table + plots: uplink/downlink/CPU/join time vs N]

### 6.2 Uplink-limited scaling

[Table + plots: loss/bitrate under 1 Mbps and 5 Mbps]

### 6.3 Failure point

| Cap | Mesh fails at N | SFU status at that N |
|-----|-----------------|----------------------|
| 1 Mbps | | |
| 5 Mbps | | |

---

## 7. Discussion

- Which bottleneck dominated (uplink, downlink, CPU, SFU egress)?
- Do results match O(N) mesh uplink theory?
- Limitations (single laptop, fake media, audio-only, lab LAN)
- What would change with real video or WAN conditions?

---

## 8. Conclusion

[Restate architecture→bottleneck relationship in 1 short paragraph.]

---

## 9. Optional Advanced Work

[Simulcast / MCU / active speaker — if any]

---

## Appendix A — How to Run

```text
[commands to start mesh, LiveKit, automation matrix]
```

## Appendix B — Raw Data Index

```text
results/... file list and schema version
```

## Appendix C — Packet Captures

[Optional Wireshark screenshots: TCP signaling vs UDP media]
