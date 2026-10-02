// Chukka Board scheduling. Pure functions, no React: App.jsx calls
// generateBoard() and renders the result. See docs/HANDOFF.md before changing
// any priority order here, especially the "Hard lessons" section.

export const TEAM_SIZE = 4; // always 4 a side
export const CAPACITY = TEAM_SIZE * 2;
const ATTEMPTS = 15;

const hcap = (p) => Number(p.handicap) || 0;
const wantedOf = (p) => Number(p.chukkasWanted) || 0;

// ---------------------------------------------------------------------------
// Player rules
// ---------------------------------------------------------------------------

// -2 players are beginners: grouped together, protected by the helper rules,
// mostly in slow chukkas and never in a fast one.
export const isBeginner = (p) => hcap(p) <= -2;
// -1.5 players are improvers: at least half their chukkas slow, never fast.
export const isImprover = (p) => hcap(p) > -2 && hcap(p) <= -1.5;
export const neverFast = (p) => hcap(p) <= -1.5;

// Share of a beginner's chukkas that must be slow — the rest can be medium,
// so beginners aren't always stuck in slow chukkas. Improvers get half.
export const BEGINNER_SLOW_SHARE = 2 / 3;
export const IMPROVER_SLOW_SHARE = 1 / 2;

export function slowNeedOf(p) {
  const wanted = wantedOf(p);
  const asked = Math.min(wanted, Number(p.slowChukkas) || 0);
  if (isBeginner(p)) return Math.ceil(wanted * BEGINNER_SLOW_SHARE);
  if (isImprover(p)) return Math.max(asked, Math.ceil(wanted * IMPROVER_SLOW_SHARE));
  return asked;
}

// A helper is a player above 0 on the same side as a beginner. Each beginner's
// side gets at most one — in every chukka, not just slow ones. Players who
// asked for slow chukkas don't count, so they can join beginner chukkas even
// as a second helper on a side (the 2.5 side-total cap still applies).
export const countsAsHelper = (p) => hcap(p) > 0 && !((Number(p.slowChukkas) || 0) > 0);

// ---------------------------------------------------------------------------
// Timing preferences
// ---------------------------------------------------------------------------

// Early players play at the very start of the day: all their chukkas within
// chukkas 1 to (chukkas wanted + 2). Late players stay out of the first 4
// chukkas (first half, on a short day) and lean toward the back half. Both are
// strong nudges, not hard rules — they give way to the handicap-gap cap.
export function timingWindow(numChukkas) {
  return {
    lateBlocked: Math.min(4, Math.floor(numChukkas / 2)),
    backHalfStart: Math.ceil(numChukkas / 2),
  };
}

const earlyEnd = (p) => wantedOf(p) + 2;

export function outOfTimingWindow(p, index, win) {
  if (p.timingPref === 'early') return index >= earlyEnd(p);
  if (p.timingPref === 'late') return index < win.lateBlocked;
  return false;
}

export function timingViolations(chukkas, valid, numChukkas) {
  const win = timingWindow(numChukkas);
  const violations = [];
  valid.forEach((p) => {
    if (p.timingPref === 'none') return;
    chukkas.forEach((c) => {
      if (!c.players.some((pp) => pp.id === p.id)) return;
      if (outOfTimingWindow(p, c.index, win)) violations.push({ name: p.name, chukka: c.index + 1, pref: p.timingPref });
    });
  });
  return violations;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// Compares two same-length arrays of numbers in priority order, returning
// negative if `a` should be preferred, positive if `b` should be preferred,
// 0 if tied on every entry. Used to rank chukka team-splits against a list
// of priorities without a fragile hand-nested chain of tie-breaks.
export function compareKeys(a, b) {
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    if (Math.abs(d) > 1e-9) return d;
  }
  return 0;
}

function combinations(arr, k) {
  const result = [];
  const combo = [];
  function helper(start) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      helper(i + 1);
      combo.pop();
    }
  }
  helper(0);
  return result;
}

const comboCache = {};
function cachedCombinations(n, k) {
  const cacheKey = `${n}:${k}`;
  if (!comboCache[cacheKey]) comboCache[cacheKey] = combinations([...Array(n).keys()], k);
  return comboCache[cacheKey];
}

// Spread `count` items as evenly as possible across `total` slots.
function evenIndices(count, total) {
  const idx = [];
  for (let i = 0; i < count; i++) idx.push(Math.min(total - 1, Math.floor((i + 0.5) * (total / count))));
  return idx;
}

// ---------------------------------------------------------------------------
// Stage 0: plan each chukka's pace
// ---------------------------------------------------------------------------

// How many fast chukkas the Fast board plans: one per 8 chukka-slots that
// 1-goal-and-up players asked for, capped at half the day. On the club's own
// boards this matches what was planned by hand (e.g. 34 slots → 4 fast).
// Never so many that a -1.5 or -2 can't fit all their chukkas into the rest.
export function plannedFastCount(valid, numChukkas) {
  const highSlots = valid.filter((p) => hcap(p) >= 1).reduce((s, p) => s + wantedOf(p), 0);
  const mostWantedByNeverFast = valid.filter(neverFast).reduce((m, p) => Math.max(m, wantedOf(p)), 0);
  return Math.max(0, Math.min(Math.floor(highSlots / CAPACITY), Math.floor(numChukkas / 2), numChukkas - mostWantedByNeverFast));
}

// Label `count` chukkas, two at a time as back-to-back pairs, trying the
// preferred pair starts first and then any free chukka.
function placeInPairs(labels, count, label, preferredStarts) {
  let placed = 0;
  const tryStart = (s) => {
    for (const i of [s, s + 1]) {
      if (placed < count && i >= 0 && i < labels.length && labels[i] === 'neutral') {
        labels[i] = label;
        placed++;
      }
    }
  };
  preferredStarts.forEach(tryStart);
  for (let i = 0; placed < count && i < labels.length; i++) tryStart(i);
}

// Plan each chukka as 'slow', 'neutral' (medium — whatever it turns out to
// be) or, on the Fast board only, 'fast'. Fast chukkas go at the start of the
// day in pairs with a gap (1-2, 4-5, ...). Slow chukkas are sized to the
// day's slow demand and spread evenly in pairs.
export function buildPaceLabels(valid, numChukkas, totalRequested, mode) {
  const labels = new Array(numChukkas).fill('neutral');
  if (mode === 'fast') {
    const starts = [];
    for (let s = 0; s < numChukkas; s += 3) starts.push(s);
    placeInPairs(labels, plannedFastCount(valid, numChukkas), 'fast', starts);
  }
  // A slow chukka holds about four beginners (plus helpers on each side), but
  // a full eight of everyone else who asked for slow.
  const beginnerSlow = valid.filter(isBeginner).reduce((s, p) => s + slowNeedOf(p), 0);
  const otherSlow = valid.filter((p) => !isBeginner(p)).reduce((s, p) => s + slowNeedOf(p), 0);
  const targetSlow = totalRequested > 0 ? Math.round(beginnerSlow / TEAM_SIZE + otherSlow / CAPACITY) : 0;
  const slowCount = Math.min(targetSlow, labels.filter((l) => l === 'neutral').length);
  const pairCount = Math.ceil(slowCount / 2);
  placeInPairs(labels, slowCount, 'slow', pairCount > 0 ? evenIndices(pairCount, Math.max(1, numChukkas - 1)) : []);
  return labels;
}

// ---------------------------------------------------------------------------
// Stage 1: who plays in which chukka
// ---------------------------------------------------------------------------

// Random tie-break noise added to each fill score on every attempt after the
// first. Big enough to reshuffle the soft pace/handicap nudges (which are worth
// tens of points) so the attempts genuinely differ, but far too small to touch
// the deficit ordering (×1000) that makes the pour-fill pour, or the -100000
// helper rule.
const FILL_JITTER = 20;
// Bonus for staying on for a second chukka in a row, so players play
// back-to-back pairs with the same group, like the club's hand-made boards.
// It's worth more than one chukka of deficit, so it does bend the pour-fill a
// little; MUST_PLAY stops that from ever leaving someone short.
const PAIR_BONUS = 1500;
// Anyone who needs every remaining chukka they're allowed in (non-fast ones,
// for -1.5s and -2s) gets in, whatever else their score says — getting
// everyone their chukkas outranks the helper and never-fast rules, which the
// repair pass and colour split then do their best to protect.
const MUST_PLAY = 200000;
// On the Fast board, pull per goal of handicap into a fast chukka.
const FAST_PULL = 300;
// Penalty for a chukka outside an early/late player's window. Big enough to
// outweigh several chukkas of deficit, but MUST_PLAY still wins when they've
// asked for more chukkas than their window holds.
const TIMING_MISS = 8000;

// Could the chukkas after this one still all be filled (only the very last
// one allowed to come up short), given each player's remaining chukkas? Each
// player plays a chukka at most once, so this is the Gale–Ryser condition:
// for every k, the players can cover the k biggest remaining chukkas.
function canFinishCleanly(deficits, chukkasLeft, capacity) {
  const capped = deficits.map((d) => Math.min(d, chukkasLeft));
  const total = capped.reduce((s, d) => s + d, 0);
  for (let k = 1; k <= chukkasLeft; k++) {
    const cover = capped.reduce((s, d) => s + Math.min(d, k), 0);
    if (cover < Math.min(total, capacity * k)) return false;
  }
  return true;
}

// Fill chukkas like pouring water: Chukka 1 fills completely before Chukka 2,
// and so on. Whoever has the most chukkas left gets first claim on a spot, so
// only the tail can end up short. Early/late preference is a strong but soft
// nudge (see timingWindow). Slow chukkas lean toward lower-handicap players
// and pull beginners together; fast chukkas (Fast board) pull high-goal
// players and shut out -1.5s and -2s; medium chukkas steer -1.5s, -2s and
// slow-requesters away once they're shaping up to be fast.
export function fillChukkas(valid, numChukkas, capacity, paceLabels, jitter) {
  const chukkas = Array.from({ length: numChukkas }, (_, i) => ({ index: i, pace: paceLabels[i], players: [] }));
  const need = {};
  const actualPace = {};
  const lastPlayed = {};
  const streak = {};
  valid.forEach((p) => {
    const slow = slowNeedOf(p);
    need[p.id] = { slow, none: Math.max(0, wantedOf(p) - slow) };
    actualPace[p.id] = { slow: 0 };
    lastPlayed[p.id] = -2;
    streak[p.id] = 0;
  });

  const win = timingWindow(numChukkas);
  const backRoom = numChukkas - win.backHalfStart;
  // nonFastFrom[i] = how many chukkas from i onward aren't planned fast.
  const nonFastFrom = new Array(numChukkas + 1).fill(0);
  for (let i = numChukkas - 1; i >= 0; i--) nonFastFrom[i] = nonFastFrom[i + 1] + (paceLabels[i] === 'fast' ? 0 : 1);

  chukkas.forEach((c) => {
    const chosenIds = new Set();
    for (let slot = 0; slot < capacity; slot++) {
      const beginnersIn = c.players.filter(isBeginner).length;
      const helpersIn = c.players.filter(countsAsHelper).length;
      const avgSoFar = c.players.length > 0 ? c.players.reduce((s, cp) => s + hcap(cp), 0) / c.players.length : 0;
      const scored = [];
      valid.forEach((p) => {
        if (chosenIds.has(p.id)) return;
        const n = need[p.id];
        const deficit = n.slow + n.none;
        if (deficit <= 0) return;
        const h = hcap(p);
        const remainingChukkas = numChukkas - c.index;
        const allowedLeft = neverFast(p) ? nonFastFrom[c.index] : remainingChukkas;
        let score = deficit * 1000;
        if (deficit >= allowedLeft) score += MUST_PLAY;

        if (p.timingPref === 'early') {
          const remainingWindow = earlyEnd(p) - c.index;
          score += remainingWindow > 0 ? (deficit / remainingWindow) * 8000 + remainingWindow * 10 : -TIMING_MISS;
        } else if (p.timingPref === 'late') {
          if (c.index < win.lateBlocked) {
            score -= TIMING_MISS;
          } else if (c.index >= win.backHalfStart) {
            score += (deficit / remainingChukkas) * 8000;
          } else if (deficit > backRoom) {
            // more chukkas than the back half can hold — start some before it
            score += ((deficit - backRoom) / (win.backHalfStart - c.index)) * 8000;
          } else {
            score -= 600;
          }
        }

        if (lastPlayed[p.id] === c.index - 1 && streak[p.id] === 1) score += PAIR_BONUS;

        if (c.pace === 'slow') {
          score += n.slow > 0 ? 50 : 20;
          const effH = Math.max(h, -3); // don't keep rewarding ever-lower handicaps without limit
          score += (2 - effH) * 3;
          if (isBeginner(p)) score += beginnersIn * 60; // pull beginners into the same chukkas together
        } else if (c.pace === 'fast') {
          if (neverFast(p)) score -= 100000;
          score += h * FAST_PULL;
          if (n.none === 0) score -= 2000; // all they have left to give is slow chukkas
        } else if (isBeginner(p) && beginnersIn >= 2) {
          // More than two beginners turns a medium chukka slow — beginners'
          // medium chukkas should actually play medium.
          score -= 1500;
        } else if (c.players.length > 0 && avgSoFar > 0.5) {
          // A medium chukka shaping up to be fast: keep slow-requesters out
          // where possible, and -1.5s and -2s out much more firmly.
          if (n.slow > 0) score -= (avgSoFar - 0.5) * 15;
          if (neverFast(p)) score -= (avgSoFar - 0.5) * 2000;
        }

        // One helper per beginner side, in every chukka: a chukka with a
        // beginner in it takes at most two helpers (one each side).
        if (countsAsHelper(p) && beginnersIn >= 1 && helpersIn >= 2) score -= 100000;
        if (isBeginner(p) && helpersIn >= 3) score -= 100000;

        score += jitter ? Math.random() * FILL_JITTER : 0;
        scored.push({ p, score });
      });
      if (scored.length === 0) break;
      scored.sort((a, b) => b.score - a.score);

      // Take the best-scoring player whose pick still lets the rest of the
      // day fill cleanly, assuming the rest of this chukka goes to whoever has
      // the most chukkas left (the pure pour-fill). This keeps the "only the
      // last chukka can be short" guarantee whatever the bonuses above do.
      const chukkasLeftAfter = numChukkas - c.index - 1;
      const deficitOf = (p) => need[p.id].slow + need[p.id].none;
      const keepsDayFillable = (cand) => {
        const after = {};
        valid.forEach((p) => {
          after[p.id] = deficitOf(p);
        });
        after[cand.id]--;
        const rest = scored
          .map((x) => x.p)
          .filter((p) => p.id !== cand.id)
          .sort((a, b) => deficitOf(b) - deficitOf(a))
          .slice(0, capacity - c.players.length - 1);
        rest.forEach((p) => after[p.id]--);
        return canFinishCleanly(Object.values(after), chukkasLeftAfter, capacity);
      };
      const bestP = (scored.find((x) => keepsDayFillable(x.p)) || scored[0]).p;

      chosenIds.add(bestP.id);
      c.players.push(bestP);
      const n = need[bestP.id];
      if (c.pace === 'slow' && n.slow > 0) {
        n.slow--;
        actualPace[bestP.id].slow++;
      } else if (n.none > 0) {
        n.none--;
      } else {
        n.slow--;
      }
    }
    c.players.forEach((p) => {
      streak[p.id] = lastPlayed[p.id] === c.index - 1 ? streak[p.id] + 1 : 1;
      lastPlayed[p.id] = c.index;
    });
  });

  const assigned = {};
  valid.forEach((p) => {
    const n = need[p.id];
    assigned[p.id] = wantedOf(p) - (n.slow + n.none);
  });

  return { chukkas, assigned, actualPace };
}

// ---------------------------------------------------------------------------
// Balance rules shared by the repair pass and the colour split
// ---------------------------------------------------------------------------

// The balance rules for one Blue/White split, in priority order (see the
// comment in assignColours for why the gap cap must come first). Shared by
// assignColours and the repair pass so the two can never disagree. "Helpers"
// are counted with countsAsHelper().
function balancePenalties(sumBlue, sumWhite, blueBeginners, whiteBeginners, blueHelpers, whiteHelpers) {
  const diff = Math.abs(sumBlue - sumWhite);
  const hasBeginner = blueBeginners > 0 || whiteBeginners > 0;
  return {
    diff,
    diffCapPenalty: Math.max(0, diff - (hasBeginner ? 3 : 2)),
    hardCapPenalty:
      (blueBeginners > 0 && sumBlue > 2.5 ? sumBlue - 2.5 : 0) + (whiteBeginners > 0 && sumWhite > 2.5 ? sumWhite - 2.5 : 0),
    weakTeamPenalty:
      (blueBeginners > 0 && sumBlue < -6 ? -6 - sumBlue : 0) + (whiteBeginners > 0 && sumWhite < -6 ? -6 - sumWhite : 0),
    beginnerPenalty:
      (blueBeginners > 0 ? Math.max(0, blueHelpers - 1) : 0) + (whiteBeginners > 0 ? Math.max(0, whiteHelpers - 1) : 0),
  };
}

// The best balance a chukka's roster could possibly get from any split,
// ignoring shirt-colour history: [gap cap, beginner-side 2.5 cap, beginner-side
// -6 floor, one helper per beginner side]. All zeros means fully compliant.
function rosterBalanceKey(roster) {
  const total = roster.length;
  if (total < 2) return [0, 0, 0, 0];
  const hs = roster.map(hcap);
  const beg = roster.map(isBeginner);
  const helper = roster.map(countsAsHelper);
  let best = null;
  for (const comboIdx of cachedCombinations(total, Math.ceil(total / 2))) {
    let sumBlue = 0, sumWhite = 0, blueBeginners = 0, whiteBeginners = 0, blueHelpers = 0, whiteHelpers = 0;
    let ci = 0;
    for (let i = 0; i < total; i++) {
      const inBlue = comboIdx[ci] === i;
      if (inBlue) {
        ci++;
        sumBlue += hs[i];
        if (beg[i]) blueBeginners++;
        if (helper[i]) blueHelpers++;
      } else {
        sumWhite += hs[i];
        if (beg[i]) whiteBeginners++;
        if (helper[i]) whiteHelpers++;
      }
    }
    const pen = balancePenalties(sumBlue, sumWhite, blueBeginners, whiteBeginners, blueHelpers, whiteHelpers);
    const key = [pen.diffCapPenalty, pen.hardCapPenalty, pen.weakTeamPenalty, pen.beginnerPenalty];
    if (!best || compareKeys(key, best) < 0) best = key;
    if (best.every((k) => k <= 1e-9)) break;
  }
  return best;
}

const addKeys = (a, b) => a.map((x, i) => x + b[i]);
const isClean = (key) => key.every((k) => k <= 1e-9);

// ---------------------------------------------------------------------------
// Stage 1b: repair pass
// ---------------------------------------------------------------------------

// Repair pass, run after the pour-fill. Some chukkas come out of the greedy
// fill with a roster that no Blue/White split can make compliant (e.g. too
// many helpers alongside beginners). For the worst such chukka, try swapping
// one of its players with a player from another chukka, and take the swap that
// most improves the two chukkas' combined balance key — same priority order as
// assignColours, gap cap first. A swap keeps every player's chukka count and
// every chukka's size, so the pour-fill and the requested totals are
// untouched. A swap is never taken if it adds an early/late miss for either
// player, takes a slow-labelled chukka away from someone who still needs one,
// or puts a -1.5 or -2 into a fast-labelled chukka. Every accepted swap
// strictly improves the day's total balance key, so this can't loop.
export function repairChukkas(chukkas, valid, numChukkas, actualPace) {
  const win = timingWindow(numChukkas);
  const slowNeed = {};
  const slowCount = {};
  valid.forEach((p) => {
    slowNeed[p.id] = slowNeedOf(p);
    slowCount[p.id] = 0;
  });
  chukkas.forEach((c) => c.players.forEach((p) => c.pace === 'slow' && slowCount[p.id]++));

  const keys = chukkas.map((c) => rosterBalanceKey(c.players));
  const stuck = new Set();
  let swaps = 0;
  const maxSwaps = numChukkas * 4;

  while (swaps < maxSwaps) {
    let worst = -1;
    keys.forEach((k, i) => {
      if (stuck.has(i) || isClean(k)) return;
      if (worst === -1 || compareKeys(k, keys[worst]) > 0) worst = i;
    });
    if (worst === -1) break;

    const X = chukkas[worst];
    const xIds = new Set(X.players.map((p) => p.id));
    let bestSwap = null;
    chukkas.forEach((Y, j) => {
      if (j === worst) return;
      const yIds = new Set(Y.players.map((p) => p.id));
      const before = addKeys(keys[worst], keys[j]);
      const slowDelta = (Y.pace === 'slow' ? 1 : 0) - (X.pace === 'slow' ? 1 : 0); // for whoever moves X → Y
      X.players.forEach((a, ai) => {
        if (yIds.has(a.id)) return;
        if (Y.pace === 'fast' && neverFast(a)) return;
        Y.players.forEach((b, bi) => {
          if (xIds.has(b.id)) return;
          if (X.pace === 'fast' && neverFast(b)) return;
          const missesBefore = (outOfTimingWindow(a, X.index, win) ? 1 : 0) + (outOfTimingWindow(b, Y.index, win) ? 1 : 0);
          const missesAfter = (outOfTimingWindow(a, Y.index, win) ? 1 : 0) + (outOfTimingWindow(b, X.index, win) ? 1 : 0);
          if (missesAfter > missesBefore) return;
          const slowMet = (p, count) => Math.min(slowNeed[p.id], count);
          const slowBefore = slowMet(a, slowCount[a.id]) + slowMet(b, slowCount[b.id]);
          const slowAfter = slowMet(a, slowCount[a.id] + slowDelta) + slowMet(b, slowCount[b.id] - slowDelta);
          if (slowAfter < slowBefore) return;

          const newX = X.players.slice();
          newX[ai] = b;
          const newY = Y.players.slice();
          newY[bi] = a;
          const kx = rosterBalanceKey(newX);
          const ky = rosterBalanceKey(newY);
          const after = addKeys(kx, ky);
          if (compareKeys(after, before) >= 0) return;
          if (!bestSwap || compareKeys(after, bestSwap.after) < 0) bestSwap = { j, ai, bi, kx, ky, after, slowDelta };
        });
      });
    });

    if (!bestSwap) {
      stuck.add(worst);
      continue;
    }
    const Y = chukkas[bestSwap.j];
    const a = X.players[bestSwap.ai];
    const b = Y.players[bestSwap.bi];
    X.players[bestSwap.ai] = b;
    Y.players[bestSwap.bi] = a;
    slowCount[a.id] += bestSwap.slowDelta;
    slowCount[b.id] -= bestSwap.slowDelta;
    keys[worst] = bestSwap.kx;
    keys[bestSwap.j] = bestSwap.ky;
    stuck.clear(); // a swap can unblock a chukka that was stuck before
    swaps++;
  }

  valid.forEach((p) => {
    actualPace[p.id] = { slow: Math.min(slowNeed[p.id], slowCount[p.id]) };
  });
  return swaps;
}

// ---------------------------------------------------------------------------
// Stage 2: Blue/White split
// ---------------------------------------------------------------------------

// Within each chukka, try every possible way to split the roster into two
// sides and keep whichever split has the smallest handicap gap, while
// strongly preferring to keep each player in the same shirt colour all day —
// only trading that away when it's the only way to protect the beginner
// rules, and treating pure handicap balance as a lower priority than colour
// continuity once those rules are satisfied.
export function assignColours(chukkas, valid) {
  const history = {};
  valid.forEach((p) => {
    history[p.id] = { colour: null, streak: 0, changes: 0 };
  });
  let totalDiff = 0;

  chukkas.forEach((c) => {
    const roster = c.players;
    const total = roster.length;
    const targetBlue = Math.ceil(total / 2);
    const combos = cachedCombinations(total, targetBlue);

    // Pair up similarly-ranked players (by handicap) so a good split doesn't
    // just balance the sum — it also avoids stacking, say, the two strongest
    // and two weakest on one side against four mediums on the other.
    const sortedByH = [...roster].sort((a, b) => hcap(b) - hcap(a));
    const pairOf = {};
    sortedByH.forEach((p, i) => {
      pairOf[p.id] = Math.floor(i / 2);
    });

    let best = null;
    combos.forEach((comboIdx) => {
      const blueSet = new Set(comboIdx);
      let sumBlue = 0;
      let sumWhite = 0;
      let changeCost = 0;
      let changeCapPenalty = 0;
      let pairPenalty = 0;
      let blueBeginners = 0;
      let blueHelpers = 0;
      let whiteBeginners = 0;
      let whiteHelpers = 0;
      const pairSeen = {};
      roster.forEach((p, i) => {
        const inBlue = blueSet.has(i);
        const h = hcap(p);
        if (inBlue) sumBlue += h;
        else sumWhite += h;
        if (isBeginner(p)) {
          if (inBlue) blueBeginners++;
          else whiteBeginners++;
        }
        if (countsAsHelper(p)) {
          if (inBlue) blueHelpers++;
          else whiteHelpers++;
        }
        const prev = history[p.id].colour;
        if (prev) {
          if (inBlue && prev !== 'blue') changeCost++;
          if (!inBlue && prev !== 'white') changeCost++;
        }
        const willChange = prev && ((inBlue && prev !== 'blue') || (!inBlue && prev !== 'white'));
        const prospectiveChanges = history[p.id].changes + (willChange ? 1 : 0);
        changeCapPenalty += Math.max(0, prospectiveChanges - 3);
        const pid = pairOf[p.id];
        if (pairSeen[pid] === undefined) pairSeen[pid] = inBlue;
        else if (pairSeen[pid] === inBlue) pairPenalty++;
      });
      const diff = Math.abs(sumBlue - sumWhite);
      // Priority order, highest first: keep the handicap gap at 2 or under
      // for chukkas with no beginners, or 3 or under for chukkas that do
      // have a beginner. This is checked FIRST, above every beginner rule
      // below — because putting all the beginners on one side always
      // trivially satisfies "don't overload a beginner's side" and "don't
      // stack helpers", which let a split with an enormous gap look
      // "compliant" purely by exempting the other side from any beginner
      // rule at all. Only among splits that already keep the gap in check
      // do the finer beginner protections get to break ties: never exceed a
      // 2.5 total on a beginner's side; a beginner's side can't drop below
      // -6; at most one helper on a beginner's side; try not to push anyone
      // past 3 shirt changes for the day (a soft preference — an uneven team
      // is worse than an extra shirt change); prefer keeping colours the same
      // generally; minimise the handicap gap further; avoid stacking
      // strong/weak pairs together. Each entry is compared in turn — only
      // moving to the next one if the current one is tied.
      const { diffCapPenalty, hardCapPenalty, weakTeamPenalty, beginnerPenalty } = balancePenalties(
        sumBlue,
        sumWhite,
        blueBeginners,
        whiteBeginners,
        blueHelpers,
        whiteHelpers
      );
      const key = [diffCapPenalty, hardCapPenalty, weakTeamPenalty, beginnerPenalty, changeCapPenalty, changeCost, diff, pairPenalty];
      if (!best || compareKeys(key, best.key) < 0) best = { key, diff, blueSet };
    });

    if (!best) {
      c.blue = [];
      c.white = [];
      c.displayPace = 'neutral';
      return;
    }
    totalDiff += best.diff;
    const blueList = roster.filter((p, i) => best.blueSet.has(i));
    const whiteList = roster.filter((p, i) => !best.blueSet.has(i));

    blueList.forEach((p) => {
      const h = history[p.id];
      const prev = h.colour;
      h.changes += prev && prev !== 'blue' ? 1 : 0;
      h.streak = prev === 'blue' ? h.streak + 1 : 1;
      h.colour = 'blue';
    });
    whiteList.forEach((p) => {
      const h = history[p.id];
      const prev = h.colour;
      h.changes += prev && prev !== 'white' ? 1 : 0;
      h.streak = prev === 'white' ? h.streak + 1 : 1;
      h.colour = 'white';
    });

    c.blue = blueList;
    c.white = whiteList;
    c.displayPace = displayPaceOf(roster);
  });

  const totalChanges = Object.values(history).reduce((s, h) => s + h.changes, 0);
  return { history, totalDiff, totalChanges };
}

// Display pace, from the actual average team handicap: over 2 is fast, under
// 0 is slow, anything else medium ('neutral').
export function displayPaceOf(roster) {
  const avgTeamHandicap = roster.reduce((s, p) => s + hcap(p), 0) / 2;
  return avgTeamHandicap > 2 ? 'fast' : avgTeamHandicap < 0 ? 'slow' : 'neutral';
}

// ---------------------------------------------------------------------------
// The whole pipeline
// ---------------------------------------------------------------------------

const teamTotal = (side) => side.reduce((s, p) => s + hcap(p), 0);

// Build one board. `mode` is 'standard' or 'fast' (the Fast board plans
// fast chukkas for the high-goal players). Returns { error } when there's
// nothing to schedule, otherwise { board, warnings }.
export function generateBoard(players, mode = 'standard') {
  const valid = players.filter((p) => p.name.trim() !== '');
  if (valid.length < 2) return { error: 'Add at least two named players before generating a board.' };
  const totalRequested = valid.reduce((s, p) => s + wantedOf(p), 0);
  if (totalRequested === 0) {
    return { error: 'Give at least one player a chukka to play — the number of chukkas is worked out from these requests.' };
  }

  const numChukkas = Math.ceil(totalRequested / CAPACITY);
  const paceLabels = buildPaceLabels(valid, numChukkas, totalRequested, mode);
  const plannedFast = paceLabels.filter((l) => l === 'fast').length;

  // Try several randomised passes and keep whichever scores best: everyone
  // gets their chukkas, then handicap gaps, then -1.5s/-2s kept out of fast
  // chukkas, then timing preferences, shirt changes, planned fast chukkas,
  // slow requests, and finally overall balance.
  let best = null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const { chukkas, assigned, actualPace } = fillChukkas(valid, numChukkas, CAPACITY, paceLabels, attempt > 0);
    repairChukkas(chukkas, valid, numChukkas, actualPace);
    const violations = timingViolations(chukkas, valid, numChukkas);
    const { history, totalDiff, totalChanges } = assignColours(chukkas, valid);
    const unmet = valid.reduce((s, p) => s + Math.max(0, Math.min(wantedOf(p), numChukkas) - assigned[p.id]), 0);
    const paceMismatch = valid.reduce((s, p) => {
      const slowRequested = isBeginner(p) ? 0 : slowNeedOf(p);
      if (slowRequested === 0) return s;
      const nonFastCount = chukkas.filter((c) => c.players.some((pp) => pp.id === p.id) && c.displayPace !== 'fast').length;
      return s + Math.max(0, slowRequested - nonFastCount);
    }, 0);
    const tooFast = chukkas.reduce((s, c) => s + (c.displayPace === 'fast' ? c.players.filter(neverFast).length : 0), 0);
    const fastMiss = chukkas.filter((c) => c.pace === 'fast' && c.displayPace !== 'fast').length;
    const capBreaches = Object.values(history).reduce((s, h) => s + Math.max(0, h.changes - 3), 0);
    const gapBreaches = chukkas.reduce((s, c) => {
      const hasBeginner = c.players.some(isBeginner);
      return s + Math.max(0, Math.abs(teamTotal(c.blue) - teamTotal(c.white)) - (hasBeginner ? 3 : 2));
    }, 0);
    const score =
      unmet * 100000 +
      gapBreaches * 3000 +
      tooFast * 2000 +
      violations.length * 1500 +
      capBreaches * 1000 +
      fastMiss * 500 +
      paceMismatch * 200 +
      totalChanges * 50 +
      totalDiff * 10;
    if (!best || score < best.score) {
      best = { chukkas, assigned, history, unmet, totalDiff, totalChanges, actualPace, violations, score };
    }
  }

  const warn = [];
  valid.forEach((p) => {
    const requested = wantedOf(p);
    if (requested > numChukkas) {
      warn.push(`${p.name} asked for ${requested} chukkas but the day only has ${numChukkas} — they'll play in all ${numChukkas}.`);
    }
    const got = best.assigned[p.id];
    if (got < Math.min(requested, numChukkas)) {
      warn.push(`${p.name} only got ${got} of ${requested} requested chukkas.`);
    }
    const slowRequested = isBeginner(p) ? 0 : slowNeedOf(p);
    if (slowRequested > 0) {
      const fastOnes = best.chukkas
        .filter((c) => c.players.some((pp) => pp.id === p.id) && c.displayPace === 'fast')
        .map((c) => c.index + 1);
      const nonFastCount = best.chukkas.filter((c) => c.players.some((pp) => pp.id === p.id) && c.displayPace !== 'fast').length;
      const short = Math.max(0, slowRequested - nonFastCount);
      if (short > 0) {
        warn.push(
          `${p.name}: only got ${slowRequested - short} of ${slowRequested} slow chukkas without landing in a fast one (fast: Chukka ${fastOnes.join(', ')}).`
        );
      }
    }
  });
  best.chukkas.forEach((c) => {
    if (c.players.length < CAPACITY) {
      warn.push(`Chukka ${c.index + 1} only has ${c.players.length} of ${CAPACITY} spots filled — not enough spare chukka requests left to fill it.`);
    }
    const hasBeginner = c.players.some(isBeginner);
    const gap = Math.abs(teamTotal(c.blue) - teamTotal(c.white));
    const gapCap = hasBeginner ? 3 : 2;
    if (gap > gapCap) {
      warn.push(`Chukka ${c.index + 1}: handicap gap is ${gap}, couldn't get it under ${gapCap} given who's in that chukka.`);
    }
    if (c.displayPace === 'fast') {
      c.players.filter(neverFast).forEach((p) => {
        warn.push(`${p.name} (${p.handicap}) is in fast Chukka ${c.index + 1} — couldn't keep them out given who's playing.`);
      });
    }
    if (c.pace === 'fast' && c.displayPace !== 'fast') {
      warn.push(`Chukka ${c.index + 1} was planned fast but came out ${c.displayPace === 'slow' ? 'slow' : 'medium'}.`);
    }
  });
  best.violations.forEach((v) => {
    warn.push(`${v.name} played Chukka ${v.chukka} outside their ${v.pref} preference — kept the handicap balance intact instead.`);
  });
  Object.entries(best.history).forEach(([id, h]) => {
    if (h.changes > 3) {
      const p = valid.find((pp) => pp.id === Number(id));
      if (p) warn.push(`${p.name} changed shirts ${h.changes} times — couldn't hold it to 3 given the rest of the day's constraints.`);
    }
  });

  const displayValid = [...valid].sort((a, b) => hcap(b) - hcap(a));
  return {
    board: { ...best, mode, plannedFast, numChukkas, capacity: CAPACITY, teamSize: TEAM_SIZE, valid: displayValid },
    warnings: warn,
  };
}
