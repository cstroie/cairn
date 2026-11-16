# Low Water

A very slow tide pool you can't control. Ten rocks, a tide every 12 hours 25 minutes on the real
clock, and one decision: what not to disturb. An installable web app (PWA) that works offline and
updates itself; the graphics and the sounds are made in code, there are no image or sound files.

It is the web sister of [TIDEPOOL](https://github.com/cstroie/tidepool), an idle game in Z80
assembly for CP/M 2.2 that lives on the shelf of [DigitalRerun](https://github.com/cstroie/digital-rerun).
The rules of the pool and their numbers are the same, and both keep the same tide.

Player's guide: [docs/PLAYING.md](docs/PLAYING.md). Design notes: [docs/DESIGN.md](docs/DESIGN.md).

    node tools/serve.js     the app on http://localhost:8125
    node --test             the tests (Node 22, no dependencies)
    node tools/stamp.js     after any change to the app: the build stamp in js/version.js

No framework, no build step, no dependencies. English and Romanian. MIT licence.
