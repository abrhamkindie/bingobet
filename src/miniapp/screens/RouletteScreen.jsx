import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Coins, Trophy, RefreshCw, RotateCcw, Clock,
} from 'lucide-react';
import * as api from '../api.js';
import { PlayerContext, ToastContext } from '../App.jsx';
import { useResource } from '../hooks/useResource.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { playSpinStart, playTick, playRattle, playWin, playLose } from '../hooks/useSound.js';
import { errorMessage, fmtETB } from '../i18n.js';
import ScreenShell from '../components/ui/ScreenShell.jsx';
import Button from '../components/ui/Button.jsx';
import StakeControl from '../components/StakeControl.jsx';
import { Spinner, ErrorState } from '../components/ui/states.jsx';

// ── Constants ──────────────────────────────────────────

const SPIN_MS = 3500;

/** Roulette wheel number order (standard European sequence). */
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

function getNumberColor(n) {
  if (n === 0) return '#22c55e';
  return [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n) ? '#ef4444' : '#1e1e1e';
}

// ── Bet type metadata (matches backend) ─────────────────

const BET_DEFS = {
  // Even money (1:1)
  even:   { label: 'Even',   group: 'Even Money', payout: '1:1', color: '#0d9488' },
  odd:    { label: 'Odd',    group: 'Even Money', payout: '1:1', color: '#0d9488' },
  high:   { label: '19–36',  group: 'Even Money', payout: '1:1', color: '#0d9488' },
  low:    { label: '1–18',   group: 'Even Money', payout: '1:1', color: '#0d9488' },
  red:    { label: 'Red',    group: 'Even Money', payout: '1:1', color: '#ef4444' },
  black:  { label: 'Black',  group: 'Even Money', payout: '1:1', color: '#1e1e1e' },
  // Columns (2:1)
  col1:   { label: 'Col 1',  group: 'Columns', payout: '2:1', color: '#f59e0b', desc: '1·4·7·10·13·16·19·22·25·28·31·34' },
  col2:   { label: 'Col 2',  group: 'Columns', payout: '2:1', color: '#f59e0b', desc: '2·5·8·11·14·17·20·23·26·29·32·35' },
  col3:   { label: 'Col 3',  group: 'Columns', payout: '2:1', color: '#f59e0b', desc: '3·6·9·12·15·18·21·24·27·30·33·36' },
  // Dozens (2:1)
  dozen1: { label: '1st 1–12', group: 'Dozens', payout: '2:1', color: '#3b82f6' },
  dozen2: { label: '2nd 13–24', group: 'Dozens', payout: '2:1', color: '#3b82f6' },
  dozen3: { label: '3rd 25–36', group: 'Dozens', payout: '2:1', color: '#3b82f6' },
  // ABCDEF sectors (5:1)
  sectorA: { label: 'A', group: 'Sectors', payout: '5:1', color: '#ef4444', desc: '1–6' },
  sectorB: { label: 'B', group: 'Sectors', payout: '5:1', color: '#f59e0b', desc: '7–12' },
  sectorC: { label: 'C', group: 'Sectors', payout: '5:1', color: '#22c55e', desc: '13–18' },
  sectorD: { label: 'D', group: 'Sectors', payout: '5:1', color: '#3b82f6', desc: '19–24' },
  sectorE: { label: 'E', group: 'Sectors', payout: '5:1', color: '#8b5cf6', desc: '25–30' },
  sectorF: { label: 'F', group: 'Sectors', payout: '5:1', color: '#ec4899', desc: '31–36' },
  // Tweens (11:1)
  tweens: { label: 'Tweens', group: 'Tweens', payout: '11:1', color: '#a855f7', desc: '11·22·33' },
};

// Straight-up number bets (35:1) — generated for 0–36
for (let i = 0; i <= 36; i++) {
  BET_DEFS[`n${i}`] = {
    label: `${i}`,
    group: 'Straight Up',
    payout: '35:1',
    color: getNumberColor(i),
    isNumber: true,
    number: i,
  };
}

const GROUP_ORDER = ['Straight Up', 'Even Money', 'Columns', 'Dozens', 'Sectors', 'Tweens'];

// ── Component ──────────────────────────────────────────

export default function RouletteScreen({ onBack }) {
  const { player, patchPlayer, reload } = useContext(PlayerContext);
  const { addToast } = useContext(ToastContext);
  const { haptic } = useTelegram();
  const { data: cfg, loading, error, reload: reloadCfg } = useResource(api.getInstantConfig, []);
  const { data: histData } = useResource(() => api.getInstantHistory('roulette'), []);

  const [selectedBets, setSelectedBets] = useState([]);
  const [stake, setStake] = useState(10);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState(null);
  const [rotation, setRotation] = useState(0);
  const rotRef = useRef(0);
  const timerRef = useRef([]);
  const lastBetsRef = useRef(null);
  const lastStakeRef = useRef(null);

  const balance = Number(player?.wallet_balance || 0);
  const totalStake = stake * selectedBets.length;

  // ── Toggle a bet ──
  const toggleBet = (key) => {
    if (playing) return;
    setResult(null);
    setSelectedBets((prev) => {
      if (prev.includes(key)) {
        haptic('light');
        return prev.filter((k) => k !== key);
      }
      haptic('select');
      return [...prev, key];
    });
  };

  // ── Clear all bets ──
  const clearBets = () => {
    if (playing) return;
    setSelectedBets([]);
    setResult(null);
    haptic('light');
  };

  // ── Quick pick (random selection) ──
  const quickPick = () => {
    if (playing) return;
    setResult(null);
    const keys = Object.keys(BET_DEFS);
    const count = 2 + Math.floor(Math.random() * 3); // 2–4 random bets
    const shuffled = [...keys].sort(() => Math.random() - 0.5);
    setSelectedBets(shuffled.slice(0, count));
    haptic('light');
  };

  // ── Spin! ──
  const spin = async () => {
    if (playing) return;
    if (selectedBets.length === 0) {
      addToast('Select at least one bet on the board', 'warning');
      return;
    }
    if (totalStake > balance) {
      addToast(errorMessage({ code: 'INSUFFICIENT_BALANCE' }), 'error');
      return;
    }
    setPlaying(true);
    setResult(null);
    haptic('medium');
    playSpinStart();

    try {
      const res = await api.playRoulette(selectedBets, stake);

      // Spin the wheel to land on the winning number
      const winIdx = WHEEL_ORDER.indexOf(res.number);
      const segAngle = 360 / WHEEL_ORDER.length;
      const jitter = (Math.random() - 0.5) * segAngle * 0.4;
      const target = 360 - (winIdx + 0.5) * segAngle + jitter;
      const base = rotRef.current;
      const next = base - (base % 360) + 360 * 5 + target;
      rotRef.current = next;
      setRotation(next);

      // ── Spin sound pattern ──
      // Simulate the ball bouncing around the wheel: ticks that slow down
      // over the SPIN_MS duration, ending in a final rattle before the result.
      const ids = [];
      for (let t = 100; t < SPIN_MS - 300; t += 200) {
        ids.push(setTimeout(() => playTick(), t));
      }
      for (let t = 60; t < 400; t += 100) {
        ids.push(setTimeout(() => playRattle(), t));
      }
      // Final rattle just before landing — inner IDs tracked via closure
      ids.push(setTimeout(() => {
        for (let i = 0; i < 3; i++) {
          ids.push(setTimeout(() => playRattle(), i * 60));
        }
        timerRef.current = [...timerRef.current, ...ids.slice(-3)];
      }, SPIN_MS - 400));

      // Result timeout
      const resultId = setTimeout(() => {
        // Clear any remaining tickers
        timerRef.current.forEach(clearTimeout);
        timerRef.current = [];

        // Save last bet config for rebet
        lastBetsRef.current = [...selectedBets];
        lastStakeRef.current = stake;

        setResult(res);
        patchPlayer({ wallet_balance: res.balance });
        reload();

        if (res.win) {
          haptic('success');
          playWin();
          const wonBets = res.results.filter((b) => b.won);
          addToast(`Number ${res.number} ${res.numberColor} — ${wonBets.length} bet${wonBets.length > 1 ? 's' : ''} won ${fmtETB(res.totalPayout)} ETB!`, 'success');
        } else {
          haptic('warning');
          playLose();
          addToast(`Number ${res.number} ${res.numberColor} — no winning bets`, 'info');
        }
        setPlaying(false);
      }, SPIN_MS);

      timerRef.current = [...ids, resultId];
    } catch (err) {
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
      addToast(errorMessage(err), 'error');
      setPlaying(false);
    }
  };

  // ── Rebet ──
  const rebet = () => {
    if (!lastBetsRef.current) return;
    setSelectedBets(lastBetsRef.current);
    setStake(lastStakeRef.current);
    setResult(null);
    haptic('light');
    addToast(`Rebet placed: ${lastBetsRef.current.length} bet${lastBetsRef.current.length > 1 ? 's' : ''} at ${fmtETB(lastStakeRef.current)} ETB each`, 'info');
  };

  // ── Wheel conic gradient ──
  const wheelBg = useMemo(() => {
    const segAngle = 360 / WHEEL_ORDER.length;
    const stops = WHEEL_ORDER.map((n, i) => {
      const color = getNumberColor(n);
      return `${color} ${i * segAngle}deg ${(i + 1) * segAngle}deg`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  }, []);

  // ── Balance chip ──
  const balanceChip = (
    <span className="inline-flex items-center gap-1 rounded-xl border border-coin-400/20 bg-coin-500/10 px-2.5 py-1.5 text-xs font-black text-white">
      <span className="text-coin-300">₿</span> {fmtETB(balance)}
    </span>
  );

  // ── Group bets for the board ──
  const groupedBets = useMemo(() => {
    const groups = {};
    for (const key of Object.keys(BET_DEFS)) {
      const def = BET_DEFS[key];
      if (!groups[def.group]) groups[def.group] = [];
      groups[def.group].push({ key, ...def });
    }
    return GROUP_ORDER.map((g) => ({ group: g, bets: groups[g] || [] }));
  }, []);

  // ── Win/loss per bet after spin ──
  const resultMap = useMemo(() => {
    if (!result) return {};
    const m = {};
    for (const r of result.results) m[r.key] = r;
    return m;
  }, [result]);

  // ── Cleanup timers on unmount ──
  useEffect(() => {
    return () => {
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
    };
  }, []);

  // ── Loading / Error ──
  if (loading) return <ScreenShell title="Roulette" onBack={onBack}><Spinner label="Loading…" /></ScreenShell>;
  if (error) return <ScreenShell title="Roulette" onBack={onBack}><ErrorState error={error} onRetry={reloadCfg} /></ScreenShell>;

  return (
    <ScreenShell title="Roulette" onBack={onBack} right={balanceChip}>
      {/* ── Wheel ── */}
      <div className="relative mx-auto grid place-items-center" style={{ width: 280, height: 280 }}>
        {/* Pointer */}
        <div className="absolute -top-1 z-20 h-0 w-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-coin-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
        {/* Glow */}
        <div className="glow-ring absolute inset-0 rounded-full" />
        {/* Rotating wheel */}
        <div
          className="relative rounded-full border-4 border-white/10"
          style={{
            width: 252,
            height: 252,
            background: wheelBg,
            transform: `rotate(${rotation}deg)`,
            transition: playing ? `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.9, 0.2, 1)` : 'none',
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.4)',
          }}
        >
          {WHEEL_ORDER.map((n, i) => {
            const angle = (i + 0.5) * (360 / WHEEL_ORDER.length);
            return (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 h-0 w-0"
                style={{ transform: `rotate(${angle}deg)` }}
              >
                <span
                  className={`absolute block whitespace-nowrap text-[10px] font-black ${
                    n === 0 ? 'text-white' : getNumberColor(n) === '#ef4444' ? 'text-red-200' : 'text-white/80'
                  } drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]`}
                  style={{ transform: `translate(-50%, -96px) rotate(${-angle}deg)` }}
                >
                  {n}
                </span>
              </div>
            );
          })}
        </div>
        {/* Hub */}
        <div className="coin-disc absolute grid h-12 w-12 place-items-center rounded-full text-base font-black text-amber-900/80">₿</div>
      </div>

      {/* ── Result banner ── */}
      {result && (
        <div className="mx-auto mt-3 w-full max-w-sm animate-bounce-in">
          <div className={`rounded-2xl border px-4 py-3 text-center ${
            result.win
              ? 'border-emerald-400/30 bg-emerald-500/10'
              : 'border-rose-400/25 bg-rose-500/10'
          }`}>
            <p className="flex items-center justify-center gap-2">
              <span
                className="grid h-10 w-10 place-items-center rounded-full text-lg font-black text-white"
                style={{ background: getNumberColor(result.number) }}
              >
                {result.number}
              </span>
              <span className={`text-lg font-black ${result.win ? 'text-emerald-300' : 'text-rose-300'}`}>
                {result.number} {result.numberColor}
              </span>
            </p>
            {result.win ? (
              <p className="mt-1 text-sm text-emerald-200/80">
                <Trophy size={14} className="inline -mt-0.5 mr-1" />
                +{fmtETB(result.totalPayout)} ETB won ·{' '}
                {result.results.filter((b) => b.won).length} hit{result.results.filter((b) => b.won).length > 1 ? 's' : ''}
                {result.netResult > 0 && (
                  <span className="text-emerald-300 font-bold ml-1">(net +{fmtETB(result.netResult)})</span>
                )}
                {result.netResult === 0 && result.win && (
                  <span className="text-slate-400 ml-1">(stake back)</span>
                )}
              </p>
            ) : (
              <p className="mt-1 text-sm text-rose-200/80">No winning bets — stake lost</p>
            )}
            {/* ── Rebet button ── */}
            {lastBetsRef.current && (
              <button
                onClick={rebet}
                className="mt-2 w-full rounded-xl border border-teal-400/30 bg-teal-500/10 py-2 text-xs font-black tracking-wide text-teal-200 transition hover:bg-teal-500/20 hover:border-teal-400/50 active:scale-[0.98]"
              >
                <RefreshCw size={13} className="inline mr-1.5 -mt-0.5" />
                Rebet — {lastBetsRef.current.length} bet{lastBetsRef.current.length > 1 ? 's' : ''} at {fmtETB(lastStakeRef.current)} ETB each
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── The Spine (betting board) ── */}
      <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {/* Board header */}
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
          <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-400">
            <span>🎲</span> The Spine — Place your bets
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={quickPick}
              disabled={playing}
              className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-400 hover:border-teal-400/30 hover:text-teal-300 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={11} className="inline mr-1" />
              Quick
            </button>
            <button
              onClick={clearBets}
              disabled={playing || selectedBets.length === 0}
              className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-400 hover:border-rose-400/30 hover:text-rose-300 active:scale-95 disabled:opacity-50"
            >
              <RotateCcw size={11} className="inline mr-1" />
              Clear
            </button>
          </div>
        </div>

        {/* Selected bets count */}
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-[10px] text-slate-500">
            {selectedBets.length} bet{selectedBets.length !== 1 ? 's' : ''} selected ·{' '}
            <span className="text-coin-300 font-bold">{fmtETB(stake)} ETB</span> each
          </span>
          {selectedBets.length > 0 && (
            <span className="text-[10px] font-bold text-slate-400">
              Total: <span className="text-white">{fmtETB(totalStake)} ETB</span>
            </span>
          )}
        </div>

        {/* Board groups */}
        <div className="px-3 pb-4 space-y-3">
          {groupedBets.map(({ group, bets }) => (
            <div key={group}>
              <p className="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-500 px-1">
                {group}
                <span className="text-[9px] text-slate-600 font-normal normal-case tracking-normal">
                  {bets[0]?.payout ? `· ${bets[0].payout}` : ''}
                </span>
              </p>
              {group === 'Straight Up' ? (
                <NumberGrid
                  bets={bets}
                  selectedBets={selectedBets}
                  resultMap={resultMap}
                  playing={playing}
                  result={result}
                  onToggle={toggleBet}
                />
              ) : (
                <div className={`grid gap-1.5 ${
                  group === 'Even Money' ? 'grid-cols-3' :
                  group === 'Columns' ? 'grid-cols-3' :
                  group === 'Dozens' ? 'grid-cols-3' :
                  group === 'Sectors' ? 'grid-cols-6' :
                  group === 'Tweens' ? 'grid-cols-1' : 'grid-cols-3'
                }`}>
                  {bets.map((bet) => {
                    const selected = selectedBets.includes(bet.key);
                    const resInfo = resultMap[bet.key];
                    const hasResult = resInfo !== undefined;
                    const won = resInfo?.won;

                    let stateClass = 'border-white/10 bg-white/[0.04] text-slate-300';
                    if (hasResult) {
                      if (won) stateClass = 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30';
                      else stateClass = 'border-rose-400/15 bg-rose-500/8 text-rose-300/50';
                    } else if (selected) {
                      stateClass = 'border-teal-400/50 bg-teal-500/15 text-teal-200 ring-1 ring-teal-400/30 shadow-teal-sm';
                    }

                    return (
                      <button
                        key={bet.key}
                        onClick={() => toggleBet(bet.key)}
                        disabled={playing}
                        className={`relative rounded-xl border px-2 py-2.5 text-center transition active:scale-95 disabled:opacity-50 ${stateClass}`}
                      >
                        {/* Color dot for red/black/sectors */}
                        {(bet.key === 'red' || bet.key === 'black' || bet.group === 'Sectors') && (
                          <span
                            className="mx-auto mb-1 block h-3 w-3 rounded-full"
                            style={{ background: bet.color }}
                          />
                        )}
                        <span className="block text-xs font-black leading-tight">{bet.label}</span>
                        {bet.desc && (
                          <span className="block text-[8px] text-slate-500 mt-0.5 leading-tight">{bet.desc}</span>
                        )}
                        {!result && selected && (
                          <span className="absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-teal-400 text-[9px] font-black text-teal-950">
                            {selectedBets.indexOf(bet.key) + 1}
                          </span>
                        )}
                        {result && won && (
                          <span className="absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-emerald-400 text-[8px] font-black text-emerald-950 animate-number-pop">
                            ₿
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Stake + Spin ── */}
      <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
        <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">
          Stake per bet
          {selectedBets.length > 0 && (
            <span className="ml-2 text-[10px] font-normal normal-case text-slate-500">
              · {selectedBets.length} bet{selectedBets.length !== 1 ? 's' : ''} × {fmtETB(stake)} = {fmtETB(totalStake)} total
            </span>
          )}
        </p>
        <StakeControl value={stake} onChange={setStake} min={cfg.minStake} max={cfg.maxStake} balance={balance} disabled={playing} />
        <Button
          block
          size="lg"
          className="mt-4"
          loading={playing}
          disabled={selectedBets.length === 0}
          onClick={spin}
        >
          <Coins size={18} />
          {playing
            ? 'Spinning…'
            : `Spin — ${fmtETB(totalStake)} ETB (${selectedBets.length} bet${selectedBets.length !== 1 ? 's' : ''})`
          }
        </Button>
        {selectedBets.length === 0 && !result && (
          <p className="mt-1.5 text-center text-[10px] text-slate-500">Tap bets on the board above to place them</p>
        )}
      </div>

      {/* ── Legend ── */}
      <details className="mt-4 group">
        <summary className="flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-bold tracking-wide text-slate-400 transition hover:border-white/20 hover:text-slate-300">
          How bets work
        </summary>
        <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-2 text-[11px] text-slate-400 leading-relaxed">
          <p><span className="font-bold text-slate-300">Even Money (1:1)</span> — Even/Odd · 1–18/19–36 · Red/Black. Win = get stake back + equal profit. Green 0 loses all.</p>
          <p><span className="font-bold text-slate-300">Columns (2:1)</span> — 12 numbers in each column. Every 3rd number starting from 1 (Col 1), 2 (Col 2), or 3 (Col 3).</p>
          <p><span className="font-bold text-slate-300">Dozens (2:1)</span> — 1st (1–12), 2nd (13–24), 3rd (25–36).</p>
          <p><span className="font-bold text-slate-300">Sectors A–F (5:1)</span> — Colour collaboration. 6 groups of 6 consecutive numbers, each with its own colour.</p>
          <p><span className="font-bold text-slate-300">Tweens (11:1)</span> — The three doubled numbers: 11, 22, and 33.</p>
          <p><span className="font-bold text-slate-300">Straight Up (35:1)</span> — Bet on a single number. Pick from the number grid at the top of the board.</p>
        </div>
      </details>

      {/* ── History ── */}
      <RouletteHistory history={histData?.bets} />
    </ScreenShell>
  );
}

// ── Number Grid (straight-up bets) ──────────────────────

/**
 * Standard European roulette number layout:
 *   0  at top (spanning full width)
 *   1–36 in 3 columns × 12 rows, colour-coded red/black
 *   Each cell is tappable to place/remove a straight-up bet.
 */
function NumberGrid({ bets, selectedBets, resultMap, playing, result, onToggle }) {
  // Separate 0 from 1–36
  const zeroBet = bets.find((b) => b.key === 'n0');
  const numberBets = bets.filter((b) => b.key !== 'n0');

  return (
    <div className="space-y-1">
      {/* Zero — full-width */}
      {zeroBet && (
        <NumberCell
          bet={zeroBet}
          selected={selectedBets.includes(zeroBet.key)}
          resInfo={resultMap[zeroBet.key]}
          playing={playing}
          result={result}
          selectedBets={selectedBets}
          onToggle={onToggle}
          isZero
        />
      )}

      {/* Numbers 1–36 in 3 columns */}
      <div className="grid grid-cols-3 gap-1">
        {numberBets.map((bet) => (
          <NumberCell
            key={bet.key}
            bet={bet}
            selected={selectedBets.includes(bet.key)}
            resInfo={resultMap[bet.key]}
            playing={playing}
            result={result}
            selectedBets={selectedBets}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

// ── History ──────────────────────────────────────────────

function RouletteHistory({ history }) {
  const bets = history || [];

  const stats = useMemo(() => {
    if (bets.length === 0) return null;
    let wins = 0, totalStake = 0, totalPayout = 0, biggestWin = 0;
    for (const b of bets) {
      const s = Number(b.stake);
      const p = Number(b.payout);
      totalStake += s;
      totalPayout += p;
      if (p > 0) wins++;
      if (p > biggestWin) biggestWin = p;
    }
    const netResult = totalPayout - totalStake;
    return {
      total: bets.length,
      wins,
      losses: bets.length - wins,
      winRate: bets.length > 0 ? Math.round((wins / bets.length) * 100) : 0,
      totalStake,
      totalPayout,
      netResult,
      biggestWin,
    };
  }, [bets]);

  return (
    <details className="mt-4 group">
      <summary className="flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-bold tracking-wide text-slate-400 transition hover:border-white/20 hover:text-slate-300">
        <Clock size={14} />
        History
        {stats && (
          <span className="ml-auto text-[10px] font-normal text-slate-500">{stats.total} spin{stats.total > 1 ? 's' : ''}</span>
        )}
      </summary>

      {/* ── Stats summary ── */}
      {stats && (
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          <StatTile
            label="Spins"
            value={stats.total}
            color="text-slate-200"
          />
          <StatTile
            label="Win Rate"
            value={`${stats.winRate}%`}
            color={stats.winRate >= 30 ? 'text-emerald-300' : stats.winRate >= 10 ? 'text-amber-300' : 'text-slate-300'}
          />
          <StatTile
            label={`${stats.wins}W / ${stats.losses}L`}
            value={stats.netResult >= 0 ? `+${fmtETB(stats.netResult)}` : fmtETB(stats.netResult)}
            color={stats.netResult > 0 ? 'text-emerald-300' : stats.netResult === 0 ? 'text-slate-300' : 'text-rose-300'}
          />
          <StatTile
            label="Best Win"
            value={`${fmtETB(stats.biggestWin)}`}
            color="text-coin-300"
          />
        </div>
      )}

      {bets.length === 0 ? (
        <div className="mt-2 rounded-2xl border border-dashed border-white/8 bg-white/[0.02] p-4 text-center">
          <p className="text-xs text-slate-500">No roulette plays yet. Spin the wheel!</p>
        </div>
      ) : (
        <div className="mt-2 space-y-1.5 max-h-80 overflow-y-auto">
          {bets.map((bet) => (
            <HistoryRow key={bet.id} bet={bet} />
          ))}
        </div>
      )}
    </details>
  );
}

function HistoryRow({ bet }) {
  const outcome = typeof bet.outcome === 'string' ? JSON.parse(bet.outcome) : bet.outcome;
  const number = outcome?.number;
  const numberColor = outcome?.numberColor || (number === 0 ? 'green' : 'red');
  const stake = Number(bet.stake);
  const payout = Number(bet.payout);
  const isWin = payout > 0;
  const netResult = payout > 0 ? payout - stake : -stake;

  const timeAgo = getTimeAgo(bet.created_at);

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${
        isWin
          ? 'border-emerald-500/20 bg-emerald-500/8'
          : 'border-white/8 bg-white/[0.02]'
      }`}
    >
      {/* Number ball */}
      {number !== undefined ? (
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black text-white"
          style={{ background: getNumberColor(number) }}
        >
          {number}
        </span>
      ) : (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-black text-slate-400">?</span>
      )}

      {/* Details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-black ${isWin ? 'text-emerald-300' : 'text-slate-300'}`}>
            {fmtETB(stake)} stake
          </span>
          <span className="text-[10px] text-slate-500">·</span>
          <span className={`text-xs font-black ${isWin ? 'text-emerald-300' : 'text-rose-300/70'}`}>
            {isWin ? `+${fmtETB(payout)}` : `${fmtETB(netResult)}`}
          </span>
        </div>
        <p className="text-[10px] text-slate-500">
          {bet.game_type === 'roulette' ? 'Roulette' : bet.game_type}
          {timeAgo && <span className="ml-2">· {timeAgo}</span>}
        </p>
      </div>

      {/* Badge */}
      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
        isWin ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/15 text-rose-300/70'
      }`}>
        {isWin ? 'Won' : 'Lost'}
      </span>
    </div>
  );
}

/** Mini stat tile for the summary bar. */
function StatTile({ label, value, color = 'text-slate-200' }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-2 py-1.5 text-center">
      <p className={`text-xs font-black leading-tight ${color}`}>{value}</p>
      <p className="text-[9px] text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Single number cell in the grid. */
function NumberCell({ bet, selected, resInfo, playing, result, selectedBets, onToggle, isZero }) {
  const hasResult = resInfo !== undefined;
  const won = resInfo?.won;

  let stateClass = '';
  if (hasResult) {
    if (won) {
      stateClass = 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200 ring-2 ring-emerald-400/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]';
    } else {
      stateClass = 'border-rose-400/20 bg-rose-500/10 text-rose-300/50';
    }
  } else if (selected) {
    stateClass = 'border-teal-400/50 bg-teal-500/15 text-teal-200 ring-1 ring-teal-400/30 shadow-teal-sm';
  }

  const bgColor = bet.color;

  return (
    <button
      onClick={() => onToggle(bet.key)}
      disabled={playing}
      className={`relative rounded-xl border-2 px-2 py-2.5 text-center font-black transition active:scale-90 disabled:opacity-50 ${stateClass || `border-white/10 bg-white/[0.06] text-white/90`}`}
      style={!hasResult && !selected ? { background: bgColor, borderColor: 'rgba(255,255,255,0.15)' } : {}}
    >
      <span className={`block text-sm leading-tight ${isZero ? 'text-white' : ''}`}>
        {bet.label}
      </span>
      <span className="block text-[7px] text-white/40 font-bold mt-0.5">35:1</span>
      {!result && selected && (
        <span className="absolute -top-1.5 -right-1.5 grid h-4 w-4 place-items-center rounded-full bg-teal-400 text-[8px] font-black text-teal-950 shadow">
          {selectedBets.indexOf(bet.key) + 1}
        </span>
      )}
      {result && won && (
        <span className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-400 text-[9px] font-black text-emerald-950 animate-number-pop shadow-lg">
          ₿
        </span>
      )}
    </button>
  );
}
