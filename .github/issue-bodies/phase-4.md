## Summary

Harden a stable in-page automation API on both mesh and SFU React clients for Puppeteer.

**Plan ref:** [docs/IMPLEMENTATION_PLAN.md](../blob/main/docs/IMPLEMENTATION_PLAN.md) — Phase 4  
**Depends on:** Phase 2 and Phase 3  
**Rule:** Complete hooks now — do not defer a second rewrite for automation.

## Automation contract

| Hook / query | Behavior |
|--------------|----------|
| `?roomId=&peerId=&autojoin=1&video=0` | Auto getUserMedia + join on load |
| `window.__webrtcReady` | `true` when joined / negotiation started |
| `window.__waitUntilConnected(nMinus1)` | Resolves when remotes ready + inbound bytes moved |
| `window.__webrtcStats()` | Full sample object |
| `window.__getJoinTimeMs()` | Join start → connected |
| `window.__leave()` | Full teardown |

Also: `data-testid="status"` → `idle|joining|connected|failed`.

## Acceptance

- [ ] URL with `autojoin=1` connects without clicking
- [ ] `__waitUntilConnected(2)` resolves in a 3-party room
- [ ] `__leave()` causes remotes to see peer departure
- [ ] Same API surface on mesh and SFU pages

## Exit gate

Puppeteer can drive pages primarily via URL + `window` hooks.
