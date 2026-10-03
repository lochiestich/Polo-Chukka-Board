# Chukka Board — Handoff

A scheduling tool for Manyatta Polo Club (Kenya): takes a roster (name, handicap,
chukkas wanted, timing/pace preferences) and produces a full day's chukka board —
who plays which chukka, split into balanced Blue/White teams — with a lot of
club-specific rules layered on top, arrived at through a long back-and-forth of
"here's a real board that went wrong, fix it" iterations. Currently deployed as a
standalone HTML file on GitHub Pages / installed to an Android home screen as a PWA.

## Files

- **`src/scheduler.js`** — all scheduling logic, as pure functions with no React.
  `generateBoard(players, mode)` is the entry point.
- **`src/App.jsx`** — the UI (was `chukka-board.jsx` in the original handoff), plus
  the sample roster and `MASTER_HANDICAPS`. React, `lucide-react` icons, Tailwind.
- **`scripts/rosters.mjs` / `scripts/sanity.mjs`** — real rosters from the club's
  hand-made boards, and `npm run sanity`, which runs them through both boards,
  prints a quality table and fails on structural breaks. CI runs it before deploy.
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

There used to be a mirrored `fastChukkas` field. It was removed on purpose — no
player requests "fast" directly. Fast is either the **emergent display label** (see
Display pace below) or, on the **Fast board**, a whole-board mode that plans fast
chukkas for the higher-goal players.

## Club rules (agreed October 2026, from the club's own boards)

What the club's hand-made boards do with beginners (chukka: number of -2s):

| Board | Beginners per chukka |
|---|---|
| Sat 2.00 (13 chukkas) | none in 1–9, then 10: 4, 11: 4, 12: 3, 13: 3 |
| Sun 10.30 (12) | none in 1–7, then 8: 2, 9: 1, 10: 3, 11: 4, 12: 4 |
| Sat 1PM (14) | none in 1–8, then 9: 1, 10: 1, 11: 5, 12: 3, 13: 5, 14: 5 |
| Sat 12 noon (8) | 1: 1, 2: 2, 3: 3, 6: 3, 7: 1, 8: 6 |
| Sun 10am (6) | 1: 3, 2: 4, 5: 3, 6: ~3 |

So: a block of consecutive beginner chukkas (3–5 beginners each, usually at
the end of a Saturday afternoon, the start of a Sunday morning), each beginner
playing their chukkas in a row, with one or two beginners mixed into the medium
chukkas just before the block. 75–100% of beginner chukkas are in the block.
With End, the scheduler now reproduces this closely: on Sat 2.00 beginners play
at 0.85 of the way through the day (the club's board: chukkas 10–13 of 13), and
79–90% of beginner chukkas are in a block on the real rosters.


- **Beginners (-2)**: three-quarters of their chukkas slow (`BEGINNER_SLOW_SHARE`),
  the rest medium; never in a fast chukka; at most two in a medium chukka so it
  stays medium.
- **Beginners play as a block**: the slow chukkas are one block of consecutive
  chukkas at the **start** or **end** of the day, or **mixed** (spread in pairs) —
  a Start / Mixed / End setting in the app, default End. Beginners are pulled hard
  into the block (`BEGINNER_PULL`, up to four per chukka, six at most), a slow
  chukka takes two helpers at most, and a beginner's medium chukka sits right
  next to the block as a lead-in (`BEGINNER_LEAD_IN`).
- **0.5s count as helpers** (anything above 0), confirmed by the club.
- **Someone above 0 on every side, in every chukka**, and **no side below -5.5**
  (`SIDE_FLOOR`; no "-6 goal" teams). Both rank straight after the gap cap. The
  fill makes sure each chukka gets two above-0 players; the Fast board never plans
  so many fast chukkas that the others would run short of them. A leftover tail
  chukka of under four players is exempt.
- **Improvers (-1.5)**: at least half their chukkas slow (`IMPROVER_SLOW_SHARE`,
  or more if they ask), never in a fast chukka.
- **One helper per beginner side, in every chukka**: a "helper" is a player above
  0 (`countsAsHelper()`). Players who asked for any slow chukkas don't count, so
  they can join a beginner chukka even as a second helper on a side. The 2.5
  side-total cap still applies to them.
- **Early** = all their chukkas within chukkas 1 to (chukkas wanted + 2).
- **Late** = stay out of the first 4 chukkas (first half on a short day), lean
  toward the back half. Neither is a hard rule.
- **Slow requests** are met by any chukka that isn't fast ("slow means not fast").
- **Back-to-back pairs**: players tend to play two chukkas in a row with the same
  group, like the hand-made boards (`PAIR_BONUS`).

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
  0. **`MUST_PLAY`** (+200000) — anyone who needs every remaining chukka they're
     allowed in (non-fast ones, for -1.5s/-2s) gets in. This outranks every rule
     below, so nobody is left short to protect a softer rule.
  1. **Deficit** (`chukkasWanted - alreadyAssigned`, ×1000) — this is what
     actually makes the pour-fill pour.
  2. **Early/late timing preference** — a strong but *soft* nudge (see "Hard
     lessons" — it used to be a hard rule and that caused a real bug). Out of
     window costs `TIMING_MISS` (8000); in window, urgency-scaled bonuses. See
     `timingWindow()` / `outOfTimingWindow()`.
  3. **Back-to-back pairs** — `PAIR_BONUS` (1500) for staying on for a second
     chukka in a row. It's worth more than one chukka of deficit, so it bends the
     pour slightly.
  4. **Pace labels** from `buildPaceLabels()`: `'slow'`, `'neutral'` (medium) and,
     on the Fast board only, `'fast'`. Slow chukkas are sized as beginners' slow
     demand ÷ 4 plus everyone else's ÷ 8, and placed evenly in pairs. Fast chukkas
     (`plannedFastCount()`: one per 8 chukka-slots wanted by 1-goal-and-up players,
     max half the day, and always leaving every -1.5/-2 enough non-fast chukkas)
     go at the start of the day in pairs: 1-2, 4-5, …
     - slow chukka: bonus for slow-needers and lower handicaps; beginners pulled
       together.
     - fast chukka: −100000 for -1.5/-2; `FAST_PULL` (300) per goal of handicap.
     - medium chukka: at most two beginners (−1500); once it's trending fast
       (average over 0.5), slow-requesters lightly and -1.5/-2s strongly steered
       away.
  5. **Helper cap, every chukka**: a chukka with a beginner takes at most two
     helpers (one per side) — −100000 for a third, or for a beginner joining a
     chukka that already has three.
- **Fallback attempts**: if none of the 15 attempts gets everyone their chukkas,
  15 more run with `relaxed` set — the helper caps (−100000) become −3000 and the
  beginner off-block penalty is dropped. Normal days never reach this; it exists
  for extreme rosters (e.g. a helper wanting every chukka of the day).
- **`MUST_PLAY` for helpers** counts only half the remaining slow chukkas as
  available, since slow chukkas take two helpers at most.
- **Fill guarantee**: each pick is the best-scoring player *whose pick still lets
  the rest of the day fill cleanly* (`canFinishCleanly()`, a Gale–Ryser check
  assuming the rest of the chukka goes to the highest deficits). This keeps "only
  the last chukka can be short" true whatever the bonuses do. On 350 random
  rosters that can be filled cleanly, every board (both modes, all three beginner
  placements: 2,100 boards) fills every request with no short chukka mid-day (the
  original scheduler left requests unfilled on 64 of 700 boards).

### Stage 2 — `assignColours()`: splitting each chukka's 8 into Blue/White

Exhaustive search over every possible 4v4 split (`combinations()`), ranked by
`compareKeys()` — a clean array-based lexicographic comparator (see "Hard lessons"
for why it's built this way and not a nested ternary chain). Current priority
order, **highest first**:

1. **`diffCapPenalty`** — Blue/White handicap gap must stay ≤2 (no beginner in the
   chukka) or ≤3 (beginner present). **This must stay priority #1** — see "Hard
   lessons" below, this is not negotiable without re-reading that section.
2. **`noPositivePenalty`** — each side needs at least one player above 0.
3. **`weakTeamPenalty`** — no side can total below -5.5 (`SIDE_FLOOR`), beginner
   or not.
4. **`hardCapPenalty`** — a side with a beginner can't total more than 2.5.
5. **`beginnerPenalty`** — a side with a beginner gets at most one helper
   (`countsAsHelper()`: above 0 and not a slow-requester).
6. **`changeCapPenalty`** — soft cap of 3 shirt-colour changes per player, for the
   whole day.
7. **`changeCost`** — general preference to keep the same colour as last time.
8. **`diff`** — fine-grained minimisation of the handicap gap, below the cap.
9. **`pairPenalty`** — the chukka's 8 players are ranked by handicap and paired up
   (closest-ranked together); prefer splits where each pair ends up on opposite
   sides, so a tied sum doesn't still produce "2 strong + 2 weak" vs "4 mediums".

### Stage 1b — `repairChukkas()`: swap players between chukkas

The greedy fill sometimes produces a chukka whose roster *no* split can make
compliant (e.g. too many high-goal players alongside beginners). After the fill,
the repair pass takes the worst such chukka (by `rosterBalanceKey()`: the best
achievable `[diffCapPenalty, noPositivePenalty, weakTeamPenalty, hardCapPenalty, beginnerPenalty]`
over all splits, ignoring shirt history) and tries swapping each of its players
with each player in every other chukka. It takes the swap that most improves the
two chukkas' combined key, in the same priority order as Stage 2 (gap cap first).
Swaps are skipped if they would:

- put a player in a chukka they're already in;
- add an early/late timing miss for either player;
- take a slow-labelled chukka away from someone who still needs one
  (`slowNeedOf()`);
- put a -1.5 or -2 into a fast-labelled chukka.

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
unmet×100000 + gapBreaches×3000 + sideBreaches×3000 + tooFast×2000 + violations.length×1500
  + capBreaches×1000 + fastMiss×500 + paceMismatch×200 + totalChanges×50 + totalDiff×10
```

(`sideBreaches` = sides with nobody above 0 plus goals below -5.5;
`gapBreaches`/`capBreaches` mirror the per-chukka diff-cap/shirt-cap checks across
the whole day; `tooFast` = -1.5/-2 player-slots in chukkas that play fast;
`violations` = timing-preference misses, recomputed after repair; `fastMiss` =
planned-fast chukkas that didn't play fast (Fast board only); `unmet` = requested
chukkas that couldn't be placed anywhere.)

### Two boards: Standard and Fast

Generate runs the whole pipeline twice, `generateBoard(players, 'standard')` and
`generateBoard(players, 'fast')`. The only difference is that the Fast board plans
fast-labelled chukkas. A Standard | Fast switch above the Final Board picks
which one is shown, warned about and shared. If `plannedFastCount()` is 0 there's
no Fast board that day and the switch is hidden. On the club's big rosters the
Standard board already starts the day with the high-goal players together, so the
Fast board mostly makes that deliberate (fast pairs at 1-2, 4-5); it should differ
more on days where the strong players would otherwise be spread out.

## Display pace (cosmetic only)

After scheduling, each chukka gets a `displayPace` (`'fast'`/`'slow'`/`'neutral'`)
computed from the *actual resulting* average team handicap (>2 → fast, <0 → slow),
shown as **F / M / S** above each chukka number like the club's sheets. It feeds
the outer score (`tooFast`, `fastMiss`, `paceMismatch`) but not the fill. Don't
confuse it with the internal `pace` field from `buildPaceLabels()` — the plan,
which can say `'fast'` only on the Fast board.

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
- **Final Board**: Standard | Fast switch, then a grid table, players (sorted by handicap, highest first) down the
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
- Only "slow" is requestable per-player. "Fast" is the display label, or the
  whole-board Fast mode — never a per-player request.
- **No cap on how many players can request early/late** — explicitly, deliberately
  unbounded, because these reflect real personal commitments, not a parameter to
  arbitrarily limit. If multiple same-preference requests ever cause a problem
  again, the fix is in the scheduling logic (see "Hard lessons"), not a request cap.

## Fastest way to sanity-check a scheduling change

Run `npm run sanity`. It covers the club's real rosters plus adversarial variants:
every beginner asking for late, mixed early/late across all levels, and helpers
asking for slow. Compare the table before and after your change. For a visual
check, hand the app a deliberately adversarial roster — several -2 handicap players
all requesting the same timing/pace preference at once — and check the Handicap B /
Handicap W / Difference rows on the Final Board. That's how both of the bugs in
"Hard lessons" were actually caught.
