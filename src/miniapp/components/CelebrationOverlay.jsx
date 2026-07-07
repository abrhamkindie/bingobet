import React, { useEffect, useState } from 'react';
import { Sparkles, Trophy } from 'lucide-react';

export default function CelebrationOverlay({
  show,
  result,
  onComplete,
  duration = 3000,
  title = 'You Won!',
  subtitle = '',
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [show, duration, onComplete]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center">
      {/* Confetti particles */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 40 }, (_, i) => (
          <div
            key={i}
            className="absolute pointer-events-none"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 30}%`,
              width: `${6 + Math.random() * 8}px`,
              height: `${6 + Math.random() * 8}px`,
              backgroundColor: ['#fbbf24', '#f59e0b', '#2dd4bf', '#22c55e', '#ef4444', '#a855f7', '#3b82f6'][i % 7],
              animation: `confettiFall ${1.5 + Math.random() * 2}s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
              animationDelay: `${Math.random() * 0.8}s`,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              zIndex: 90,
            }}
          />
        ))}
      </div>

      {/* Glow burst */}
      <div className="absolute inset-0 bg-gradient-to-b from-teal-500/10 via-transparent to-transparent animate-fade-in-up" />

      {/* Result card */}
      <div className="relative animate-bounce-in rounded-3xl border border-coin-400/30 bg-gradient-to-br from-night-900/95 to-night-800/95 px-8 py-8 text-center shadow-[0_0_60px_rgba(251,191,36,0.25)] backdrop-blur-2xl">
        {/* Trophy icon */}
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-coin-400 to-amber-500 shadow-coin-lg animate-float">
          <Trophy size={32} className="text-amber-950" />
        </div>

        <h2
          className="text-2xl font-black text-white"
          style={{ textShadow: '0 0 12px rgba(251, 191, 36, 0.55), 0 0 28px rgba(245, 158, 11, 0.3)' }}
        >
          {title}
        </h2>

        {subtitle && (
          <p className="mt-2 text-base text-slate-300">{subtitle}</p>
        )}

        {result && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-500/20 px-4 py-2">
              <Sparkles size={16} className="text-emerald-300" />
              <span className="text-lg font-black text-emerald-200">
                +{result.payout ?? result.amount ?? 0} ETB
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
