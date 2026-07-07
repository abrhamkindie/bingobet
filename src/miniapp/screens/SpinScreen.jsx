import React, { useContext, useMemo, useRef, useState } from 'react';
import { Disc3, Coins, Trophy, Sparkles } from 'lucide-react';
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
import CelebrationOverlay from '../components/CelebrationOverlay.jsx';

const SPIN_MS = 4200;

export default function SpinScreen({ onBack }) {
  const { player, patchPlayer, reload } = useContext(PlayerContext);
  const { addToast } = useContext(ToastContext);
  const { haptic } = useTelegram();
  const { data: cfg, loading, error, reload: reloadCfg } = useResource(api.getInstantConfig, []);

  const [stake, setStake] = useState(10);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const rotRef = useRef(0);

  const balance = Number(player?.wallet_balance || 0);
  const segments = cfg?.spin?.segments || [];
  const segAngle = segments.length ? 360 / segments.length : 45;

  const wheelBg = useMemo(() => {
    if (!segments.length) return '#1f3b32';
    const stops = segments.map((s, i) => `${s.color || '#14b8a6'} ${i * segAngle}deg ${(i + 1) * segAngle}deg`);
    return `conic-gradient(${stops.join(', ')})`;
  }, [segments, segAngle]);

  const spin = async () => {
    if (spinning) return;
    if (stake > balance) { addToast(errorMessage({ code: 'INSUFFICIENT_BALANCE' }), 'error'); return; }
    setSpinning(true);
    setResult(null);
    haptic('medium');
    try {
      const res = await api.playSpin(stake);
      // Land the winning segment center under the top pointer, plus full turns.
      const jitter = (Math.random() - 0.5) * segAngle * 0.6;
      const target = 360 - (res.segmentIndex + 0.5) * segAngle + jitter;
      const base = rotRef.current;
      const next = base - (base % 360) + 360 * 6 + target;
      rotRef.current = next;
      setRotation(next);

      setTimeout(() => {
        setResult(res);
        patchPlayer({ wallet_balance: res.balance });
        reload();
        if (res.win) {
          haptic('success');
          addToast(`You won ${fmtETB(res.payout)} ETB! ${res.multiplier}×`, 'success');
          setShowCelebration(true);
        } else {
          haptic('warning');
          addToast('No win — spin again!', 'info');
        }
        setSpinning(false);
      }, SPIN_MS);
    } catch (err) {
      addToast(errorMessage(err), 'error');
      setSpinning(false);
    }
  };

  const balanceChip = (
    <span className="inline-flex items-center gap-1 rounded-xl border border-coin-400/20 bg-coin-500/10 px-2.5 py-1.5 text-xs font-black text-white">
      <span className="text-coin-300">₿</span> {fmtETB(balance)}
    </span>
  );

  if (loading) return <ScreenShell title="Spin Wheel" Icon={Disc3} onBack={onBack}><Spinner label="Loading…" /></ScreenShell>;
  if (error) return <ScreenShell title="Spin Wheel" Icon={Disc3} onBack={onBack}><ErrorState error={error} onRetry={reloadCfg} /></ScreenShell>;

  return (
    <ScreenShell title="Spin Wheel" Icon={Disc3} onBack={onBack} right={balanceChip}>
      {/* Wheel */}
      <div className="relative mx-auto mt-2 grid place-items-center" style={{ width: 300, height: 300 }}>
        {/* pointer */}
        <div className="absolute -top-1 z-20 h-0 w-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-coin-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
        {/* glow */}
        <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at 50% 42%, rgba(45, 212, 191, 0.18), rgba(13, 148, 136, 0.04) 55%, transparent 70%)', boxShadow: '0 0 0 1px rgba(94, 234, 212, 0.25), inset 0 0 60px rgba(45, 212, 191, 0.18), 0 0 60px rgba(45, 212, 191, 0.22)' }} />
        {/* rotating wheel */}
        <div
          className="relative rounded-full border-4 border-white/10"
          style={{
            width: 272,
            height: 272,
            background: wheelBg,
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.9, 0.2, 1)` : 'none',
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.4)',
          }}
        >
          {segments.map((s, i) => {
            const angle = (i + 0.5) * segAngle;
            return (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 h-0 w-0"
                style={{ transform: `rotate(${angle}deg)` }}
              >
                {/* pushed out to the rim, kept upright within the wheel frame */}
                <span
                  className="absolute block whitespace-nowrap text-sm font-black text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                  style={{ transform: `translate(-50%, -104px) rotate(${-angle}deg)` }}
                >
                  {s.mult}×
                </span>
              </div>
            );
          })}
        </div>
        {/* hub */}
        <div className="absolute grid h-14 w-14 place-items-center rounded-full text-base font-black text-amber-900/80" style={{ background: 'radial-gradient(circle at 35% 28%, #fef9c3 0%, #fcd34d 30%, #f59e0b 62%, #b45309 100%)', boxShadow: '0 0 0 3px rgba(180, 83, 9, 0.55), 0 0 0 6px rgba(251, 191, 36, 0.18), 0 10px 30px rgba(180, 83, 9, 0.45), inset 0 3px 8px rgba(255, 255, 255, 0.65), inset 0 -6px 12px rgba(146, 64, 14, 0.55)' }}>₿</div>
      </div>

      {/* Result */}
      <div className="mt-5 text-center">
        {result ? (
          result.win ? (
            <div className="animate-bounce-in rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-lg font-black text-emerald-300">
                <Trophy size={18} /> +{fmtETB(result.payout)} ETB
              </p>
              <p className="text-xs text-emerald-200/80">Landed on {result.multiplier}× — you won!</p>
            </div>
          ) : (
            <div className="animate-bounce-in rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3">
              <p className="text-lg font-black text-rose-300">Landed on {result.multiplier}×</p>
              <p className="text-xs text-rose-200/80">{result.multiplier === 0 ? 'No win — stake lost' : 'Below 1× — no profit this spin'}</p>
            </div>
          )
        ) : (
          <p className="text-sm text-slate-400">
            Spin to win up to <span className="font-black text-coin-300">{Math.max(...segments.map((s) => Number(s.mult)))}×</span> your stake
          </p>
        )}
      </div>

      {/* Legend — makes every possible outcome (and win/loss) explicit */}
      <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">Prizes</p>
          <p className="text-[10px] text-slate-500">stake × multiplier</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {segments.map((s, i) => {
            const mult = Number(s.mult);
            const win = mult > 1;
            return (
              <div
                key={i}
                className={`flex items-center gap-1.5 rounded-xl border px-2 py-1.5 ${
                  result && result.segmentIndex === i
                    ? 'border-white/40 bg-white/10 ring-1 ring-white/30'
                    : 'border-white/8 bg-white/[0.02]'
                }`}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className={`text-xs font-black ${win ? 'text-emerald-300' : mult === 1 ? 'text-slate-200' : 'text-slate-500'}`}>
                  {s.mult}×
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] leading-4 text-slate-400">
          <span className="font-bold text-rose-300">0×</span> = lose stake ·
          <span className="font-bold text-slate-200"> 1×</span> = stake back ·
          <span className="font-bold text-emerald-300"> 2× and up</span> = profit. The pointer at the top marks where you land.
        </p>
      </div>

      {/* Stake + spin */}
      <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
        <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">Stake</p>
        <StakeControl value={stake} onChange={setStake} min={cfg.minStake} max={cfg.maxStake} balance={balance} disabled={spinning} />
        <Button block size="lg" className="mt-4" loading={spinning} onClick={spin}>
          <Coins size={18} /> {spinning ? 'Spinning…' : `Spin — ${fmtETB(stake)} ETB`}
        </Button>
      </div>

      {/* Celebration overlay on win */}
      <CelebrationOverlay
        show={showCelebration}
        result={result}
        title={`${result?.multiplier}× Win!`}
        subtitle={result ? `Landed on ${result.multiplier}× — You won ${fmtETB(result.payout)} ETB` : ''}
        onComplete={() => setShowCelebration(false)}
      />
    </ScreenShell>
  );
}
