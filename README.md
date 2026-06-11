# 🏏 Retro Cricket — IPL Edition

A retro-style browser cricket manager inspired by Retro Bowl. Build your IPL franchise, sign real players, manage contracts and staff, then step onto the pitch in first-person gameplay.

![Retro Cricket](https://img.shields.io/badge/Game-Browser-ffd84d?style=flat-square) ![IPL](https://img.shields.io/badge/League-IPL-blue?style=flat-square) ![Vanilla JS](https://img.shields.io/badge/Built%20with-Vanilla%20JS-yellow?style=flat-square)

---

## Features

### Management (Hub)
- **10 IPL Teams** — all real squads with real player names (Kohli, Bumrah, Dhoni, Rohit, Gill, Rashid Khan, and more)
- **Salary Cap** — ₹110 crore budget; sign, release, and re-sign players with contract management
- **Free Agents & Academy** — recruit free agents or promote youth prospects each offseason
- **Coaching Staff** — upgrade batting, bowling, and fielding coaches using Coach Credits
- **Facilities** — level up Training, Physio, and Academy to boost player development
- **Season Schedule** — full IPL round-robin (14 matches per team) + playoffs (Q1 / Eliminator / Q2 / Final)
- **Media Events** — press conferences that affect fan trust, morale, and star players
- **Stats & Table** — live standings, player career stats, and season leaderboards
- **Persistent Save** — auto-saves to `localStorage`; survives page reloads

### Match Engine
- **First-Person Batting View** — look through the batter's eyes; see the bowler run in, ball in flight, bounce marker, and field radar
- **First-Person Bowling View** — control your delivery from the bowler's perspective with a targeting reticle and zone labels (GOOD LENGTH, YORKER, BOUNCER, etc.)
- **Batting Mechanics**
  - Drag to aim your shot direction
  - Short drag = BLOCK, medium = GROUND DRIVE, long = LOFT/SIX
  - Timing ring shows when to play — tap early/late for mistimed shots
  - Run-steal gamble after every hit with probability overlay
- **Bowling Mechanics**
  - Set line & length by clicking the target reticle
  - Power meter climbs 750 ms — release in the green band for a PERFECT delivery
  - Spin drift after pitch, seam movement, and yorker squeeze
- **Night Stadium**
  - Dusk sky with stars and twin floodlight towers
  - Animated two-tier crowd that waves on boundaries
  - Pixel ad boards, 30-yard circle, mowing stripes
- **Pixel Cricketers** — full parametric sprite: helmet, pads, bat, gloves, crouch animations
- **Camera Effects** — screen shake on sixes/wickets, confetti, stump burst particles, run-up camera bob

---

## Getting Started

### Run locally (recommended)

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/retro-cricket.git
cd retro-cricket

# Start the no-cache dev server
python3 serve.py

# Open in browser
open http://localhost:8471
```

> The bundled `serve.py` sends `Cache-Control: no-store` headers so your browser always loads the latest code.

### Or just open the file

```bash
open index.html
```

> Note: some browsers block local file imports. Use the Python server for the best experience.

---

## File Structure

```
retro-cricket/
├── index.html      # Entry point — loads all scripts
├── style.css       # Retro pixel UI theme
├── data.js         # All 10 IPL teams, player rosters, free agents, media events
├── engine.js       # Game state, simulation logic, save/load
├── match.js        # First-person renderer, ball physics, batting/bowling mechanics
├── ui.js           # Hub screens: Squad, Lineup, Facilities, Staff, Office, Table, Stats, News
└── serve.py        # No-cache HTTP dev server
```

---

## Controls

| Action | Input |
|---|---|
| Play shot | Click / drag on canvas |
| Aim direction | Drag angle determines shot type |
| Bowl — set target | Click the reticle |
| Bowl — release | Click when meter is in green |
| Steal a run | Click YES / NO on the gamble overlay |
| Hub navigation | Click tabs |

---

## Tech

- **Vanilla JS + HTML5 Canvas** — zero dependencies, no build step
- **320×240 internal resolution** scaled to viewport via CSS (`image-rendering: pixelated`)
- **Perspective projection** — world-to-screen math for pitch depth and fielder sizing
- **localStorage** persistence — JSON save state

---

## Screenshots

> Coming soon — run the game locally to see it in action!

---

## License

MIT
