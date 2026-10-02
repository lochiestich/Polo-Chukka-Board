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
```

All the app code is in `src/App.jsx`.

## Deployment

Every push to `main` builds the app and publishes it to GitHub Pages via
`.github/workflows/deploy.yml`. One-time setup: in the repo's
**Settings → Pages**, set **Source** to **GitHub Actions**.

`legacy/chukka-board-app.html` is the old hand-compiled build. It's kept for
reference only; nothing serves it any more.
