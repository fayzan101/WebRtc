# Optional Advanced Features

Complete these only after the core POC and uncapped + capped matrices work.

---

## A. Simulcast + Bandwidth-Limited Receiver

### Idea

Publisher sends multiple encodings; SFU selects a **layer per subscriber**. Cap **one receiver’s downlink** (or uplink of a constrained peer) with `tc` and show the SFU adapts (low layer) while others keep higher quality.

### Steps

1. Enable simulcast on LiveKit publish (multiple `videoEncodings` / SDK simulcast options). Audio-only labs can use video layers for a clearer effect.
2. Apply `tc` to **one subscriber’s ingress/egress** to emulate a weak access link.
3. Compare subscribed resolution/bitrate for capped vs uncapped receivers at N = 4–6.
4. Record which layer was active (SDK events or track settings).

### Metrics

- Per-receiver downlink bitrate
- Frame size / layer id if available
- Loss on capped receiver vs others

---

## B. Audio-Mixing MCU Comparison

### Idea

Contrast SFU **forwarding** with MCU **mix**:

| | SFU | MCU |
|---|-----|-----|
| Client uplink | 1 | 1 |
| Client downlink | N−1 | **1 mixed** |
| Server cost | Forward RTP | Decode + mix + encode |

### Approaches

- Janus AudioBridge / similar MCU plugin
- Or a simple server-side mixer (heavier; optional)

### Measure

- Client downlink vs N (should stay ~flat for MCU audio mix)
- Server CPU (MCU much higher)
- Mixing latency / quality

Use this to explain why many productions use **SFU + selective subscribe** rather than always-on MCU.

---

## C. Active-Speaker Detection

### Idea

Only forward or highlight the active speaker(s) to reduce downlink / UI clutter.

### Options

- LiveKit active speaker events (`ActiveSpeakersChanged`)
- Client-side audio level via `getStats` / WebAudio analyser
- Mesh: still receive all (unless you add app-level mute of non-speakers — limited benefit)

### Demo

1. N = 6 SFU room
2. Log active speaker ids over time with fake/real audio energy
3. Optional: subscribe video only for top-K speakers (bandwidth win)

---

## D. Cross-Network TURN Test

### Idea

Move one peer off lab LAN (phone hotspot / different NAT). Enable **TURN** (LiveKit embedded TURN or **coturn**). Compare join success and RTT/loss vs pure LAN host candidates.

Document candidate types selected (`host` / `srflx` / `relay`).

---

## E. Wireshark Protocol Lab

Capture and annotate:

1. WebSocket signaling handshake (TCP)
2. DTLS handshake
3. SRTP/RTP media (UDP)
4. RTCP sender/receiver reports

Submit annotated screenshots in the report appendix.

---

## Priority Order if Time-Limited

1. Simulcast + one limited receiver  
2. Active-speaker logging on LiveKit  
3. TURN cross-network  
4. MCU comparison (largest extra effort)
