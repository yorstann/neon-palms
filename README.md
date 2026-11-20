# neon-palms

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/yorstann/neon-palms/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/yorstann/neon-palms/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Neon Palms — Palmera Bay.** An original top-down open-world crime game that
runs entirely in the browser: no build step, no assets, no network calls.
Every sprite is drawn in code and every sound is synthesised with WebAudio.

You are Reyes, a driver who just hit the coastal city of Palmera Bay with
$120 and a phone number. Fixer Mara Voss has work: a six-job story campaign
(pickups, contraband runs, a stolen accountant, a timed bay race and a
harbour finale) plus open-world systems to play with between jobs —

- a living city of seven districts with day/night cycle, traffic that
  queues, yields and honks, and pedestrians who stroll, panic and dive
  out of the way;
- five car types with arcade handling; steal anything with a door;
- a five-star wanted system: witnessed crimes raise heat, interceptors
  hunt you, officers close in on foot, and a respray shop or a low
  profile loses the tail;
- taxi fares, 20 hidden packages, cash/health/armour pickups, a pistol
  with melee fallback, busted & wasted loops, and a save file that
  remembers cash, story progress, packages, stats and your resprayed ride.

Controls: WASD walk & drive · E enter/exit car · mouse aim, click or F to
fight/shoot · 1/2/Z weapons · Shift run · Space handbrake · Esc pause ·
M mute.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

(Or serve the `game/` folder with any static file server and open
`index.html`. Add `?seed=N` for a different city shuffle, and
`?shot=title|downtown|chase|mission&seed=1` for the deterministic scenes
the screenshots in `screenshots/` were captured from.)

---

<sub>Entered on [make.fun](https://make.fun/?ref=2qd39n6s&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
