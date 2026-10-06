import React, { useState, useEffect, useRef } from 'react';
import { Plus, Minus, Trash2, Shuffle, AlertTriangle } from 'lucide-react';
import { generateBoard, BEGINNER_PLACEMENTS, CAPACITY, TEAM_SIZE, isBeginner, isImprover } from './scheduler.js';

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

// Where the beginners' block goes is remembered separately from the roster.
const PLACEMENT_KEY = 'chukka-board-beginner-placement-v1';

function loadStoredPlacement() {
  try {
    const v = window.localStorage.getItem(PLACEMENT_KEY);
    return BEGINNER_PLACEMENTS.includes(v) ? v : 'end';
  } catch (e) {
    return 'end';
  }
}

// How many top chukkas (top players only) to plan; remembered like the placement.
const TOP_KEY = 'chukka-board-top-chukkas-v1';
const TOP_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
];

function loadStoredTop() {
  try {
    const raw = window.localStorage.getItem(TOP_KEY);
    const v = Number(raw);
    return raw !== null && TOP_OPTIONS.some((o) => o.value === v) ? v : 2;
  } catch (e) {
    return 2;
  }
}

function saveStoredTop(v) {
  try {
    window.localStorage.setItem(TOP_KEY, String(v));
  } catch (e) {
    // storage unavailable — the choice just won't persist
  }
}

function saveStoredPlacement(v) {
  try {
    window.localStorage.setItem(PLACEMENT_KEY, v);
  } catch (e) {
    // storage unavailable — the choice just won't persist
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

const PLACEMENT_OPTIONS = [
  { value: 'start', label: 'Start' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'end', label: 'End' },
];

// How each chukka's pace is shown, F/M/S like the club's hand-made boards.
const PACE_LETTER = { fast: 'F', neutral: 'M', slow: 'S' };
const PACE_NAME = { fast: 'Fast', neutral: 'Medium', slow: 'Slow' };

export default function ChukkaBoardApp() {
  const [players, setPlayers] = useState(() => loadStoredPlayers() || SAMPLE);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [placement, setPlacement] = useState(loadStoredPlacement);
  const [topChukkas, setTopChukkas] = useState(loadStoredTop);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [shareStatus, setShareStatus] = useState('');
  const boardRef = useRef(null);

  useEffect(() => {
    saveStoredPlayers(players);
  }, [players]);

  useEffect(() => {
    saveStoredPlacement(placement);
  }, [placement]);

  useEffect(() => {
    saveStoredTop(topChukkas);
  }, [topChukkas]);

  const selectSuggestion = (p, match) => {
    setPlayers((ps) => ps.map((pp) => (pp.id === p.id ? { ...pp, name: match.name, handicap: match.handicap } : pp)));
    setOpenDropdownId(null);
  };

  const updatePlayer = (id, field, value) =>
    setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  const addPlayer = () => setPlayers((ps) => [...ps, makePlayer('', 0, 3)]);
  const removePlayer = (id) => setPlayers((ps) => ps.filter((p) => p.id !== id));
  const resetBoards = () => {
    setResult(null);
    setError('');
  };
  const clearAll = () => {
    setPlayers([]);
    resetBoards();
  };
  const loadSample = () => {
    setPlayers(SAMPLE.map((p) => ({ ...p })));
    resetBoards();
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

  const validNow = players.filter((p) => p.name.trim() !== '');
  const totalRequestedNow = validNow.reduce((s, p) => s + (Number(p.chukkasWanted) || 0), 0);
  const computedChukkas = totalRequestedNow > 0 ? Math.ceil(totalRequestedNow / CAPACITY) : 0;

  function generate() {
    const generated = generateBoard(players, { beginnerPlacement: placement, topChukkas });
    if (generated.error) {
      setResult(null);
      setError(generated.error);
      return;
    }
    setError('');
    setResult(generated);
  }

  const board = result ? result.board : null;
  const warnings = error ? [error] : result ? result.warnings : [];

  async function shareBoard() {
    if (!board || !boardRef.current) return;
    setShareStatus('Preparing image…');
    try {
      // Bundled, but split into its own chunk so it only downloads the first time someone shares.
      const { default: html2canvas } = await import('html2canvas');
      // The board scrolls sideways on a phone, and html2canvas only draws what's
      // visible. Capture the full width instead, by unclipping the board in the
      // copy html2canvas renders from (the page itself doesn't change).
      const fullWidth = boardRef.current.scrollWidth;
      const canvas = await html2canvas(boardRef.current, {
        backgroundColor: '#fafaf9',
        scale: 2,
        width: fullWidth,
        windowWidth: Math.max(window.innerWidth, fullWidth),
        scrollX: 0,
        onclone: (doc) => {
          const el = doc.querySelector('[data-share-board]');
          if (el) {
            el.style.overflow = 'visible';
            el.style.width = `${fullWidth}px`;
          }
        },
      });
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
            those should be slow, and whether they need to play early or late. Everything else is
            worked out for you, including top chukkas so the day's best players get a fast game too.
          </p>
        </header>

        {/* Settings */}
        <section className="flex flex-wrap gap-6 items-end mb-6">
          <div className="text-sm text-emerald-400 pb-2">{CAPACITY} players per chukka ({TEAM_SIZE} a side)</div>
          <div className="text-sm text-amber-400 pb-2 font-mono">Chukkas needed: {computedChukkas || '—'}</div>
          <div className="flex items-center gap-2 pb-2">
            <span className="text-xs text-emerald-500 uppercase tracking-wide">Beginners</span>
            <Segmented value={placement} onChange={setPlacement} options={PLACEMENT_OPTIONS} />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <span className="text-xs text-emerald-500 uppercase tracking-wide">Top chukkas</span>
            <Segmented value={topChukkas} onChange={setTopChukkas} options={TOP_OPTIONS} />
          </div>
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
                    {isBeginner(p) ? (
                      <span className="text-xs text-teal-400 border border-teal-800 rounded-full px-2 py-0.5">
                        Beginner — mostly slow, never fast
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
                        {isImprover(p) && (
                          <span className="text-xs text-teal-400 border border-teal-800 rounded-full px-2 py-0.5">
                            -1.5 — at least half slow, never fast
                          </span>
                        )}
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
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <h2 className="font-serif text-2xl text-stone-50 mr-auto">Final Board</h2>
                <button
                  onClick={shareBoard}
                  className="flex items-center gap-2 bg-emerald-800 hover:bg-emerald-700 text-emerald-50 text-sm px-3 py-1.5 rounded-md"
                >
                  Share Board
                </button>
              </div>
              {board.plannedTop > 0 && (
                <p className="text-xs text-emerald-400 mb-3">
                  ★ {board.plannedTop === 1 ? 'Top chukka' : `${board.plannedTop} top chukkas`}: aimed at the day's top 12 players, so
                  they get a fast game too — others fill in where that suits the day better.
                </p>
              )}
              {shareStatus && <p className="text-xs text-amber-400 mb-3">{shareStatus}</p>}
              <div ref={boardRef} data-share-board className="overflow-x-auto bg-stone-50 rounded-lg border-2 border-emerald-800">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-emerald-800 text-emerald-50 text-left px-3 py-2 font-serif text-base z-10 border border-emerald-700">Player</th>
                      {board.chukkas.map((c) => (
                        <th key={c.index} className="bg-emerald-800 text-emerald-50 text-xs font-mono px-2 py-2 text-center min-w-12 border border-emerald-700">
                          <div className="text-amber-400 font-bold" title={PACE_NAME[c.displayPace]}>
                            {c.pace === 'top' && <span title="Top players' chukka">★</span>}
                            {PACE_LETTER[c.displayPace]}
                          </div>
                          {c.index + 1}
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
                      <span className="text-xs uppercase tracking-wide">{PACE_NAME[c.displayPace]} · {c.players.length}/{board.capacity}</span>
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
          Chukkas fill in order, so only the last one can come up short, and players tend to play
          back-to-back pairs. F / M / S shows how fast each chukka actually plays. -2s and -1.5s are
          kept out of fast chukkas, and a beginner's side gets one helper above 0 (anyone who asked
          for slow chukkas can join as an extra). 15 attempts are tried, each followed by a repair
          pass that swaps players between chukkas to fix any that can't be balanced, and the best
          one is kept.
        </footer>
      </div>
    </div>
  );
}
