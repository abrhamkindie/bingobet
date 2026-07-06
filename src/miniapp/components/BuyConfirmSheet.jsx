import React, { useContext, useState } from 'react';
import { Ticket, Wallet, Sparkles, AlertCircle } from 'lucide-react';
import * as api from '../api.js';
import { PlayerContext, ToastContext } from '../App.jsx';
import { errorMessage, fmtETB } from '../i18n.js';
import Sheet from './ui/Sheet.jsx';
import Button from './ui/Button.jsx';

/**
 * Confirm-ticket-purchase bottom sheet. Shows price, current + resulting
 * balance, and warns when the balance is too low (with a deposit shortcut).
 */
export default function BuyConfirmSheet({ game, open, onClose, onPurchased, navigate }) {
  const { player, reload, patchPlayer } = useContext(PlayerContext);
  const { addToast } = useContext(ToastContext);
  const [loading, setLoading] = useState(false);

  if (!game) return null;

  const price = Number(game.ticket_price);
  const balance = Number(player?.wallet_balance || 0);
  const after = balance - price;
  const tooLow = after < 0;

  const handleBuy = async () => {
    if (tooLow) { onClose(); navigate?.('deposit'); return; }
    setLoading(true);
    try {
      const res = await api.buyTicket(game.id);
      addToast(`Ticket #${res.ticket?.position ?? ''} secured! Good luck 🍀`, 'success');
      patchPlayer({ wallet_balance: after });
      reload();
      onClose();
      onPurchased?.(res);
    } catch (err) {
      addToast(errorMessage(err), 'error');
      if (err.code === 'INSUFFICIENT_BALANCE') { onClose(); navigate?.('deposit'); }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Confirm Ticket"
      footer={
        <Button block size="lg" loading={loading} onClick={handleBuy} haptic={tooLow ? 'warning' : 'medium'}>
          {tooLow ? 'Top up wallet' : (
            <><Ticket size={17} /> Buy for {fmtETB(price)} ETB</>
          )}
        </Button>
      }
    >
      <div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-coin-500/15 text-coin-300">
          <Sparkles size={20} />
        </div>
        <div>
          <p className="font-black text-white">{game.title}</p>
          <p className="text-xs text-slate-400">Random numbers auto-assigned</p>
        </div>
      </div>

      <Row label="Ticket price" value={`${fmtETB(price)} ETB`} />
      <Row label="Wallet balance" value={`${fmtETB(balance)} ETB`} Icon={Wallet} />
      <div className="my-2 border-t border-dashed border-white/10" />
      <Row
        label="Balance after"
        value={`${fmtETB(Math.max(after, 0))} ETB`}
        valueClass={tooLow ? 'text-rose-300' : 'text-emerald-300'}
      />

      {tooLow && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-200">
          <AlertCircle size={15} className="shrink-0" />
          You need {fmtETB(price - balance)} ETB more. Tap below to deposit.
        </div>
      )}
    </Sheet>
  );
}

function Row({ label, value, Icon, valueClass = 'text-white' }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="inline-flex items-center gap-1.5 text-sm text-slate-400">
        {Icon && <Icon size={13} />} {label}
      </span>
      <span className={`text-sm font-black ${valueClass}`}>{value}</span>
    </div>
  );
}
