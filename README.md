# Chukka Board

Chukka scheduling board for Manyatta Polo Club. Enter the roster (handicap,
chukkas wanted, early/late and slow preferences) and it builds the day's board
with balanced Blue/White teams.

See [`docs/HANDOFF.md`](docs/HANDOFF.md) for how the scheduling works, and read
its "Hard lessons" section before changing the priority order in
`assignColours()`.

## Development

```
npm install
npm run dev      # local dev server with hot reload
npm run build    # production build into dist/
npm run preview  # serve the production build locally
npm run sanity   # run the scheduler over the club's real rosters and check it
```

The scheduling logic is in `src/scheduler.js`; the UI is in `src/App.jsx`.
`npm run sanity` runs every roster in `scripts/rosters.mjs` (taken from the
club's hand-made boards) through each beginner placement, prints a quality table and fails
if a structural rule breaks. CI runs it before every deploy.

## Deployment

Every push to `main` builds the app and publishes it to GitHub Pages via
`.github/workflows/deploy.yml`. One-time setup: in the repo's
**Settings → Pages**, set **Source** to **GitHub Actions**.
