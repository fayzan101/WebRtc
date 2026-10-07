# Mesh Call UI redesign changelog

## What changed (UI only)

- **Splash screen** (`SplashScreen`) — ~2.2s overlay with animated mesh SVG logo, progress shimmer, cycling status text; click/key skips; skipped when `?autojoin=1`
- **Dual themes** — Obsidian Glass / Blue Steel segmented control; persisted in `localStorage` (`mesh-call-theme`) with try/catch
- **Header card** — logo mark, title, `N−1` chip, theme switcher, live connection badge
- **Session card** — icon inputs, helper text, video **toggle switch**, gradient Join, Leave turns red when active; status Idle / Connecting / Live / Error
- **Participants card** — 16:9 responsive grid, quality dots, overlays, empty-state illustration + CTA, count badge (`aria-live`)
- **Live stats card** — 8 metric tiles with units, threshold colors (RTT/jitter/loss), sparklines (last 30 samples), pulsing getStats indicator
- **Developer info footer** — monospace chips for `/ws`, `?stun=1`, automation URL + copy buttons
- **Design system** — CSS variables, glass panels, 12/14/16/20/32 type scale, reduced-motion support

## Intentionally unchanged (logic)

- `hooks/useMeshRoom.ts`
- `lib/signaling.ts`, `lib/mesh.ts`, `lib/stats.ts`, `lib/automation.ts`, `lib/polite.ts`
- Signaling path `/ws`, `?stun=1` ICE, `?autojoin=1&roomId=&peerId=` automation

## Preserved hooks / IDs

| ID / hook | Role |
|-----------|------|
| `#room-id`, `#peer-id` | Session inputs |
| `#video-toggle` | Low-res video switch |
| `#join-btn`, `#leave-btn` | Join / Leave |
| `#call-status` + `data-testid="status"` | Status pill |
| `#stat-*` (8 metrics) | Live stats |
| `#theme-obsidian-glass`, `#theme-blue-steel` | Theme chips |
| `#chip-ws`, `#chip-stun`, `#chip-autojoin` | Dev URL chips |

## Note on “single HTML file”

The project’s Mesh client remains **Vite + React modules** so WebRTC/signaling logic is not inlined or rewritten. Collapsing to one HTML file would violate the “do not change signaling/WebRTC/stats logic” constraint. Run with `npm run mesh:client` as before.
