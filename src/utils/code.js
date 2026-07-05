import crypto from 'node:crypto';

export function generateConfirmationCode() {
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `BB-${timestamp}${random}`;
}

export function generateTxRef(entityId) {
  const timestamp = Date.now();
  return `betbingo_${entityId}_${timestamp}`;
}
