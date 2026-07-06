import React, { useContext, useMemo, useState } from 'react';
import { Grid3x3, Shuffle, Eraser, Trophy, Coins } from 'lucide-react';
import * as api from '../api.js';
import { PlayerContext, ToastContext } from '../App.jsx';
import { useResource } from '../hooks/useResource.js';
import { useTelegram } from '../hooks/useTelegram.js';
import { errorMessage, fmtETB } from '../i18n.js';
import ScreenShell from '../components/ui/ScreenShell.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import StakeControl from '../components/StakeControl.jsx';
import { Spinner, ErrorState } from '../components/ui/states.jsx';

export default function KenoScreen({ onBack }) {
  const { player, patchPlayer, reload } = useContext(PlayerContext);
  const { addToast } = useContext(ToastContext);
  const { haptic } = useTelegram();
  const { data: cfg, loading, error, reload: reloadCfg } = useResource(api.getInstantConfig, []);

  const [picks, setPicks] = useState([]);
  const [stake, setStake] = useState(10);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState(null);

  const balance = Number(player?.wallet_balance || 0);
  const pool = cfg?.keno?.pool || 40;
  const maxSpots = cfg?.keno?.maxSpots || 8;
  const paytable = cfg?.keno?.paytable || {};

  const drawnSet = useMemo(() => new Set(result?.drawn || []), [result]);

  const toggle = (n) => {
    if (playing) return;
    setResult(null);
    setPicks((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n);
      if (prev.length >= maxSpots) { haptic('warning'); addToast(`Pick at most ${maxSpots} numbers`, 'warning'); return prev; }
      haptic('select');
      return [...prev, n];
    });
  };

  const quickPick = () => {
    setResult(null);
    const nums = new Set();
    const count = maxSpots;
    while (nums.size < count) nums.add(1 + Math.floor(Math.random() * pool));
    setPicks([...nums]);
    haptic('light');
  };

  const clear = () => { setResult(null); setPicks([]); haptic('light'); };

  const play = async () => {
    if (picks.length === 0) { addToast('Pick at least one number', 'warning'); return; }
    if (stake > balance) { addToast(errorMessage({ code: 'INSUFFICIENT_BALANCE' }), 'error'); onBack && null; return; }
    setPlaying(true);
    setResult(null);
    try {
      const res = await api.playKeno(stake, picks);
      setResult(res);
      patchPlayer({ wallet_balance: res.balance });
      reload();
      if (res.win) { haptic('success'); addToast(`You won ${fmtETB(res.payout)} ETB! (${res.hits} hits)`, 'success'); }
      else { haptic('warning'); addToast(`${res.hits} hits — no win this time`, 'info'); }
    } catch (err) {
      addToast(errorMessage(err), 'error');
    } finally {
      setPlaying(false);
    }
  };

  const balanceChip = (
    <span className="inline-flex items-center gap-1 rounded-xl border border-coin-400/20 bg-coin-500/10 px-2.5 py-1.5 text-xs font-black text-white">
      <span className="text-coin-300">₿</span> {fmtETB(balance)}
    </span>
  );

  if (loading) return <ScreenShell title="Keno" Icon={Grid3x3} onBack={onBack}><Spinner label="Loading…" /></ScreenShell>;
  if (error) return <ScreenShell title="Keno" Icon={Grid3x3} onBack={onBack}><ErrorState error={error} onRetry={reloadCfg} /></ScreenShell>;

  const potential = result ? null : (paytable[String(picks.length)] || {});
  const bestMult = potential ? Math.max(0, ...Object.values(potential).map(Number)) : 0;

  return (
    <ScreenShell title="Keno" Icon={Grid3x3} onBack={onBack} right={balanceChip}>
      {/* Status banner */}
      <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <div className="text-xs text-slate-400">
          Picked <span className="font-black text-teal-300">{picks.length}</span>/{maxSpots}
          {result && <> · Hits <span className="font-black text-emerald-300">{result.hits}</span></>}
        </div>
        {result ? (
          result.win
            ? <Badge tone="emerald" Icon={Trophy} glow>+{fmtETB(result.payout)} ETB · {result.multiplier}×</Badge>
            : <Badge tone="red">No win</Badge>
        ) : (
          bestMult > 0 && <Badge tone="coin">up to {bestMult}×</Badge>
        )}
      </div>

      {/* Number board */}
      <div className="grid grid-cols-8 gap-1.5">
        {Array.from({ length: pool }, (_, i) => {
          const n = i + 1;
          const picked = picks.includes(n);
          const drawn = drawnSet.has(n);
          let cls = 'border border-white/10 bg-white/[0.03] text-slate-400';
          if (result) {
            if (drawn && picked) cls = 'bg-gradient-to-br from-emerald-300 to-emerald-500 text-emerald-950 shadow-[0_0_12px_rgba(16,185,129,0.5)]';
            else if (drawn) cls = 'coin-disc text-amber-900/80';
            else if (picked) cls = 'border border-teal-400/40 text-teal-300/60';
          } else if (picked) {
            cls = 'bg-gradient-to-br from-teal-300 to-teal-500 text-teal-950 shadow-teal-sm';
          }
          return (
            <button
              key={n}
              onClick={() => toggle(n)}
              className={`grid aspect-square place-items-center rounded-xl text-xs font-black transition active:scale-90 ${cls}`}
            >
              {n}
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" size="sm" block onClick={quickPick} disabled={playing}>
          <Shuffle size={15} /> Quick Pick
        </Button>
        <Button variant="ghost" size="sm" block onClick={clear} disabled={playing || picks.length === 0}>
          <Eraser size={15} /> Clear
        </Button>
      </div>

      {/* Stake + play */}
      <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
        <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">Stake</p>
        <StakeControl value={stake} onChange={setStake} min={cfg.minStake} max={cfg.maxStake} balance={balance} disabled={playing} />
        <Button block size="lg" className="mt-4" loading={playing} disabled={picks.length === 0} onClick={play}>
          <Coins size={18} /> {result ? 'Play Again' : `Play — ${fmtETB(stake)} ETB`}
        </Button>
      </div>

      {/* Paytable for current selection */}
      {picks.length > 0 && Object.keys(potential || {}).length > 0 && (
        <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">Payouts for {picks.length} spots</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(potential).sort((a, b) => Number(a[0]) - Number(b[0])).map(([hits, mult]) => (
              <span key={hits} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-300">
                {hits} hits · <span className="font-black text-coin-300">{mult}×</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </ScreenShell>
  );
}
