import { z } from 'zod';

export const idParam = z.object({
  id: z.coerce.number().int().positive(),
});

export const pagination = {
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
};

// Auth
export const login = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const register = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().optional(),
  role: z.enum(['admin', 'superadmin']).optional(),
});

// Games
export const createGameBody = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  ticketPrice: z.coerce.number().positive('Price must be greater than 0'),
  maxTickets: z.coerce.number().int().positive().default(1000),
  maxPerPlayer: z.coerce.number().int().positive().default(10),
  numberMin: z.coerce.number().int().default(1),
  numberMax: z.coerce.number().int().default(50),
  numbersPerTicket: z.coerce.number().int().positive().default(6),
  numbersToDraw: z.coerce.number().int().positive().default(6),
  drawType: z.enum(['scheduled', 'manual']).default('scheduled'),
  scheduledDrawAt: z.string().optional(),
  drawIntervalMinutes: z.coerce.number().int().positive().optional(),
  platformFeePercent: z.coerce.number().min(0).max(100).default(10),
  prizeTiers: z.string().optional(),
});

export const gameListQuery = z.object({
  status: z.string().optional(),
  ...pagination,
});

// Players
export const playerListQuery = z.object({
  ...pagination,
});
