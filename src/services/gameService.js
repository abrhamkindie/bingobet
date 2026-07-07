/**
 * Game service — Lottery/Bingo draw game operations.
 *
 * Delegates to the GameEngine's LotteryPlugin under the hood.
 * Kept as a thin wrapper so existing routes and bot handlers don't need to change.
 *
 * @module services/gameService
 */

import { engine } from '../engine/index.js';

function getLottery() {
  const plugin = engine.get('lottery');
  if (!plugin) throw new Error('Lottery plugin not initialized — call initEngine() first');
  return plugin;
}

// Create a new game round
export async function createGame(gameData) {
  return getLottery().createRound(gameData);
}

// Buy a ticket for a game
export async function buyTicket({ playerId, gameRoundId }) {
  return getLottery().buyTicket({ playerId, gameRoundId });
}

// Get active games
export async function listActiveGames() {
  return getLottery().listActiveGames();
}

// Get game detail
export async function getGameDetail(gameId) {
  return getLottery().getGame(gameId);
}

// Get player tickets for a game
export async function getPlayerTickets(playerId, gameRoundId) {
  return getLottery().getPlayerTickets(playerId, gameRoundId);
}

// Get all player tickets
export async function getMyTickets(playerId) {
  return getLottery().getMyTickets(playerId);
}

// Start the draw for a game
export async function startDraw(gameRoundId) {
  return getLottery().startDraw(gameRoundId);
}
