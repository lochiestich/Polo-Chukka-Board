// Runs the scheduler over the club's real rosters (scripts/rosters.mjs) in
// both modes, prints a quality table, and exits non-zero if a structural rule
// is broken. Usage: npm run sanity [-- runs]
import { isBeginner, neverFast, countsAsHelper, CAPACITY } from '../src/scheduler.js';
import { ROSTERS } from './rosters.mjs';

const RUNS = Number(process.argv[2] || 5);
// SCHEDULER=path lets you measure another version of the scheduler (e.g. an old one) against the same rules.
const { generateBoard } = await import(process.env.SCHEDULER ? new URL(process.env.SCHEDULER, `file://${process.cwd()}/`).href : '../src/scheduler.js');
const MODES = (process.env.MODES || 'standard,fast').split(',');
const h = (p) => Number(p.handicap) || 0;
const sum = (side) => side.reduce((s, p) => s + h(p), 0);
const failures = [];

function measure(name, board) {
  const m = { gap: 0, side: 0, tooFast: 0, timing: board.violations.length, unmet: board.unmet, fast: 0, pairs: 0, slots: 0, begMedium: 0, begSlots: 0, shirts: 0 };
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
      if (!side.some(isBeginner)) return;
      const t = sum(side);
      m.side += Math.max(0, t - 2.5) + Math.max(0, -6 - t) + Math.max(0, side.filter(countsAsHelper).length - 1);
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
        if (c.players.filter(isBeginner).length <= 2) m.begMedium++;
      }
    });
  });
  board.valid.forEach((p) => {
    if (board.assigned[p.id] > Number(p.chukkasWanted)) failures.push(`${name}: ${p.name} given more chukkas than asked`);
  });
  m.shirts = board.totalChanges;
  return m;
}

const cols = ['unmet', 'gap', 'side', 'tooFast', 'timing', 'fast', 'pairs%', 'begMix%', 'shirts', 'ms'];
console.log('roster'.padEnd(26) + 'mode'.padEnd(9) + cols.map((c) => c.padStart(8)).join(''));
for (const [rname, roster] of Object.entries(ROSTERS)) {
  for (const mode of MODES) {
    const tot = { unmet: 0, gap: 0, side: 0, tooFast: 0, timing: 0, fast: 0, pairs: 0, slots: 0, begMedium: 0, begSlots: 0, shirts: 0, ms: 0 };
    for (let r = 0; r < RUNS; r++) {
      const t0 = performance.now();
      const { board, error } = generateBoard(roster, mode);
      tot.ms += performance.now() - t0;
      if (error) { failures.push(`${rname}: ${error}`); continue; }
      const m = measure(`${rname} [${mode}]`, board);
      for (const k of Object.keys(m)) tot[k] += m[k];
    }
    const avg = (k) => (tot[k] / RUNS).toFixed(1);
    const row = [avg('unmet'), avg('gap'), avg('side'), avg('tooFast'), avg('timing'), avg('fast'),
      ((100 * tot.pairs) / tot.slots).toFixed(0), tot.begSlots ? ((100 * tot.begMedium) / tot.begSlots).toFixed(0) : '-',
      avg('shirts'), avg('ms')];
    console.log(rname.padEnd(26) + mode.padEnd(9) + row.map((c) => String(c).padStart(8)).join(''));
  }
}
console.log('\nPer-board averages over', RUNS, 'runs. gap/side = rule excess; tooFast = -1.5/-2 slots in fast chukkas;');
console.log('timing = early/late misses; fast = fast chukkas; pairs% = slots played back-to-back; begMix% = beginner slots in mixed chukkas (two or fewer beginners).');
if (failures.length) {
  console.error('\nFAILED:\n' + [...new Set(failures)].join('\n'));
  process.exit(1);
}
console.log('\nAll structural checks passed.');
