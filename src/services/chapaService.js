import crypto from 'node:crypto';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const CHAPA_BASE_URL = 'https://api.chapa.co/v1';

function generateTxRef(entityId) {
  const timestamp = Date.now();
  return `betbingo_${entityId}_${timestamp}`;
}

export async function initializePayment({
  amount,
  currency = 'ETB',
  entityId,
  entityType = 'tx',
  customerEmail,
  customerPhone,
  callbackUrl,
  returnUrl,
}) {
  if (!config.chapa.secretKey) throw new Error('Chapa secret key not configured');

  const txRef = generateTxRef(entityId);
  const safeEmail = customerEmail || `player_${entityId}_${Date.now()}@gmail.com`;

  const payload = {
    amount: String(amount),
    currency,
    email: safeEmail,
    tx_ref: txRef,
    callback_url: callbackUrl || `${config.publicUrl}/api/payments/chapa/webhook`,
    return_url: returnUrl || `${config.publicUrl}/payment/success`,
    customization: {
      title: 'BetBingo',
      description: `${entityType} #${entityId}`,
    },
  };

  if (customerPhone) payload.phone_number = customerPhone;

  try {
    const response = await fetch(`${CHAPA_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.chapa.secretKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || data.status !== 'success') {
      logger.error('Chapa initialization failed', { status: response.status, data, txRef });
      const errorMsg = typeof data.message === 'string'
        ? data.message
        : data.message && typeof data.message === 'object'
          ? JSON.stringify(data.message)
          : 'Chapa payment could not be initiated';
      throw new Error(errorMsg);
    }

    logger.info('Chapa payment initialized', { txRef, checkoutUrl: data.data.checkout_url });
    return { checkout_url: data.data.checkout_url, tx_ref: txRef };
  } catch (err) {
    logger.error('Chapa initialization error', { error: err.message, txRef });
    throw err;
  }
}

export async function verifyPayment(txRef) {
  if (!config.chapa.secretKey) throw new Error('Chapa secret key not configured');
  try {
    const response = await fetch(`${CHAPA_BASE_URL}/transaction/verify/${txRef}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.chapa.secretKey}` },
    });
    const data = await response.json();
    if (!response.ok) {
      logger.error('Chapa verification failed', { status: response.status, data, txRef });
      return { status: 'failed', data };
    }
    const transactionStatus = data?.data?.status || data.status;
    logger.info('Chapa payment verified', { txRef, status: transactionStatus });
    return { status: transactionStatus, data: data.data || data };
  } catch (err) {
    logger.error('Chapa verification error', { error: err.message, txRef });
    throw err;
  }
}

export function verifySignature(rawBody, signatureHeader, webhookSecret) {
  if (!signatureHeader || !webhookSecret) return false;
  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody, 'utf8')
    .digest('hex');
  try {
    const sigBuffer = Buffer.from(signatureHeader.trim());
    const expectedBuffer = Buffer.from(expectedSig);
    if (sigBuffer.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch { return false; }
}

export function handleWebhook(payload) {
  if (!payload) throw new Error('Invalid webhook payload');
  const { event, tx_ref, status, amount } = payload;
  if (!event || !tx_ref) throw new Error('Missing required webhook fields');
  logger.info('Chapa webhook received', { event, tx_ref, status, amount });
  return { event, tx_ref, status, amount: amount ? Number(amount) : null, raw: payload };
}
