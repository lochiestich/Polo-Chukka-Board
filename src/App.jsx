import React, { useState, useEffect, useRef } from 'react';
import { Plus, Minus, Trash2, Shuffle, AlertTriangle } from 'lucide-react';

let idCounter = 1;
const makePlayer = (name = '', handicap = 0, chukkasWanted = 3, timingPref = 'none', slowChukkas = 0) => ({
  id: idCounter++,
  name,
  handicap,
  chukkasWanted,
  timingPref, // 'none' | 'early' | 'late'
  slowChukkas, // how many of their chukkas must be slow — the rest can be anything
});

const SAMPLE = [
  makePlayer('Callum', 3, 7),
  makePlayer('Harry S', 2.5, 6),
  makePlayer('Geoff', 2, 9),
  makePlayer('Jules', 2, 4),
  makePlayer('Kimoi', 2, 4),
  makePlayer('Gideon', 1, 4),
  makePlayer('Lochie', 1, 4),
  makePlayer('Cheza', 1, 7),
  makePlayer('Jennie', 0.5, 3),
  makePlayer('Nikki', 0.5, 4),
  makePlayer('Lekishon', 0.5, 3),
  makePlayer('Charlie M', 0, 5),
  makePlayer('Isaac', 0, 7),
  makePlayer('Cindy', 0, 4),
  makePlayer('Sasha', -0.5, 4),
  makePlayer('Rowena', -0.5, 5),
  makePlayer('Alex', -0.5, 4),
  makePlayer('Piers', -0.5, 4),
  makePlayer('Michelle', -1, 4),
  makePlayer('Charlotte', -1, 4),
  makePlayer('Alice*', -1, 4),
  makePlayer('Archie S', -1.5, 4),
  makePlayer('Jamie', -1.5, 4),
  makePlayer('Natalie', -1.5, 4),
  makePlayer('Caspar', -2, 4),
  makePlayer('Charlie W', -2, 4),
  makePlayer('James', -2, 2),
  makePlayer('Zak', -2, 3),
  makePlayer('Jack', 1.5, 3),
];

// Remember the roster between visits. Wrapped defensively — if storage isn't
// available (some sandboxed previews block it), this just quietly falls back
// to starting fresh each time instead of breaking the app.
const STORAGE_KEY = 'chukka-board-players-v1';

function loadStoredPlayers() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    let maxId = 0;
    parsed.forEach((p) => {
      if (typeof p.id === 'number' && p.id > maxId) maxId = p.id;
    });
    idCounter = maxId + 1;
    return parsed;
  } catch (e) {
    return null;
  }
}

function saveStoredPlayers(players) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
  } catch (e) {
    // storage unavailable — nothing to do, the session just won't persist
  }
}

// K.P.A. Handicap List — July 2026, Kenya handicap column only (the second
// yellow block lower down the sheet was a separate list and isn't included).
const MASTER_HANDICAPS = [
  { name: 'Casimir G', handicap: 6 },
  { name: 'James M', handicap: 4 },
  { name: 'Craig M', handicap: 4 },
  { name: 'Archie V', handicap: 4 },
  { name: 'Hansi B', handicap: 3 },
  { name: 'Joss C', handicap: 3 },
  { name: 'Tarquin G', handicap: 3 },
  { name: 'George M', handicap: 3 },
  { name: 'Callum S', handicap: 3 },
  { name: 'Izzy V', handicap: 3 },
  { name: 'Harry G', handicap: 2.5 },
  { name: 'Tiva G', handicap: 2.5 },
  { name: 'William M', handicap: 2.5 },
  { name: 'Jadini N', handicap: 2.5 },
  { name: 'Harry S', handicap: 2.5 },
  { name: 'Kimoi M', handicap: 2 },
  { name: 'Julian C', handicap: 2 },
  { name: 'Geoffrey M', handicap: 2 },
  { name: 'Mbugua N', handicap: 2 },
  { name: 'Amani N', handicap: 2 },
  { name: 'Ben S', handicap: 2 },
  { name: 'Richard S', handicap: 2 },
  { name: 'Vishal S', handicap: 1.5 },
  { name: 'Phillip A', handicap: 1.5 },
  { name: 'Omwakwe A', handicap: 1.5 },
  { name: 'Megan G', handicap: 1.5 },
  { name: 'Gordy M', handicap: 1.5 },
  { name: 'Raphael N', handicap: 1.5 },
  { name: 'Jamie E', handicap: 1.5 },
  { name: 'Aisha G', handicap: 1 },
  { name: 'Sacha G', handicap: 1 },
  { name: 'Gregory K', handicap: 1 },
  { name: 'Cheza M', handicap: 1 },
  { name: 'Nicholas M', handicap: 1 },
  { name: 'Gideon M', handicap: 1 },
  { name: 'John M', handicap: 1 },
  { name: 'Hiromi N', handicap: 1 },
  { name: 'Izzy S', handicap: 1 },
  { name: 'Jonathan S', handicap: 1 },
  { name: 'Tom S', handicap: 1 },
  { name: 'Natasha T', handicap: 1 },
  { name: 'Moses W', handicap: 1 },
  { name: 'Lochie S', handicap: 1 },
  { name: 'Jennie C', handicap: 0.5 },
  { name: 'Phyllipa G', handicap: 0.5 },
  { name: 'Alastair J', handicap: 0.5 },
  { name: 'Georgina M', handicap: 0.5 },
  { name: 'Lochlan M', handicap: 0.5 },
  { name: 'Mike M', handicap: 0.5 },
  { name: 'Nikki B', handicap: 0.5 },
  { name: 'Lekeshon O', handicap: 0.5 },
  { name: 'Lemmuel S', handicap: 0.5 },
  { name: 'Miranda S', handicap: 0.5 },
  { name: 'Edward B', handicap: 0.5 },
  { name: 'Georgy A', handicap: 0 },
  { name: 'Fredd K', handicap: 0 },
  { name: 'Louis d', handicap: 0 },
  { name: 'Peter G', handicap: 0 },
  { name: 'Magda J', handicap: 0 },
  { name: 'Joe K', handicap: 0 },
  { name: 'Isaac M', handicap: 0 },
  { name: 'Kaila M', handicap: 0 },
  { name: 'Charlie M', handicap: 0 },
  { name: 'Simon M', handicap: 0 },
  { name: 'Kevin K', handicap: 0 },
  { name: 'Tom A', handicap: -0.5 },
  { name: 'Beezie B', handicap: -0.5 },
  { name: 'Sacha C', handicap: -0.5 },
  { name: 'Archie C', handicap: -0.5 },
  { name: 'Magali D', handicap: -0.5 },
  { name: 'Vincent D', handicap: -0.5 },
  { name: 'Oskar d', handicap: -0.5 },
  { name: 'Sarah G', handicap: -0.5 },
  { name: 'Kelvin J', handicap: -0.5 },
  { name: 'Tom M', handicap: -0.5 },
  { name: 'Vesper M', handicap: -0.5 },
  { name: 'Daisy O', handicap: -0.5 },
  { name: 'Josh S', handicap: -0.5 },
  { name: 'Rowena S', handicap: -0.5 },
  { name: 'Emily S', handicap: -0.5 },
  { name: 'Alex T', handicap: -0.5 },
  { name: 'Piers W', handicap: -0.5 },
  { name: 'Ben Y', handicap: -0.5 },
  { name: 'Michelle M', handicap: -1 },
  { name: 'Ben M', handicap: -1 },
  { name: 'Milly S', handicap: -1 },
  { name: 'Charlotte M', handicap: -1 },
  { name: 'Alice O', handicap: -1 },
  { name: 'Vincent D', handicap: -1 },
  { name: 'Karim A', handicap: -1.5 },
  { name: 'Sharon A', handicap: -1.5 },
  { name: 'Billy C', handicap: -1.5 },
  { name: 'Anna D', handicap: -1.5 },
  { name: 'Eva K', handicap: -1.5 },
  { name: 'Miranda R', handicap: -1.5 },
  { name: 'Archie S', handicap: -1.5 },
  { name: 'Jamie S', handicap: -1.5 },
  { name: 'Sam T', handicap: -1.5 },
  { name: 'Natalie Y', handicap: -1.5 },
  { name: 'Angus B', handicap: -2 },
  { name: 'Zak B', handicap: -2 },
  { name: 'Lena K', handicap: -2 },
  { name: 'Anton L', handicap: -2 },
  { name: 'Alexandra M', handicap: -2 },
  { name: 'Hamish M', handicap: -2 },
  { name: 'Oscar O', handicap: -2 },
  { name: 'Charlie S', handicap: -2 },
  { name: 'Casper W', handicap: -2 },
  { name: 'Charlie W', handicap: -2 },
];

// Compares two same-length arrays of numbers in priority order, returning
// negative if `a` should be preferred, positive if `b` should be preferred,
// 0 if tied on every entry. Used to rank chukka team-splits against a list
// of priorities without a fragile hand-nested chain of tie-breaks.
function compareKeys(a, b) {
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

// Spread `count` items as evenly as possible across `total` slots.
function evenIndices(count, total) {
  const idx = [];
  for (let i = 0; i < count; i++) idx.push(Math.min(total - 1, Math.floor((i + 0.5) * (total / count))));
  return idx;
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="flex rounded overflow-hidden border border-emerald-800 text-xs">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-2 py-0.5 ${
            value === opt.value ? 'bg-amber-600 text-emerald-950 font-medium' : 'bg-emerald-900 text-emerald-400 hover:bg-emerald-800'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function MiniStepper({ value, onDec, onInc, onSet, disabled, min = 0, editable = false }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onDec}
        className="p-1 border border-emerald-800 rounded text-emerald-300 hover:text-stone-50 hover:bg-emerald-800 disabled:opacity-30"
        disabled={value <= min}
      >
        <Minus size={12} />
      </button>
      {editable ? (
        <input
          type="number"
          value={value}
          onFocus={(e) => e.target.select()}
          onChange={(e) => onSet(Number(e.target.value))}
          className="w-9 text-center bg-transparent font-mono text-stone-50 text-sm border border-emerald-800 rounded focus:outline-none focus:border-amber-500"
        />
      ) : (
        <span className="min-w-6 px-0.5 text-center font-mono text-stone-50 text-sm">{value}</span>
      )}
      <button
        onClick={onInc}
        className="p-1 border border-emerald-800 rounded text-emerald-300 hover:text-stone-50 hover:bg-emerald-800 disabled:opacity-30"
        disabled={disabled}
      >
        <Plus size={12} />
      </button>
    </div>
  );
}

// Roster row layout. On phones the steppers get fixed-width columns and the
// name takes whatever is left; from the sm breakpoint up it's a 12-column grid.
const ROSTER_GRID = 'grid grid-cols-[minmax(0,1fr)_6rem_5.5rem_1.25rem] sm:grid-cols-12 gap-2';

const TIMING_OPTIONS = [
  { value: 'early', label: 'Early' },
  { value: 'none', label: '—' },
  { value: 'late', label: 'Late' },
];

// Decide how many chukkas in the day need to be deliberately Slow, based on
// how many slow chukkas were requested (beginners are auto-counted in full).
// Everything else is left unplanned/neutral — it can end up fast, medium, or
// slow depending on who ends up in it, since only Slow is ever requested.
function buildPaceLabels(valid, numChukkas, totalRequested) {
  const demandSlow = valid.reduce((s, p) => {
    const isBeginner = (Number(p.handicap) || 0) <= -2;
    return s + (isBeginner ? Number(p.chukkasWanted) || 0 : Number(p.slowChukkas) || 0);
  }, 0);
  const targetSlow = totalRequested > 0 ? Math.round((demandSlow / totalRequested) * numChukkas) : 0;

  const labels = new Array(numChukkas).fill('neutral');
  const place = (count, label) => {
    const positions = evenIndices(Math.min(count, numChukkas), numChukkas);
    positions.forEach((i) => {
      let j = i;
      if (labels[j] !== 'neutral') {
        let offset = 1;
        while (offset < numChukkas) {
          if (j - offset >= 0 && labels[j - offset] === 'neutral') {
            j -= offset;
            break;
          }
          if (j + offset < numChukkas && labels[j + offset] === 'neutral') {
            j += offset;
            break;
          }
          offset++;
        }
      }
      if (labels[j] === 'neutral') labels[j] = label;
    });
  };
  place(targetSlow, 'slow');
  return labels;
}

// Early timing preference leans toward chukkas before `firstTwoThirds`; late
// leans toward chukkas at or after `lastTwoThirdsStart`.
function timingWindow(numChukkas) {
  return {
    firstTwoThirds: Math.ceil((numChukkas * 2) / 3),
    lastTwoThirdsStart: Math.floor(numChukkas / 3),
  };
}

function outOfTimingWindow(pref, index, win) {
  if (pref === 'early') return index >= win.firstTwoThirds;
  if (pref === 'late') return index < win.lastTwoThirdsStart;
  return false;
}

function timingViolations(chukkas, valid, numChukkas) {
  const win = timingWindow(numChukkas);
  const violations = [];
  valid.forEach((p) => {
    if (p.timingPref === 'none') return;
    chukkas.forEach((c) => {
      if (!c.players.some((pp) => pp.id === p.id)) return;
      if (outOfTimingWindow(p.timingPref, c.index, win)) violations.push({ name: p.name, chukka: c.index + 1, pref: p.timingPref });
    });
  });
  return violations;
}

// Random tie-break noise added to each fill score on every attempt after the
// first. Big enough to reshuffle the soft pace/handicap nudges (which are worth
// tens of points) so the attempts genuinely differ, but far too small to touch
// the deficit ordering (×1000) that makes the pour-fill pour, or the -100000
// one-helper-per-beginner-chukka rule.
const FILL_JITTER = 20;

// Fill chukkas like pouring water: Chukka 1 fills completely before Chukka 2,
// and so on. Whoever has the most chukkas left always gets first claim on a
// spot, so only the tail can end up short. Early/late preference is a strong
// but soft nudge — early leans toward the first two-thirds of the day, late
// toward the last two-thirds — but it always yields if honouring it would
// force a roster no split could keep under the handicap-gap cap (e.g. every
// -2 handicap player asking for late at once). Fast/slow requests are
// matched against each chukka's pace label where possible; slow chukkas get
// a soft nudge toward lower-handicap players, fast chukkas toward
// higher-handicap ones.
function fillChukkas(valid, numChukkas, capacity, paceLabels, jitter) {
  const chukkas = Array.from({ length: numChukkas }, (_, i) => ({ index: i, pace: paceLabels[i], players: [] }));
  const need = {};
  const actualPace = {};
  valid.forEach((p) => {
    const wanted = Number(p.chukkasWanted) || 0;
    const isBeginner = (Number(p.handicap) || 0) <= -2;
    const slow = isBeginner ? wanted : Number(p.slowChukkas) || 0;
    const none = Math.max(0, wanted - slow);
    need[p.id] = { slow, none };
    actualPace[p.id] = { slow: 0 };
  });

  const { firstTwoThirds, lastTwoThirdsStart } = timingWindow(numChukkas);

  chukkas.forEach((c) => {
    const chosenIds = new Set();
    for (let slot = 0; slot < capacity; slot++) {
      let bestP = null;
      let bestScore = -Infinity;
      valid.forEach((p) => {
        if (chosenIds.has(p.id)) return;
        const n = need[p.id];
        const deficit = n.slow + n.none;
        if (deficit <= 0) return;
        let score = deficit * 1000;
        if (p.timingPref === 'early') {
          const remainingWindow = firstTwoThirds - c.index;
          const inWindow = c.index < firstTwoThirds;
          const urgency = remainingWindow > 0 ? deficit / remainingWindow : 0;
          score += (inWindow ? urgency * 8000 : -2500) + (firstTwoThirds - c.index) * 10;
        } else if (p.timingPref === 'late') {
          const remainingWindow = numChukkas - c.index;
          const inWindow = c.index >= lastTwoThirdsStart;
          const urgency = remainingWindow > 0 ? deficit / remainingWindow : 0;
          score += (inWindow ? urgency * 8000 : -2500) + (c.index - lastTwoThirdsStart + 1) * 10;
        }
        if (c.pace === 'slow') score += n.slow > 0 ? 50 : 20;
        const h = Number(p.handicap) || 0;
        if (c.pace === 'slow') {
          const effH = Math.max(h, -3); // don't keep rewarding ever-lower handicaps without limit
          score += (2 - effH) * 3;
          const lowCount = c.players.filter((cp) => (Number(cp.handicap) || 0) <= -3).length;
          if (lowCount >= 3 && h >= 0) score += 150; // nudge in a higher-goal helper once it's gotten very low
          if (h <= -2) {
            const beginnerCount = c.players.filter((cp) => (Number(cp.handicap) || 0) <= -2).length;
            score += beginnerCount * 60; // pull -2 beginners into the same chukkas together — but no one else
          }
          const beginnersInChukka = c.players.filter((cp) => (Number(cp.handicap) || 0) <= -2).length;
          const highInChukka = c.players.filter((cp) => (Number(cp.handicap) || 0) > 0).length;
          if (h > 0 && beginnersInChukka >= 1 && highInChukka >= 1) {
            score -= 100000; // any chukka with a beginner in it caps out at one high-goal player, full stop
          }
        } else if (c.pace === 'neutral' && n.slow > 0 && c.players.length > 0) {
          // Someone who specifically asked for a slow chukka shouldn't end
          // up in a neutral chukka that's shaping up to be a fast one —
          // steer them toward chukkas that are staying lower-handicap.
          const avgSoFar = c.players.reduce((s, cp) => s + (Number(cp.handicap) || 0), 0) / c.players.length;
          if (avgSoFar > 0.5) score -= (avgSoFar - 0.5) * 15;
        }
        score += jitter ? Math.random() * FILL_JITTER : 0;
        if (score > bestScore) {
          bestScore = score;
          bestP = p;
        }
      });
      if (!bestP) break;

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
  });

  const assigned = {};
  valid.forEach((p) => {
    const n = need[p.id];
    assigned[p.id] = (Number(p.chukkasWanted) || 0) - (n.slow + n.none);
  });

  return { chukkas, assigned, actualPace, violations: timingViolations(chukkas, valid, numChukkas) };
}

// The balance rules for one Blue/White split, in priority order (see the
// comment in assignColours for why the gap cap must come first). Shared by
// assignColours and the repair pass so the two can never disagree.
function balancePenalties(sumBlue, sumWhite, blueBeginners, whiteBeginners, blueHigh, whiteHigh) {
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
      (blueBeginners > 0 ? Math.max(0, blueHigh - 1) : 0) + (whiteBeginners > 0 ? Math.max(0, whiteHigh - 1) : 0),
  };
}

const comboCache = {};
function cachedCombinations(n, k) {
  const cacheKey = `${n}:${k}`;
  if (!comboCache[cacheKey]) comboCache[cacheKey] = combinations([...Array(n).keys()], k);
  return comboCache[cacheKey];
}

// The best balance a chukka's roster could possibly get from any split,
// ignoring shirt-colour history: [gap cap, beginner-side 2.5 cap, beginner-side
// -6 floor, one helper per beginner side]. All zeros means fully compliant.
function rosterBalanceKey(roster) {
  const total = roster.length;
  if (total < 2) return [0, 0, 0, 0];
  const hs = roster.map((p) => Number(p.handicap) || 0);
  let best = null;
  for (const comboIdx of cachedCombinations(total, Math.ceil(total / 2))) {
    let sumBlue = 0, sumWhite = 0, blueBeginners = 0, whiteBeginners = 0, blueHigh = 0, whiteHigh = 0;
    let ci = 0;
    for (let i = 0; i < total; i++) {
      const h = hs[i];
      const inBlue = comboIdx[ci] === i;
      if (inBlue) ci++;
      if (inBlue) {
        sumBlue += h;
        if (h <= -2) blueBeginners++;
        if (h > 0) blueHigh++;
      } else {
        sumWhite += h;
        if (h <= -2) whiteBeginners++;
        if (h > 0) whiteHigh++;
      }
    }
    const pen = balancePenalties(sumBlue, sumWhite, blueBeginners, whiteBeginners, blueHigh, whiteHigh);
    const key = [pen.diffCapPenalty, pen.hardCapPenalty, pen.weakTeamPenalty, pen.beginnerPenalty];
    if (!best || compareKeys(key, best) < 0) best = key;
    if (best.every((k) => k <= 1e-9)) break;
  }
  return best;
}

const addKeys = (a, b) => a.map((x, i) => x + b[i]);
const isClean = (key) => key.every((k) => k <= 1e-9);

// Repair pass, run after the pour-fill. Some chukkas come out of the greedy
// fill with a roster that no Blue/White split can make compliant (e.g. too
// many high-goal players alongside beginners). For the worst such chukka, try
// swapping one of its players with a player from another chukka, and take the
// swap that most improves the two chukkas' combined balance key — same
// priority order as assignColours, gap cap first. A swap keeps every player's
// chukka count and every chukka's size, so the pour-fill and the requested
// totals are untouched. A swap is never taken if it adds an early/late miss
// for either player, or takes a slow-labelled chukka away from someone who
// still needs one. Every accepted swap strictly improves the day's total
// balance key, so this can't loop; it stops when nothing more can be fixed.
function repairChukkas(chukkas, valid, numChukkas, actualPace) {
  const win = timingWindow(numChukkas);
  const slowNeed = {};
  const slowCount = {};
  valid.forEach((p) => {
    const wanted = Number(p.chukkasWanted) || 0;
    slowNeed[p.id] = (Number(p.handicap) || 0) <= -2 ? wanted : Number(p.slowChukkas) || 0;
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
        Y.players.forEach((b, bi) => {
          if (xIds.has(b.id)) return;
          const missesBefore =
            (outOfTimingWindow(a.timingPref, X.index, win) ? 1 : 0) + (outOfTimingWindow(b.timingPref, Y.index, win) ? 1 : 0);
          const missesAfter =
            (outOfTimingWindow(a.timingPref, Y.index, win) ? 1 : 0) + (outOfTimingWindow(b.timingPref, X.index, win) ? 1 : 0);
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

// Within each chukka, try every possible way to split the roster into two
// sides and keep whichever split has the smallest handicap gap, while
// strongly preferring to keep each player in the same shirt colour all day —
// only trading that away when it's the only way to protect the beginner
// rules, and treating pure handicap balance as a lower priority than colour
// continuity once those rules are satisfied.
function assignColours(chukkas, valid) {
  const history = {};
  valid.forEach((p) => {
    history[p.id] = { colour: null, streak: 0, changes: 0 };
  });
  let totalDiff = 0;

  chukkas.forEach((c) => {
    const roster = c.players;
    const total = roster.length;
    const targetBlue = Math.ceil(total / 2);
    const idxArr = roster.map((_, i) => i);
    const combos = combinations(idxArr, targetBlue);

    // Pair up similarly-ranked players (by handicap) so a good split doesn't
    // just balance the sum — it also avoids stacking, say, the two strongest
    // and two weakest on one side against four mediums on the other.
    const sortedByH = [...roster].sort((a, b) => (Number(b.handicap) || 0) - (Number(a.handicap) || 0));
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
      let blueHigh = 0;
      let whiteBeginners = 0;
      let whiteHigh = 0;
      const pairSeen = {};
      roster.forEach((p, i) => {
        const inBlue = blueSet.has(i);
        const h = Number(p.handicap) || 0;
        if (inBlue) sumBlue += h;
        else sumWhite += h;
        if (h <= -2) {
          if (inBlue) blueBeginners++;
          else whiteBeginners++;
        }
        if (h > 0) {
          if (inBlue) blueHigh++;
          else whiteHigh++;
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
      // have a beginner. This is now checked FIRST, above every beginner
      // rule below — because putting all the beginners on one side always
      // trivially satisfies "don't overload a beginner's side" and "don't
      // stack helpers", which let a split with an enormous gap look
      // "compliant" purely by exempting the other side from any beginner
      // rule at all. Only among splits that already keep the gap in check
      // do the finer beginner protections get to break ties: never exceed a
      // 2.5 total on a beginner's side; a beginner's side can't drop below
      // -6; at most one high-goal (over 0) helper on a beginner's side; try
      // not to push anyone past 3 shirt changes for the day (a soft
      // preference — an uneven team is worse than an extra shirt change);
      // prefer keeping colours the same generally; minimise the handicap
      // gap further; avoid stacking strong/weak pairs together. Each entry
      // is compared in turn — only moving to the next one if the current
      // one is tied.
      const { diffCapPenalty, hardCapPenalty, weakTeamPenalty, beginnerPenalty } = balancePenalties(
        sumBlue,
        sumWhite,
        blueBeginners,
        whiteBeginners,
        blueHigh,
        whiteHigh
      );
      const key = [diffCapPenalty, hardCapPenalty, weakTeamPenalty, beginnerPenalty, changeCapPenalty, changeCost, diff, pairPenalty];
      const better = !best || compareKeys(key, best.key) < 0;
      if (better) {
        best = { key, diff, hardCapPenalty, beginnerPenalty, weakTeamPenalty, changeCapPenalty, diffCapPenalty, pairPenalty, changeCost, blueSet };
      }
    });

    if (!best) {
      c.blue = [];
      c.white = [];
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
    const blueSum = blueList.reduce((s, p) => s + (Number(p.handicap) || 0), 0);
    const whiteSum = whiteList.reduce((s, p) => s + (Number(p.handicap) || 0), 0);
    const avgTeamHandicap = (blueSum + whiteSum) / 2;
    c.displayPace = avgTeamHandicap > 2 ? 'fast' : avgTeamHandicap < 0 ? 'slow' : 'neutral';
  });

  const totalChanges = Object.values(history).reduce((s, h) => s + h.changes, 0);
  return { history, totalDiff, totalChanges };
}

export default function ChukkaBoardApp() {
  const [players, setPlayers] = useState(() => loadStoredPlayers() || SAMPLE);
  const teamSize = 4; // always 4 a side — 8 players per chukka
  const [board, setBoard] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [shareStatus, setShareStatus] = useState('');
  const boardRef = useRef(null);

  useEffect(() => {
    saveStoredPlayers(players);
  }, [players]);

  const selectSuggestion = (p, match) => {
    setPlayers((ps) => ps.map((pp) => (pp.id === p.id ? { ...pp, name: match.name, handicap: match.handicap } : pp)));
    setOpenDropdownId(null);
  };

  const updatePlayer = (id, field, value) =>
    setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  const addPlayer = () => setPlayers((ps) => [...ps, makePlayer('', 0, 3)]);
  const removePlayer = (id) => setPlayers((ps) => ps.filter((p) => p.id !== id));
  const clearAll = () => {
    setPlayers([]);
    setBoard(null);
    setWarnings([]);
  };
  const loadSample = () => {
    setPlayers(SAMPLE.map((p) => ({ ...p })));
    setBoard(null);
    setWarnings([]);
  };

  const setChukkasWanted = (p, raw) => {
    const next = Math.max(0, Math.floor(Number(raw) || 0));
    let slow = Number(p.slowChukkas) || 0;
    if (slow > next) slow = next;
    setPlayers((ps) => ps.map((pp) => (pp.id === p.id ? { ...pp, chukkasWanted: next, slowChukkas: slow } : pp)));
  };

  const adjustSlow = (p, delta) => {
    const cur = Number(p.slowChukkas) || 0;
    const wanted = Number(p.chukkasWanted) || 0;
    const next = cur + delta;
    if (next < 0 || next > wanted) return;
    updatePlayer(p.id, 'slowChukkas', next);
  };

  const capacityPerChukka = teamSize * 2;
  const validNow = players.filter((p) => p.name.trim() !== '');
  const totalRequestedNow = validNow.reduce((s, p) => s + (Number(p.chukkasWanted) || 0), 0);
  const computedChukkas = totalRequestedNow > 0 ? Math.ceil(totalRequestedNow / capacityPerChukka) : 0;

  function generate() {
    const warn = [];
    const valid = players.filter((p) => p.name.trim() !== '');

    if (valid.length < 2) {
      setWarnings(['Add at least two named players before generating a board.']);
      setBoard(null);
      return;
    }
    const totalRequested = valid.reduce((s, p) => s + (Number(p.chukkasWanted) || 0), 0);
    if (totalRequested === 0) {
      setWarnings(['Give at least one player a chukka to play — the number of chukkas is worked out from these requests.']);
      setBoard(null);
      return;
    }

    const numChukkas = Math.ceil(totalRequested / capacityPerChukka);
    const paceLabels = buildPaceLabels(valid, numChukkas, totalRequested);

    // Try several randomised passes and keep whichever fills the most
    // requested chukkas, balances handicaps best, matches slow-chukka
    // requests best, and changes the fewest shirts, in that order.
    const ATTEMPTS = 15;
    let best = null;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const { chukkas, assigned, actualPace } = fillChukkas(
        valid,
        numChukkas,
        capacityPerChukka,
        paceLabels,
        attempt > 0
      );
      repairChukkas(chukkas, valid, numChukkas, actualPace);
      const violations = timingViolations(chukkas, valid, numChukkas);
      const { history, totalDiff, totalChanges } = assignColours(chukkas, valid);
      const unmet = valid.reduce((s, p) => s + Math.max(0, (Number(p.chukkasWanted) || 0) - assigned[p.id]), 0);
      const paceMismatch = valid.reduce((s, p) => {
        const slowRequested = Number(p.slowChukkas) || 0;
        if (slowRequested === 0) return s;
        const nonFastCount = chukkas.filter((c) => c.players.some((pp) => pp.id === p.id) && c.displayPace !== 'fast').length;
        return s + Math.max(0, slowRequested - nonFastCount);
      }, 0);
      const capBreaches = Object.values(history).reduce((s, h) => s + Math.max(0, h.changes - 3), 0);
      const gapBreaches = chukkas.reduce((s, c) => {
        const hasBeginner = c.players.some((p) => (Number(p.handicap) || 0) <= -2);
        const blueTotal = c.blue.reduce((sb, p) => sb + (Number(p.handicap) || 0), 0);
        const whiteTotal = c.white.reduce((sw, p) => sw + (Number(p.handicap) || 0), 0);
        return s + Math.max(0, Math.abs(blueTotal - whiteTotal) - (hasBeginner ? 3 : 2));
      }, 0);
      const score =
        unmet * 100000 +
        gapBreaches * 3000 +
        violations.length * 1500 +
        capBreaches * 1000 +
        paceMismatch * 200 +
        totalChanges * 50 +
        totalDiff * 10;
      if (!best || score < best.score) {
        best = { chukkas, assigned, history, unmet, totalDiff, totalChanges, actualPace, violations, score };
      }
    }

    valid.forEach((p) => {
      const requested = Number(p.chukkasWanted) || 0;
      if (requested > numChukkas) {
        warn.push(`${p.name} asked for ${requested} chukkas but the day only has ${numChukkas} — they'll play in all ${numChukkas}.`);
      }
      const slowRequested = Number(p.slowChukkas) || 0;
      if (slowRequested > 0) {
        const fastOnes = best.chukkas
          .filter((c) => c.players.some((pp) => pp.id === p.id) && c.displayPace === 'fast')
          .map((c) => c.index + 1);
        const nonFastCount = best.chukkas.filter((c) => c.players.some((pp) => pp.id === p.id) && c.displayPace !== 'fast').length;
        const short = Math.max(0, slowRequested - nonFastCount);
        if (short > 0) {
          warn.push(
            `${p.name}: only got ${slowRequested - short} of ${slowRequested} requested slow chukkas without landing in a fast one (fast: Chukka ${fastOnes.join(', ')}).`
          );
        }
      }
    });
    best.chukkas.forEach((c) => {
      if (c.players.length < capacityPerChukka) {
        warn.push(`Chukka ${c.index + 1} (${c.displayPace}) only has ${c.players.length} of ${capacityPerChukka} spots filled — not enough spare chukka requests left to fill it.`);
      }
      const hasBeginner = c.players.some((p) => (Number(p.handicap) || 0) <= -2);
      const blueTotal = c.blue.reduce((s, p) => s + (Number(p.handicap) || 0), 0);
      const whiteTotal = c.white.reduce((s, p) => s + (Number(p.handicap) || 0), 0);
      const gap = Math.abs(blueTotal - whiteTotal);
      const gapCap = hasBeginner ? 3 : 2;
      if (gap > gapCap) {
        warn.push(`Chukka ${c.index + 1}: handicap gap is ${gap}, couldn't get it under ${gapCap} given who's in that chukka.`);
      }
    });
    best.violations.forEach((v) => {
      warn.push(
        `${v.name} played Chukka ${v.chukka} outside their ${v.pref} preference — kept the handicap balance intact instead.`
      );
    });
    Object.entries(best.history).forEach(([id, h]) => {
      if (h.changes > 3) {
        const p = valid.find((pp) => pp.id === Number(id));
        if (p) warn.push(`${p.name} changed shirts ${h.changes} times — couldn't hold it to 3 given the rest of the day's constraints.`);
      }
    });

    setWarnings(warn);
    const displayValid = [...valid].sort((a, b) => (Number(b.handicap) || 0) - (Number(a.handicap) || 0));
    setBoard({ ...best, numChukkas, capacity: capacityPerChukka, teamSize, valid: displayValid });
  }

  async function shareBoard() {
    if (!board || !boardRef.current) return;
    setShareStatus('Preparing image…');
    try {
      // Bundled, but split into its own chunk so it only downloads the first time someone shares.
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(boardRef.current, { backgroundColor: '#fafaf9', scale: 2 });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not create image');
      const file = new File([blob], 'chukka-board.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        setShareStatus('');
        await navigator.share({ title: 'Chukka Board', files: [file] });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chukka-board.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setShareStatus('Image downloaded.');
      setTimeout(() => setShareStatus(''), 4000);
    } catch (e) {
      setShareStatus("Couldn't export the image — try again.");
      setTimeout(() => setShareStatus(''), 4000);
    }
  }

  return (
    <div className="min-h-screen bg-emerald-950 text-stone-100 pb-24">
      <div className="max-w-5xl mx-auto px-4 pt-10">
        <header className="mb-8 border-b border-emerald-800 pb-6">
          <p className="text-xs uppercase tracking-widest text-amber-500 mb-1">Match Day Line-Up</p>
          <h1 className="text-4xl font-serif tracking-tight text-stone-50">Chukka Board</h1>
          <p className="text-emerald-300 mt-2 text-sm max-w-2xl">
            Enter your players, handicaps, and how many chukkas each wants — plus how many of
            those should be fast or slow, and any early/late leaning. Everything else is worked
            out for you, and the best of several attempts is kept.
          </p>
        </header>

        {/* Settings */}
        <section className="flex flex-wrap gap-6 items-end mb-6">
          <div className="text-sm text-emerald-400 pb-2">{capacityPerChukka} players per chukka (4 a side)</div>
          <div className="text-sm text-amber-400 pb-2 font-mono">Chukkas needed: {computedChukkas || '—'}</div>
          <div className="flex-1" />
          <button onClick={loadSample} className="text-xs text-emerald-400 hover:text-emerald-200 underline underline-offset-2">
            Load sample roster
          </button>
          <button onClick={clearAll} className="text-xs text-emerald-400 hover:text-emerald-200 underline underline-offset-2">
            Clear all
          </button>
        </section>

        {/* Roster */}
        <section className="mb-6">
          <div className="bg-emerald-900/60 border border-emerald-800 rounded-lg overflow-hidden">
            <div className={`${ROSTER_GRID} px-4 py-2 text-xs uppercase tracking-wide text-emerald-400 border-b border-emerald-800`}>
              <div className="sm:col-span-5">Name</div>
              <div className="sm:col-span-3">Handicap</div>
              <div className="sm:col-span-3">
                <span className="sm:hidden">Chukkas</span>
                <span className="hidden sm:inline">Chukkas wanted</span>
              </div>
              <div className="sm:col-span-1" />
            </div>
            {players.map((p) => {
              return (
                <div key={p.id} className="border-b border-emerald-800/60 last:border-b-0 px-4 py-2">
                  <div className={`${ROSTER_GRID} items-center`}>
                    <div className="sm:col-span-5 relative">
                      <input
                        className="w-full bg-transparent border border-emerald-800 rounded px-2 py-1 text-stone-50 placeholder-emerald-600"
                        placeholder="Player name"
                        value={p.name}
                        onFocus={() => setOpenDropdownId(p.id)}
                        onBlur={() => setTimeout(() => setOpenDropdownId((id) => (id === p.id ? null : id)), 150)}
                        onChange={(e) => {
                          updatePlayer(p.id, 'name', e.target.value);
                          setOpenDropdownId(p.id);
                        }}
                      />
                      {openDropdownId === p.id &&
                        p.name.trim().length > 0 &&
                        (() => {
                          const matches = MASTER_HANDICAPS.filter((m) =>
                            m.name.toLowerCase().includes(p.name.trim().toLowerCase())
                          ).slice(0, 6);
                          if (matches.length === 0) return null;
                          return (
                            <div className="absolute z-20 mt-1 w-full bg-emerald-950 border border-emerald-700 rounded shadow-lg overflow-hidden">
                              {matches.map((m) => (
                                <button
                                  key={m.name}
                                  type="button"
                                  onMouseDown={() => selectSuggestion(p, m)}
                                  className="w-full text-left px-2 py-1.5 text-sm text-stone-50 hover:bg-emerald-800 flex justify-between"
                                >
                                  <span>{m.name}</span>
                                  <span className="font-mono text-emerald-400">{m.handicap}</span>
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                    </div>
                    <div className="sm:col-span-3">
                      <MiniStepper
                        value={p.handicap}
                        min={-2}
                        onDec={() => updatePlayer(p.id, 'handicap', Math.max(-2, Math.round((Number(p.handicap) - 0.5) * 2) / 2))}
                        onInc={() => updatePlayer(p.id, 'handicap', Math.min(10, Math.round((Number(p.handicap) + 0.5) * 2) / 2))}
                        disabled={Number(p.handicap) >= 10}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <MiniStepper
                        value={p.chukkasWanted}
                        editable
                        onSet={(v) => setChukkasWanted(p, v)}
                        onDec={() => setChukkasWanted(p, (Number(p.chukkasWanted) || 0) - 1)}
                        onInc={() => setChukkasWanted(p, (Number(p.chukkasWanted) || 0) + 1)}
                      />
                    </div>
                    <button onClick={() => removePlayer(p.id)} className="sm:col-span-1 text-emerald-500 hover:text-rose-400 flex justify-center">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-5 mt-2 pl-1 items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-emerald-500 uppercase tracking-wide">Timing</span>
                      <Segmented value={p.timingPref} onChange={(v) => updatePlayer(p.id, 'timingPref', v)} options={TIMING_OPTIONS} />
                    </div>
                    {Number(p.handicap) <= -2 ? (
                      <span className="text-xs text-teal-400 border border-teal-800 rounded-full px-2 py-0.5">
                        Beginner — all chukkas slow, grouped together
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-emerald-500 uppercase tracking-wide">Slow</span>
                        <MiniStepper
                          value={p.slowChukkas}
                          onDec={() => adjustSlow(p, -1)}
                          onInc={() => adjustSlow(p, 1)}
                          disabled={(Number(p.slowChukkas) || 0) >= (Number(p.chukkasWanted) || 0)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={addPlayer} className="mt-3 flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300">
            <Plus size={16} /> Add player
          </button>
        </section>

        <button onClick={generate} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-emerald-950 font-medium px-5 py-2.5 rounded-md mb-6">
          <Shuffle size={18} /> Generate board
        </button>

        {warnings.length > 0 && (
          <div className="mb-8 bg-rose-950/60 border border-rose-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-rose-300 text-sm font-medium mb-2">
              <AlertTriangle size={16} /> Notes
            </div>
            <ul className="text-rose-200 text-sm space-y-1 list-disc list-inside">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {board && (
          <>
            <section className="mb-10">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-serif text-2xl text-stone-50">Final Board</h2>
                <button
                  onClick={shareBoard}
                  className="flex items-center gap-2 bg-emerald-800 hover:bg-emerald-700 text-emerald-50 text-sm px-3 py-1.5 rounded-md"
                >
                  Share Board
                </button>
              </div>
              {shareStatus && <p className="text-xs text-amber-400 mb-3">{shareStatus}</p>}
              <div ref={boardRef} className="overflow-x-auto bg-stone-50 rounded-lg border-2 border-emerald-800">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-emerald-800 text-emerald-50 text-left px-3 py-2 font-serif text-base z-10 border border-emerald-700">Player</th>
                      {board.chukkas.map((c) => (
                        <th key={c.index} className="bg-emerald-800 text-emerald-50 text-xs font-mono px-2 py-2 text-center min-w-12 border border-emerald-700">
                          C{c.index + 1}
                          <div className="text-[10px] normal-case text-emerald-300">{c.displayPace}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {board.valid.map((p, rowIdx) => (
                      <tr key={p.id} className={rowIdx % 2 === 0 ? 'bg-stone-50' : 'bg-stone-100'}>
                        <td className="sticky left-0 bg-inherit px-3 py-1.5 text-emerald-950 whitespace-nowrap border border-stone-300">
                          {p.name} {p.handicap}
                          <span className="text-stone-400 font-mono text-xs ml-1">({p.chukkasWanted})</span>
                        </td>
                        {board.chukkas.map((c) => {
                          const inBlue = c.blue.some((pp) => pp.id === p.id);
                          const inWhite = c.white.some((pp) => pp.id === p.id);
                          return (
                            <td key={c.index} className="p-1 text-center align-middle border border-stone-300">
                              {inBlue && <div className="w-8 h-6 mx-auto rounded bg-blue-800" title="Blue" />}
                              {inWhite && <div className="w-8 h-6 mx-auto rounded bg-white border border-stone-400" title="White" />}
                              {!inBlue && !inWhite && <div className="w-8 h-6 mx-auto" />}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="bg-blue-900 text-blue-50 font-mono text-xs">
                      <td className="sticky left-0 bg-blue-900 px-3 py-1.5 whitespace-nowrap border border-blue-700">
                        Handicap B
                      </td>
                      {board.chukkas.map((c) => {
                        const total = c.blue.reduce((s, p) => s + (Number(p.handicap) || 0), 0);
                        return (
                          <td key={c.index} className="text-center py-1.5 border border-blue-700">
                            {total}
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="bg-stone-200 text-stone-700 font-mono text-xs">
                      <td className="sticky left-0 bg-stone-200 px-3 py-1.5 whitespace-nowrap border border-stone-300">
                        Handicap W
                      </td>
                      {board.chukkas.map((c) => {
                        const total = c.white.reduce((s, p) => s + (Number(p.handicap) || 0), 0);
                        return (
                          <td key={c.index} className="text-center py-1.5 border border-stone-300">
                            {total}
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="bg-emerald-800 text-emerald-50 font-mono text-xs">
                      <td className="sticky left-0 bg-emerald-800 px-3 py-1.5 whitespace-nowrap border border-emerald-700">
                        Difference
                      </td>
                      {board.chukkas.map((c) => {
                        const bt = c.blue.reduce((s, p) => s + (Number(p.handicap) || 0), 0);
                        const wt = c.white.reduce((s, p) => s + (Number(p.handicap) || 0), 0);
                        return (
                          <td key={c.index} className="text-center py-1.5 border border-emerald-700">
                            {Math.abs(bt - wt)}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-blue-800 inline-block" /> Blue
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-white border border-stone-400 inline-block" /> White
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded inline-block border border-dashed border-emerald-700" /> Not playing
                </span>
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
              {board.chukkas.map((c) => {
                const blueSorted = [...c.blue].sort((a, b) => (Number(b.handicap) || 0) - (Number(a.handicap) || 0));
                const whiteSorted = [...c.white].sort((a, b) => (Number(b.handicap) || 0) - (Number(a.handicap) || 0));
                const blueTotal = c.blue.reduce((s, p) => s + (Number(p.handicap) || 0), 0);
                const whiteTotal = c.white.reduce((s, p) => s + (Number(p.handicap) || 0), 0);
                const diff = Math.abs(blueTotal - whiteTotal);
                const diffColor = diff <= 1 ? 'text-teal-600' : diff <= 3 ? 'text-amber-600' : 'text-rose-600';
                return (
                  <div key={c.index} className="bg-stone-50 text-emerald-950 rounded-lg overflow-hidden border-2 border-emerald-800">
                    <div className="flex items-center justify-between px-4 py-2 bg-emerald-800 text-emerald-50">
                      <span className="font-serif text-lg">Chukka {c.index + 1}</span>
                      <span className="text-xs uppercase tracking-wide">{c.displayPace} · {c.players.length}/{board.capacity}</span>
                    </div>
                    <div className="grid grid-cols-2 divide-x-2 divide-dashed divide-emerald-800">
                      <div className="bg-blue-900 text-blue-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-blue-300 mb-2">Blue</p>
                        <ul className="space-y-1 text-sm">
                          {blueSorted.map((p) => (
                            <li key={p.id} className="flex justify-between">
                              <span>{p.name}</span>
                              <span className="font-mono text-blue-300">{p.handicap}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs mt-2 pt-2 border-t border-blue-700 font-mono">Total {blueTotal}</p>
                      </div>
                      <div className="bg-stone-100 p-3">
                        <p className="text-xs uppercase tracking-wide text-stone-500 mb-2">White</p>
                        <ul className="space-y-1 text-sm">
                          {whiteSorted.map((p) => (
                            <li key={p.id} className="flex justify-between">
                              <span>{p.name}</span>
                              <span className="font-mono text-stone-500">{p.handicap}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs mt-2 pt-2 border-t border-stone-300 font-mono">Total {whiteTotal}</p>
                      </div>
                    </div>
                    <div className={`px-4 py-1.5 text-xs font-mono ${diffColor} bg-emerald-950/5`}>Handicap diff: {diff}</div>
                  </div>
                );
              })}
            </section>
          </>
        )}

        <footer className="text-xs text-emerald-500 border-t border-emerald-800 pt-4">
          Chukkas fill in order, so only the last one can come up short. Slow chukkas lean toward
          lower-handicap players and fast chukkas toward higher-handicap ones as a soft nudge, not
          a hard rule — 15 attempts are tried, each followed by a repair pass that swaps players
          between chukkas to fix any that can't be balanced, and the best one is kept.
        </footer>
      </div>
    </div>
  );
}
