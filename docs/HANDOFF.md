# Chukka Board — Handoff

A scheduling tool for Manyatta Polo Club (Kenya): takes a roster (name, handicap,
chukkas wanted, timing/pace preferences) and produces a full day's chukka board —
who plays which chukka, split into balanced Blue/White teams — with a lot of
club-specific rules layered on top, arrived at through a long back-and-forth of
"here's a real board that went wrong, fix it" iterations. Currently deployed as a
standalone HTML file on GitHub Pages / installed to an Android home screen as a PWA.

## Files

- **`src/App.jsx`** — the source of truth (was `chukka-board.jsx` in the original
  handoff). A single-file React component using `lucide-react` icons and Tailwind.
- **`legacy/chukka-board-app.html`** — the old hand-compiled standalone build, kept
  for reference only. Nothing serves it.

## Build and deploy

A Vite + React build replaced the old hand-compiled HTML file. `npm run dev` for
local work and `npm run build` for production. Tailwind v3 is compiled at build
time and html2canvas is bundled, so the app loads nothing from a CDN.
`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push
to `main`; Pages must be set to **Source: GitHub Actions** in the repo settings.

## The data model

```js
{
  id,              // auto-incrementing
  name,
  handicap,        // -2 to 10, 0.5 steps (Kenya handicap scale)
  chukkasWanted,   // total chukkas requested for the day
  timingPref,      // 'none' | 'early' | 'late'
  slowChukkas,     // how many of chukkasWanted must be a "slow" chukka
}
```

There used to be a mirrored `fastChukkas` field. It was removed on purpose — "fast"
is now purely an **emergent, informational label** computed *after* scheduling (see
Display pace below), never something a player requests directly.

## Master handicap list

`MASTER_HANDICAPS` is a baked-in array of ~109 `{name, handicap}` entries from the
KPA (Kenya Polo Association) handicap list, sourced from a club PDF. A second
"yellow" block further down that sheet was a separate list and was deliberately
excluded. Names are stored as "Firstname + initial" (e.g. `Harry S`). This powers a
type-ahead on the Name field: typing shows matches from the list, selecting one
fills in the handicap automatically; typing something that doesn't match just adds
a normal one-off player with a manually-set handicap.

## Scheduling: a two-stage pipeline, run 15×, best attempt kept

### Stage 1 — `fillChukkas()`: who plays in which chukka

- **Pour-fill order**: Chukka 1 fills to capacity before Chukka 2 starts, and so
  on. The *only* chukka that can come up short is the last one, if total requested
  chukkas doesn't divide evenly.
- **Chukka count is derived, not set**: `numChukkas = ceil(totalChukkasRequested / 8)`.
  Always 4-a-side (8 per chukka) — this used to be adjustable but was fixed at 4
  explicitly per request; don't reintroduce a team-size control without being asked.
- **Per-slot selection** is a greedy score (highest wins), roughly in this order of
  influence:
  1. **Deficit** (`chukkasWanted - alreadyAssigned`) dominates everything (×1000)
     — this is what actually makes the pour-fill pour.
  2. **Early/late timing preference** — a *soft* nudge, not a hard rule (see "Hard
     lessons" — it used to be a hard rule and that caused a real bug). Leans early
     toward the first two-thirds of the day and late toward the last two-thirds,
     scaled by urgency, but yields if honouring it would force an unbalanceable
     chukka downstream.
  3. **Slow-chukka bucket matching** — chukkas get pre-labelled `'slow'` or
     `'neutral'` by `buildPaceLabels()`, proportional to total slow-chukka demand.
     A slow-requester gets a bonus for slow-labelled chukkas, and separately a
     penalty for joining a `'neutral'` chukka that's trending toward a high average
     handicap (so they don't end up somewhere that displays as "fast" anyway).
  4. **Beginner (-2 handicap) handling**:
     - Automatically forced to need *all* their chukkas as "slow", overriding
       whatever their own `slowChukkas` count says.
     - A clustering bonus pulls multiple -2s toward the same chukka as each other
       (nobody else gets this treatment, even other slow-requesters).
     - Any chukka with a beginner in it caps out at **one player with handicap >
       0** — a second is strongly discouraged (−100000 score).

### Stage 2 — `assignColours()`: splitting each chukka's 8 into Blue/White

Exhaustive search over every possible 4v4 split (`combinations()`), ranked by
`compareKeys()` — a clean array-based lexicographic comparator (see "Hard lessons"
for why it's built this way and not a nested ternary chain). Current priority
order, **highest first**:

1. **`diffCapPenalty`** — Blue/White handicap gap must stay ≤2 (no beginner in the
   chukka) or ≤3 (beginner present). **This must stay priority #1** — see "Hard
   lessons" below, this is not negotiable without re-reading that section.
2. **`hardCapPenalty`** — a side with a beginner can't total more than 2.5.
3. **`weakTeamPenalty`** — a side with a beginner can't total below -6.
4. **`beginnerPenalty`** — a side with a beginner gets at most one player with
   handicap > 0.
5. **`changeCapPenalty`** — soft cap of 3 shirt-colour changes per player, for the
   whole day.
6. **`changeCost`** — general preference to keep the same colour as last time.
7. **`diff`** — fine-grained minimisation of the handicap gap, below the cap.
8. **`pairPenalty`** — the chukka's 8 players are ranked by handicap and paired up
   (closest-ranked together); prefer splits where each pair ends up on opposite
   sides, so a tied sum doesn't still produce "2 strong + 2 weak" vs "4 mediums".

### Stage 1b — `repairChukkas()`: swap players between chukkas

The greedy fill sometimes produces a chukka whose roster *no* split can make
compliant (e.g. too many high-goal players alongside beginners). After the fill,
the repair pass takes the worst such chukka (by `rosterBalanceKey()`: the best
achievable `[diffCapPenalty, hardCapPenalty, weakTeamPenalty, beginnerPenalty]`
over all splits, ignoring shirt history) and tries swapping each of its players
with each player in every other chukka. It takes the swap that most improves the
two chukkas' combined key, in the same priority order as Stage 2 (gap cap first).
Swaps are skipped if they would:

- put a player in a chukka they're already in;
- add an early/late timing miss for either player;
- take a slow-labelled chukka away from someone who still needs one (beginners
  count as needing all of theirs).

A swap keeps every player's chukka count and every chukka's size, so the
pour-fill order and the requested totals are untouched. Every accepted swap
strictly lowers the day's total key, so it can't loop; it's also capped at
`numChukkas × 4` swaps. The penalty formulas live in one shared
`balancePenalties()` helper used by both this pass and `assignColours()`, so the
two can't drift apart.

Measured on 15 rosters (the sample, adversarial beginner/timing variants and 10
random ones) × 6 runs: total beginner-side rule breaches fell from ~480 to ~10,
the one gap-cap breach disappeared, and beginner grouping was unchanged.
Generating takes ~0.2–0.6s instead of ~0.1–0.2s.

### Outer loop — 15 attempts, best kept

`fillChukkas` is deterministic on the first attempt and adds random jitter
(`FILL_JITTER`, up to +20) to every score on later ones. That's enough to
reshuffle the soft pace/handicap nudges (worth tens of points) so attempts
genuinely differ, but far too small to affect deficit ordering (×1000) or the
−100000 helper rule. (It used to be ±0.5, which only broke exact ties, so the
attempts mostly converged on the same result.) Each attempt goes fill → repair →
colours, and the lowest weighted score wins:

```
unmet×100000 + gapBreaches×3000 + violations.length×1500 + capBreaches×1000
  + paceMismatch×200 + totalChanges×50 + totalDiff×10
```

(`gapBreaches`/`capBreaches` mirror the per-chukka diff-cap/shirt-cap checks across
the whole day; `violations` = timing-preference misses, recomputed after repair;
`unmet` = requested chukkas that couldn't be placed anywhere.)

## Display pace (cosmetic only)

After scheduling, each chukka gets a `displayPace` (`'fast'`/`'slow'`/`'neutral'`)
computed from the *actual resulting* average team handicap (>2 → fast, <0 → slow).
Purely a label shown on the board — doesn't feed back into scheduling. Don't
confuse this with the internal `pace` field from `buildPaceLabels()`, which only
ever assigns `'slow'` or `'neutral'` — there is no internal `'fast'` label.

## ⚠️ Hard lessons (read before touching the priority order)

Two separate real bugs traced back to the same root cause: a per-side rule can be
**trivially satisfied by isolating all the "problem" players onto one side**, which
then frees the *other* side to be as extreme as it wants with nothing checking it —
producing enormous handicap gaps. (One real instance: 4× -2 handicap players vs 4×
high-goal players in the same chukka, isolated onto opposite sides, gap of 14.)

Both times, the fix was the same: **`diffCapPenalty` must be the #1 priority**,
checked before any beginner-specific per-side rule. Those per-side rules are
refinements applied *among already-balanced options* — never a justification for
accepting a blown-out gap. Before adding any new per-side rule, ask: "could
satisfying this by dumping everyone on one side create a bad outcome?" If yes, it
ranks below `diffCapPenalty`, full stop.

Also: the priority comparator used to be a hand-written nested ternary chain, and I
introduced genuine syntax bugs in it twice by hand-counting parentheses wrong. It's
now `compareKeys()`, a clean array-based comparator — keep it that way. Adding a
new priority should be a one-line addition to the `key` array, never another layer
of nesting.

## Other features

- **Name type-ahead** against `MASTER_HANDICAPS`.
- **Roster layout**: on phones the name/handicap/chukkas row uses fixed-width
  stepper columns (`ROSTER_GRID`) so values like `-1.5` fit; from the `sm`
  breakpoint up it's the original 12-column grid.
- **`localStorage` persistence** of the roster (not the generated board) between
  visits, wrapped in try/catch, degrades gracefully if storage is unavailable.
- **Final Board**: grid table, players (sorted by handicap, highest first) down the
  side, chukkas across the top, blue/white cells, plus Handicap B / Handicap W /
  Difference summary rows at the bottom, with visible gridlines.
- **Per-chukka cards**: Blue/White rosters with handicap totals, each sorted
  highest-to-lowest.
- **Share Board button**: exports the Final Board **as a PNG image** (not text),
  via `html2canvas` (bundled from npm, split into its own chunk and only loaded
  the first time someone shares — no CDN involved). Uses
  the Web Share API on Android for a native share-sheet, falls back to a direct
  download elsewhere.
- **Warnings panel**: surfaces anything the soft rules couldn't fully satisfy —
  under-filled chukkas, missed slow/timing requests, shirt-cap or gap-cap breaches
  — rather than failing silently.

## Known constraints, stated explicitly at the time, don't relitigate without reason

- Players per team hard-coded at 4 (8 per chukka). There was a stepper for this;
  removed on request after an earlier auto-search approach picked silly small
  formats trying to minimise unfilled slots.
- Only "slow" is requestable per-player; "fast" is display-only (see above).
- **No cap on how many players can request early/late** — explicitly, deliberately
  unbounded, because these reflect real personal commitments, not a parameter to
  arbitrarily limit. If multiple same-preference requests ever cause a problem
  again, the fix is in the scheduling logic (see "Hard lessons"), not a request cap.

## Fastest way to sanity-check a scheduling change

Hand it a deliberately adversarial roster — several -2 handicap players all
requesting the same timing/pace preference at once — and check the resulting
Handicap B / Handicap W / Difference rows on the Final Board. That's how both of
the bugs in "Hard lessons" were actually caught; it'll catch the next one too.
