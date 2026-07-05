-- ============================================================
-- 002_functions.sql  —  BetBingo lottery engine functions
-- ============================================================

-- ------------------------------------------------------------
-- draw_random_numbers
--   Draws N unique random numbers from [min, max] range for a round.
--   Ensures no duplicate draws.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION draw_random_numbers(
  p_game_round_id BIGINT,
  p_count INTEGER
)
RETURNS SETOF drawn_numbers AS $$
DECLARE
  v_min INTEGER;
  v_max INTEGER;
  v_numbers INTEGER[] := '{}';
  v_pool INTEGER[];
  v_next INTEGER;
  v_pos INTEGER;
BEGIN
  -- Get game config
  SELECT number_min, number_max INTO v_min, v_max
  FROM game_rounds WHERE id = p_game_round_id;

  -- Build pool of available numbers (exclude already drawn)
  SELECT array_agg(g.num) INTO v_pool
  FROM generate_series(v_min, v_max) g(num)
  WHERE g.num NOT IN (
    SELECT number FROM drawn_numbers WHERE game_round_id = p_game_round_id
  );

  -- Shuffle and pick
  FOR i IN 1..LEAST(p_count, array_length(v_pool, 1)) LOOP
    v_next := v_pool[1 + floor(random() * array_length(v_pool, 1))::int];
    v_pool := array_remove(v_pool, v_next);

    SELECT COALESCE(MAX(position), 0) + 1 INTO v_pos
    FROM drawn_numbers WHERE game_round_id = p_game_round_id;

    INSERT INTO drawn_numbers (game_round_id, number, position)
    VALUES (p_game_round_id, v_next, v_pos)
    RETURNING * INTO v_next, v_pos;  -- reusing vars
  END LOOP;

  RETURN QUERY SELECT * FROM drawn_numbers WHERE game_round_id = p_game_round_id
    ORDER BY position ASC;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- match_tickets
--   For a given round, scan all active tickets and count matches
--   against drawn numbers. Returns the count of winning tickets.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_tickets(p_game_round_id BIGINT)
RETURNS TABLE (
  ticket_id BIGINT,
  player_id BIGINT,
  matched INTEGER
) AS $$
  SELECT
    t.id AS ticket_id,
    t.player_id,
    (SELECT COUNT(*) FROM unnest(t.numbers) n WHERE n IN (
      SELECT number FROM drawn_numbers WHERE game_round_id = p_game_round_id
    ))::INTEGER AS matched
  FROM tickets t
  WHERE t.game_round_id = p_game_round_id
    AND t.status = 'active'
  ORDER BY matched DESC;
$$ LANGUAGE sql;

-- ------------------------------------------------------------
-- calculate_prize
--   Calculate prize amount for a given match count using prize tiers.
--   Returns 0 if no tier matches.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_prize(
  p_match_count INTEGER,
  p_ticket_price NUMERIC,
  p_prize_tiers JSONB,
  p_prize_pool NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
  v_tier JSONB;
  v_multiplier NUMERIC;
  v_fixed_amount NUMERIC;
BEGIN
  FOR v_tier IN SELECT * FROM jsonb_array_elements(p_prize_tiers) LOOP
    IF (v_tier->>'match')::INTEGER = p_match_count THEN
      v_multiplier := COALESCE((v_tier->>'payout_multiplier')::NUMERIC, 0);
      v_fixed_amount := COALESCE((v_tier->>'fixed_amount')::NUMERIC, 0);

      IF v_fixed_amount > 0 THEN
        RETURN v_fixed_amount;
      ELSIF v_tier->>'match' IS NOT NULL AND v_tier ? 'is_jackpot' AND (v_tier->>'is_jackpot')::BOOLEAN THEN
        -- Jackpot: share of prize pool
        RETURN ROUND(p_prize_pool * 0.70 / GREATEST(1, (SELECT COUNT(*) FROM tickets
          WHERE game_round_id = p_game_round_id AND is_winner = true)), 2);
      ELSE
        RETURN ROUND(p_ticket_price * v_multiplier, 2);
      END IF;
    END IF;
  END LOOP;
  RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- complete_game_draw
--   Full draw pipeline: draw all numbers, match tickets, award prizes.
--   Returns game round summary.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION complete_game_draw(p_game_round_id BIGINT)
RETURNS JSONB AS $$
DECLARE
  v_game game_rounds%ROWTYPE;
  v_ticket RECORD;
  v_prize NUMERIC;
  v_total_payout NUMERIC := 0;
  v_winner_count INTEGER := 0;
  v_remaining NUMERIC;
BEGIN
  -- Lock and validate game
  SELECT * INTO v_game FROM game_rounds WHERE id = p_game_round_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAME_NOT_FOUND'; END IF;
  IF v_game.status != 'active' AND v_game.status != 'drawing' THEN
    RAISE EXCEPTION 'GAME_NOT_DRAWABLE';
  END IF;

  -- Set to drawing status
  UPDATE game_rounds SET status = 'drawing' WHERE id = p_game_round_id;

  -- Draw all numbers
  PERFORM draw_random_numbers(p_game_round_id, v_game.numbers_to_draw);

  -- Match tickets and award prizes
  FOR v_ticket IN SELECT * FROM match_tickets(p_game_round_id) LOOP
    IF v_ticket.matched > 0 THEN
      v_prize := calculate_prize(
        v_ticket.matched,
        v_game.ticket_price,
        v_game.prize_tiers,
        v_game.prize_pool
      );

      IF v_prize > 0 THEN
        UPDATE tickets SET
          matched_count = v_ticket.matched,
          prize_amount = v_prize,
          is_winner = true,
          status = 'won'
        WHERE id = v_ticket.ticket_id;

        -- Credit player wallet
        UPDATE players SET
          wallet_balance = wallet_balance + v_prize,
          total_won = total_won + v_prize
        WHERE id = v_ticket.player_id;

        -- Record transaction
        INSERT INTO transactions (player_id, type, amount, balance_before, balance_after,
          reference, status, ticket_id, game_round_id)
        SELECT
          v_ticket.player_id, 'winnings', v_prize,
          wallet_balance, wallet_balance + v_prize,
          'WIN-' || p_game_round_id || '-' || v_ticket.ticket_id, 'completed',
          v_ticket.ticket_id, p_game_round_id
        FROM players WHERE id = v_ticket.player_id;

        v_total_payout := v_total_payout + v_prize;
        v_winner_count := v_winner_count + 1;
      ELSE
        UPDATE tickets SET matched_count = v_ticket.matched, status = 'lost'
        WHERE id = v_ticket.ticket_id;
      END IF;
    ELSE
      UPDATE tickets SET matched_count = 0, status = 'lost'
      WHERE id = v_ticket.ticket_id;
    END IF;
  END LOOP;

  -- Mark all remaining active tickets as lost
  UPDATE tickets SET status = 'lost' WHERE game_round_id = p_game_round_id AND status = 'active';

  -- Update game round
  v_remaining := v_game.prize_pool - v_total_payout - v_game.platform_fee;
  UPDATE game_rounds SET
    status = 'completed',
    winner_count = v_winner_count,
    total_payout = v_total_payout,
    drawn_at = now()
  WHERE id = p_game_round_id;

  RETURN jsonb_build_object(
    'game_id', p_game_round_id,
    'total_tickets', v_game.tickets_sold,
    'prize_pool', v_game.prize_pool,
    'total_payout', v_total_payout,
    'winner_count', v_winner_count,
    'platform_fee', v_game.platform_fee,
    'remaining', v_remaining
  );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- buy_ticket
--   Assigns random unique numbers to a ticket for a player.
--   Ensures capacity limits.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION buy_ticket(
  p_player_id BIGINT,
  p_game_round_id BIGINT
)
RETURNS BIGINT AS $$
DECLARE
  v_game game_rounds%ROWTYPE;
  v_player players%ROWTYPE;
  v_numbers INTEGER[] := '{}';
  v_pool INTEGER[];
  v_next INTEGER;
  v_ticket_count INTEGER;
  v_ticket_id BIGINT;
BEGIN
  -- Lock game and player rows
  SELECT * INTO v_game FROM game_rounds WHERE id = p_game_round_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAME_NOT_FOUND'; END IF;
  IF v_game.status != 'upcoming' AND v_game.status != 'active' THEN
    RAISE EXCEPTION 'GAME_NOT_ACCEPTING_TICKETS';
  END IF;

  SELECT * INTO v_player FROM players WHERE id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PLAYER_NOT_FOUND'; END IF;

  -- Check capacity
  IF v_game.tickets_sold >= v_game.max_tickets THEN
    RAISE EXCEPTION 'GAME_SOLD_OUT';
  END IF;

  -- Check player limit
  SELECT COUNT(*) INTO v_ticket_count FROM tickets
  WHERE game_round_id = p_game_round_id AND player_id = p_player_id;
  IF v_ticket_count >= v_game.max_tickets_per_player THEN
    RAISE EXCEPTION 'PLAYER_TICKET_LIMIT_REACHED';
  END IF;

  -- Generate random unique numbers within range
  SELECT array_agg(g.num) INTO v_pool
  FROM generate_series(v_game.number_min, v_game.number_max) g(num);

  FOR i IN 1..v_game.numbers_per_ticket LOOP
    IF array_length(v_pool, 1) = 0 THEN EXIT; END IF;
    v_next := v_pool[1 + floor(random() * array_length(v_pool, 1))::int];
    v_pool := array_remove(v_pool, v_next);
    v_numbers := array_append(v_numbers, v_next);
  END LOOP;

  -- Sort numbers
  SELECT array_agg(n ORDER BY n) INTO v_numbers FROM unnest(v_numbers) n;

  -- Get position
  SELECT COALESCE(MAX(position), 0) + 1 INTO v_ticket_count
  FROM tickets WHERE game_round_id = p_game_round_id;

  -- Create ticket
  INSERT INTO tickets (game_round_id, player_id, numbers, position)
  VALUES (p_game_round_id, p_player_id, v_numbers, v_ticket_count)
  RETURNING id INTO v_ticket_id;

  -- Update game counters
  UPDATE game_rounds SET tickets_sold = tickets_sold + 1, prize_pool = prize_pool + ticket_price
  WHERE id = p_game_round_id;

  -- Deduct from player
  UPDATE players SET
    wallet_balance = wallet_balance - v_game.ticket_price,
    total_tickets_bought = total_tickets_bought + 1,
    total_spent = total_spent + v_game.ticket_price
  WHERE id = p_player_id;

  RETURN v_ticket_id;
END;
$$ LANGUAGE plpgsql;
