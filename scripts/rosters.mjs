// Real rosters from the club's hand-made boards (handicap, chukkas wanted),
// plus adversarial variants. Used by scripts/sanity.mjs.
let id = 1;
const P = (name, handicap, chukkasWanted, timingPref = 'none', slowChukkas = 0) => ({
  id: id++,
  name,
  handicap,
  chukkasWanted,
  timingPref,
  slowChukkas,
});
const roster = (rows) => rows.map(([n, h, c, t, s]) => P(n, h, c, t, s));

export const ROSTERS = {
  'Sat 12 noon': roster([
    ['Izzy', 3, 6], ['Rich', 2, 3], ['Megan', 1.5, 7], ['Jeremy', 0.5, 4], ['Nix', 0.5, 4], ['Phyllpa', 0.5, 6],
    ['Pete', 0, 2], ['Beezie', -0.5, 3], ['Milly', -1, 3], ['Michael', -1, 4], ['Jack', 1, 2], ['Alex', -0.5, 3],
    ['Charlie', -2, 5], ['Angus', -2, 3], ['Zacko', -2, 4], ['Anne', -2, 1], ['Davis', -2, 2], ['Sarah', -2, 1], ['Sam', 0, 1],
  ]),
  'Sun 10am': roster([
    ['Megan', 1.5, 6], ['Jack', 1, 3], ['Nix', 0.5, 4], ['Phyllpa', 0.5, 5], ['Pete', 0, 3], ['Beezie', -0.5, 3],
    ['Emily', -0.5, 4], ['Alex', -0.5, 2], ['Michael', -1, 4], ['Angus', -2, 3], ['Zacko', -2, 4], ['Davis', -2, 4], ['Katie', -2, 3],
  ]),
  'Sat 2.00': roster([
    ['Archie', 4, 6], ['Izzy', 3, 8], ['Will M', 2.5, 7], ['Rich SW', 2, 5], ['Lochie S', 1, 6], ['Tom S-W', 1, 4],
    ['Nikki', 0.5, 4], ['Phyps', 0.5, 5], ['Pete G', 0, 5], ['Ro Stich', -0.5, 6], ['Isaac M', 0, 7], ['Daisy O', -0.5, 5],
    ['Ben Y', -0.5, 2], ['Alex T', -0.5, 4], ['Dr Mike', -1, 4], ['David Millar', 0, 6], ['Davis B', -2, 1], ['Zako', -2, 4],
    ['Anton', -2, 3], ['Charlie S', -2, 4], ['Millie S', -1, 4], ['Jamesy', -2, 2],
  ]),
  'Sun 10.30': roster([
    ['Izzy', 3, 9], ['Will M', 2.5, 7], ['Rich SW', 2, 6], ['Lochie S', 1, 7], ['Tom S-W', 1, 5], ['Nikki', 0.5, 5],
    ['Phyps', 0.5, 5], ['Pete G', 0, 5], ['Ro Stich', -0.5, 6], ['Isaac M', 0, 8], ['Daisy O', -0.5, 4], ['Ben Y', -0.5, 2],
    ['Alex T', -0.5, 3], ['David Millar', 0, 6], ['Davis B', -2, 1], ['Zako', -2, 4], ['Anton', -2, 3], ['Charlie S', -2, 4],
    ['Oscar O', -2, 2], ['Millie S', -1, 4],
  ]),
  'Sat 1PM': roster([
    ['Izzy V', 3, 8], ['Ben SW', 2, 6], ['Rich SW', 2, 2], ['Cheza', 1, 6], ['Stich', 1, 3], ['Lochie', 1, 8],
    ['Phyps', 0.5, 5], ['Nikki', 0.5, 5], ['Jeremy P', 0.5, 4], ['Pete G', 0, 4], ['Sarah G', -0.5, 2], ['Isaac M', 0, 8],
    ['Tom M', -0.5, 4], ['Beezie', -0.5, 3], ['Daisy', -0.5, 3], ['Ro S', -0.5, 6], ['Dr Mike', -1, 4], ['Charlotte Mason', -1, 3],
    ['Sam T', -1.5, 5], ['Anton', -2, 2], ['Zako', -2, 4], ['Charlie S', -2, 4], ['Oscar Outram', -2, 3], ['Davis B', -2, 3],
    ['Eli', -2, 2], ['Ato', -1, 4], ['Jamesy', -2, 2],
  ]),
};

const variant = (base, f) => base.map((p) => ({ ...p, ...f(p) }));
// Timing stress: a mix of early and late across every level, including beginners.
ROSTERS['Sat 2.00 + timing'] = variant(ROSTERS['Sat 2.00'], (p) =>
  ['Archie', 'Pete G', 'Anton', 'Dr Mike'].includes(p.name) ? { timingPref: 'early' }
  : ['Izzy', 'Zako', 'Charlie S', 'Ro Stich', 'Daisy O'].includes(p.name) ? { timingPref: 'late' } : {}
);
// Slow requests from helpers, so they can join beginner chukkas as a second helper.
ROSTERS['Sun 10.30 + slow'] = variant(ROSTERS['Sun 10.30'], (p) =>
  ['Lochie S', 'Tom S-W', 'Nikki'].includes(p.name) ? { slowChukkas: 2 } : {}
);
// Adversarial: every beginner wants late.
ROSTERS['Sat 1PM beginners late'] = variant(ROSTERS['Sat 1PM'], (p) => (p.handicap <= -2 ? { timingPref: 'late' } : {}));
