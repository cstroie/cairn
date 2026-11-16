# Low Water: design notes

An idle game on the clock. Vanilla ES modules, Canvas 2D, WebAudio; no framework, no build, no
dependencies, no image or sound files.

## Files

| File | Role |
|------|------|
| `js/core/tide.js` | the clock: tide, moon, sun, season, weather; pure functions of the time |
| `js/core/sim.js` | one tide (`simTide`), the species rules, the journal, `trample`, cairns |
| `js/core/state.js` | the save: a new pool, load/save/migrate, `arrive` (coming back) |
| `js/core/rng.js` | the pool's generator (its state is in the save) and a stateless hash |
| `js/render/scene.js` | layout, the still layer, a frame; `sky.js`, `water.js`, `rocks.js`, `creatures.js` |
| `js/audio/engine.js` | surf, wind, rain, the bell, chimes: all synthesized |
| `js/ui/hud.js`, `panels.js` | the chips, the rock card; the diary, tide table, settings, welcome |
| `js/i18n.js`, `lang/*.js` | the words: strings, plurals and journal sentences per language |
| `js/main.js` | the start, the once-a-second tick, the frame loop, pointer and keys |
| `sw.js`, `js/pwa.js`, `js/version.js` | offline cache and self-update |
| `tools/` | `serve.js`, `stamp.js`, `shot.js` (screenshots), `icons.js` |

## Time

`M` is minutes since 31 December 1977 on the wall clock, the count of the CP/M TIDEPOOL (its clock
device gives days since that date), so both games show the same tide. A tide is 745 minutes:
tide number `M / 745`, minute within it `M mod 745` (0 high water, 372 low). The save keeps `last`
(the last tide simulated). `catchUp` runs `simTide` for every tide in between, at most 2000.

The picture's water level is a cosine of the minute within the tide; its range grows with
`springness` (1 at new and full moon, from a mean synodic month). The simulation does not depend
on the level: a tide is a tide.

## The pool

A rock is `{ sp, g, calm, cairn, name }`: species, growth 0-255 (a size every 64), tides since it
was stepped on, a cairn, a name. `simTide` is a port of `sim.asm`: a random byte against a
threshold, with the same tables (storm 14/7/4/12 of 256 by season, settling 30/80/56/56, crabs
4/6/10/6), the same growth (winter halves it, summer adds a quarter) and the same thresholds
(an anemone at calm 24, a sea star at calm 16). The generator is mulberry32, not the Z80 one, so
the two games do not roll the same dice.

A new pool has already seen 36 tides, so there is life at first sight; its journal starts empty.

## Leaving

On CP/M you leave with Q. Here a visit ends when the page has been hidden for more than ten
minutes (`VISIT_GAP`): `arrive` then runs `trample` first (as of the time of leaving), then the
tides. `away` is stamped when the page is hidden and every 30 seconds while it is shown, so a page
that is killed without warning is still a departure.

## The picture

The scene is `max(width, 1.6 x height)` wide and pans when it does not fit. The ridge, the sand
and the rocks are drawn once into a layer (shapes from the pool's seed); each frame draws sky,
far sea, that layer, the creatures, the water over them, cairns and names, the night, the weather,
a paper grain. Creatures take the water line: barnacles feed and anemones open only when covered,
kelp stands in water and falls over in air.

## Self-update

As DigitalRerun: every file in `SHELL` (`sw.js`) is cached under `lowwater-{VERSION}-{BUILD}`;
`BUILD` is a hash of those files written by `tools/stamp.js`, and a test fails when it is stale
or when a file of the app is missing from the list. A new worker waits; because the pool is saved
on every change it takes over at once when the app starts or is out of sight, and otherwise
offers a button.

## Looking at a moment

`?at=2026-06-21T12:00&rate=600&seed=7&demo=1&lang=ro` sets the time, its speed, the pool, a pool
with one of everything, the language. With any of them nothing is saved.
