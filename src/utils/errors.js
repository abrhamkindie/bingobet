/**
 * BetBingo error hierarchy.
 */

export class AppError extends Error {
  constructor(code, statusCode = 500, message = 'Internal Server Error', meta) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.meta = meta;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', meta) {
    super('BAD_REQUEST', 400, message, meta);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', meta) {
    super('UNAUTHORIZED', 401, message, meta);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', meta) {
    super('FORBIDDEN', 403, message, meta);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', meta) {
    super('NOT_FOUND', 404, message, meta);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists', meta) {
    super('CONFLICT', 409, message, meta);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details, meta) {
    super('VALIDATION_ERROR', 422, message, { ...meta, details });
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal Server Error', meta) {
    super('INTERNAL_ERROR', 500, message, meta);
    this.name = 'InternalError';
  }
}

const LEGACY_ERROR_MAP = {
  NOT_FOUND: [404, 'Resource not found'],
  INVALID_CREDENTIALS: [401, 'Invalid email or password'],
  TOKEN_EXPIRED: [401, 'Token has expired, please login again'],
  INVALID_TOKEN: [401, 'Invalid token'],

  // Game errors
  GAME_NOT_FOUND: [404, 'Game not found'],
  GAME_NOT_ACCEPTING_TICKETS: [409, 'Game is not accepting tickets'],
  GAME_SOLD_OUT: [409, 'Game is sold out'],
  GAME_NOT_DRAWABLE: [409, 'Game cannot be drawn in its current state'],
  PLAYER_TICKET_LIMIT_REACHED: [409, 'You have reached the maximum tickets for this game'],
  PLAYER_NOT_FOUND: [404, 'Player not found'],
  INSUFFICIENT_BALANCE: [402, 'Insufficient balance'],
  INVALID_AMOUNT: [422, 'Invalid amount'],
  WITHDRAWAL_MINIMUM: [422, 'Amount is below minimum withdrawal'],
};

export function toAppError(err) {
  if (err instanceof AppError) return err;
  const code = err.code || err.message;
  const mapped = LEGACY_ERROR_MAP[code];
  if (mapped) {
    const [statusCode, message] = mapped;
    return new AppError(code, statusCode, message, { originalMessage: err.message });
  }
  return new InternalError('Internal Server Error', { originalMessage: err.message });
}
