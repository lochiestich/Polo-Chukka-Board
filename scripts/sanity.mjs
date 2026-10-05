// Runs the scheduler over the club's real rosters (scripts/rosters.mjs) in
// both modes, prints a quality table, and exits non-zero if a structural rule
// is broken. Usage: npm run sanity [-- runs]
import { isBeginner, neverFast, countsAsHelper, topGroup, CAPACITY } from '../src/scheduler.js';
import { ROSTERS } from './rosters.mjs';

const RUNS = Number(process.argv[2] || 5);
// SCHEDULER=path lets you measure another version of the scheduler (e.g. an old one) against the same rules.
const { generateBoard } = await import(process.env.SCHEDULER ? new URL(process.env.SCHEDULER, `file://${process.cwd()}/`).href : '../src/scheduler.js');
const MODES = (process.env.MODES || 'standard,fast').split(',');
const PLACEMENTS = (process.env.PLACEMENTS || 'end,start,mixed').split(',');
const h = (p) => Number(p.handicap) || 0;
const sum = (side) => side.reduce((s, p) => s + h(p), 0);
const failures = [];

function measure(name, board) {
  const m = { top8: 0, topReach: 0, gap: 0, noPos: 0, floor: 0, side: 0, tooFast: 0, timing: board.violations.length, unmet: board.unmet, fast: 0, pairs: 0, slots: 0, begBlock: 0, begRun: 0, begPos: 0, begSlots: 0, shirts: 0 };
  const last = Math.max(1, board.chukkas.length - 1);
  // The day's top group (top 12 by handicap, ties included, never -1.5s or
  // -2s): how many full chukkas are all top group, and how many of the group
  // got at least one.
  const top10 = topGroup(board.valid);
  const reached = new Set();
  board.chukkas.forEach((c) => {
    const inTop = c.players.filter((p) => top10.has(p.id));
    if (inTop.length >= 8) {
      m.top8++;
      inTop.forEach((p) => reached.add(p.id));
    }
  });
  m.topReach = reached.size;
  board.chukkas.forEach((c, i) => {
    // structural invariants
    const ids = c.players.map((p) => p.id);
    if (new Set(ids).size !== ids.length) failures.push(`${name}: duplicate player in chukka ${i + 1}`);
    if (c.players.length > CAPACITY) failures.push(`${name}: chukka ${i + 1} over capacity`);
    if (i < board.chukkas.length - 1 && c.players.length < CAPACITY) failures.push(`${name}: chukka ${i + 1} short but isn't the last`);
    if (c.blue.length + c.white.length !== c.players.length) failures.push(`${name}: chukka ${i + 1} split lost players`);

    const hasB = c.players.some(isBeginner);
    m.gap += Math.max(0, Math.abs(sum(c.blue) - sum(c.white)) - (hasB ? 3 : 2));
    [c.blue, c.white].forEach((side) => {
      if (c.players.length >= 4 && !side.some((p) => h(p) > 0)) m.noPos++;
      m.floor += Math.max(0, -5.5 - sum(side));
      if (!side.some(isBeginner)) return;
      const t = sum(side);
      m.side += Math.max(0, t - 2.5) + Math.max(0, side.filter(countsAsHelper).length - 1);
    });
    if (c.displayPace === 'fast') {
      m.fast++;
      m.tooFast += c.players.filter(neverFast).length;
    }
    c.players.forEach((p) => {
      m.slots++;
      const prev = board.chukkas[i - 1]?.players.some((pp) => pp.id === p.id);
      const next = board.chukkas[i + 1]?.players.some((pp) => pp.id === p.id);
      if (prev || next) m.pairs++;
      if (isBeginner(p)) {
        m.begSlots++;
        if (c.players.filter(isBeginner).length >= 3) m.begBlock++;
        if (prev || next) m.begRun++;
        m.begPos += i / last;
      }
    });
  });
  board.valid.forEach((p) => {
    if (board.assigned[p.id] > Number(p.chukkasWanted)) failures.push(`${name}: ${p.name} given more chukkas than asked`);
  });
  m.shirts = board.totalChanges;
  return m;
}

const cols = ['top8', 'reach', 'unmet', 'gap', 'noPos', 'floor', 'side', 'tooFast', 'timing', 'fast', 'pairs%', 'block%', 'begRun%', 'begPos', 'shirts', 'ms'];
console.log('roster'.padEnd(24) + 'mode'.padEnd(9) + 'beg'.padEnd(7) + cols.map((c) => c.padStart(8)).join(''));
for (const [rname, roster] of Object.entries(ROSTERS)) {
  for (const placement of PLACEMENTS) for (const mode of MODES) {
    const tot = { top8: 0, topReach: 0, unmet: 0, gap: 0, noPos: 0, floor: 0, side: 0, tooFast: 0, timing: 0, fast: 0, pairs: 0, slots: 0, begBlock: 0, begRun: 0, begPos: 0, begSlots: 0, shirts: 0, ms: 0 };
    for (let r = 0; r < RUNS; r++) {
      const t0 = performance.now();
      const { board, error } = generateBoard(roster, mode, { beginnerPlacement: placement, topChukkas: Number(process.env.TOP ?? 2) });
      tot.ms += performance.now() - t0;
      if (error) { failures.push(`${rname}: ${error}`); continue; }
      const m = measure(`${rname} [${mode}/${placement}]`, board);
      for (const k of Object.keys(m)) tot[k] += m[k];
    }
    const avg = (k) => (tot[k] / RUNS).toFixed(1);
    const row = [avg('top8'), avg('topReach'), avg('unmet'), avg('gap'), avg('noPos'), avg('floor'), avg('side'), avg('tooFast'), avg('timing'), avg('fast'),
      ((100 * tot.pairs) / tot.slots).toFixed(0),
      tot.begSlots ? ((100 * tot.begBlock) / tot.begSlots).toFixed(0) : '-',
      tot.begSlots ? ((100 * tot.begRun) / tot.begSlots).toFixed(0) : '-',
      tot.begSlots ? (tot.begPos / tot.begSlots).toFixed(2) : '-',
      avg('shirts'), avg('ms')];
    console.log(rname.padEnd(24) + mode.padEnd(9) + placement.padEnd(7) + row.map((c) => String(c).padStart(8)).join(''));
  }
}
console.log('\nPer-board averages over', RUNS, 'runs. top8 = chukkas of 8 top-group (top 12) players; reach = how many of the top group got one; noPos = sides with nobody above 0; floor = goals below -5.5 a side; gap/side = rule excess; tooFast = -1.5/-2 slots in fast chukkas;');
console.log('timing = early/late misses; fast = fast chukkas; pairs% = slots played back-to-back;\nblock% = beginner slots in a chukka with 3+ beginners (club boards: ~85%); begRun% = beginner slots next to another of their own;\nbegPos = where beginners play, 0 = start of day, 1 = end.');
if (failures.length) {
  console.error('\nFAILED:\n' + [...new Set(failures)].join('\n'));
  process.exit(1);
}
console.log('\nAll structural checks passed.');
