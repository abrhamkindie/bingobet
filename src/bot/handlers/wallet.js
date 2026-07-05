import { walletKeyboard, depositKeyboard, withdrawKeyboard } from '../keyboards.js';
import { getWalletInfo, initiateDeposit, requestWithdrawal } from '../../services/walletService.js';
import { formatMoney, currency } from '../../utils/format.js';
import { logger } from '../../utils/logger.js';

export function registerWallet(bot) {
  // Show wallet
  bot.callbackQuery('wallet:show', async (ctx) => {
    await ctx.answerCallbackQuery();
    try {
      const info = await getWalletInfo(ctx.dbPlayer.id);
      const text = `💰 *${ctx.t('wallet.title')}*\n\n` +
        `${ctx.t('wallet.balance', { balance: formatMoney(info.balance), currency })}\n` +
        `${ctx.t('wallet.total_spent', { total_spent: formatMoney(info.totalSpent), currency })}\n` +
        `${ctx.t('wallet.total_won', { total_won: formatMoney(info.totalWon), currency })}\n\n` +
        `*${ctx.t('wallet.transactions')}:*\n` +
        (info.transactions.length
          ? info.transactions.slice(0, 5).map(tx => {
              const typeKey = `wallet.tx_${tx.type}`;
              const label = ctx.t(typeKey, { ticket_id: tx.ticket_id || '' });
              const sign = tx.type === 'winnings' || tx.type === 'deposit' ? '+' : '-';
              return `${label}: ${sign}${formatMoney(tx.amount)} ${currency}`;
            }).join('\n')
          : ctx.t('wallet.no_transactions'));

      await ctx.editMessageText(text, {
        reply_markup: walletKeyboard(ctx.t),
        parse_mode: 'Markdown',
      });
    } catch (err) {
      await ctx.editMessageText(ctx.t('common.error_generic'));
    }
  });

  // Deposit - show options
  bot.callbackQuery('wallet:deposit', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `${ctx.t('wallet.deposit_prompt', { currency })}\n\nSelect amount:`,
      { reply_markup: depositKeyboard(ctx.t) }
    );
  });

  // Deposit with amount
  bot.callbackQuery(/^wallet:deposit:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const amount = Number(ctx.match[1]);

    try {
      const result = await initiateDeposit({
        playerId: ctx.dbPlayer.id,
        amount,
        returnUrl: `https://t.me/${bot.botInfo?.username}`,
      });

      await ctx.editMessageText(
        ctx.t('wallet.deposit_chapa', { amount: formatMoney(amount), currency }) + '\n\n' +
        `[${ctx.t('wallet.deposit')}](${result.checkoutUrl})`,
        { parse_mode: 'Markdown', reply_markup: walletKeyboard(ctx.t) }
      );

      logger.info('Deposit initiated', { playerId: ctx.dbPlayer.id, amount });
    } catch (err) {
      await ctx.editMessageText(ctx.t('wallet.deposit_invalid'));
    }
  });

  // Withdraw - show options
  bot.callbackQuery('wallet:withdraw', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `${ctx.t('wallet.withdraw_prompt', { min_wd: 50, currency })}\n\nSelect amount:`,
      { reply_markup: withdrawKeyboard(ctx.t) }
    );
  });

  // Withdraw with amount
  bot.callbackQuery(/^wallet:withdraw:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const amount = Number(ctx.match[1]);

    try {
      const result = await requestWithdrawal(ctx.dbPlayer.id, amount);
      await ctx.editMessageText(
        ctx.t('wallet.withdraw_success', { amount: formatMoney(amount), currency }),
        { reply_markup: walletKeyboard(ctx.t) }
      );

      logger.info('Withdrawal requested', { playerId: ctx.dbPlayer.id, amount });
    } catch (err) {
      const msg = err.code === 'INSUFFICIENT_BALANCE'
        ? ctx.t('wallet.withdraw_insufficient', { balance: formatMoney(ctx.dbPlayer.wallet_balance), currency })
        : ctx.t('wallet.withdraw_invalid', { min_wd: 50 });
      await ctx.editMessageText(msg);
    }
  });
}
