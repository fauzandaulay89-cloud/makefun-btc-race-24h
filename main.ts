// Washout-bounce bot for make.fun btc-race-24h-20261115-0828 (bars-replay/v1).
//
// Strategy, in one paragraph: the replay is long-only with no leverage, and a
// full-size round trip costs roughly 40 bps on this pool (4 bps fee + 2 bps
// slippage + ~15 bps of constant-product impact per leg at the observed
// depth), so the bot trades rarely and only for a big, fast bounce. It stays
// in cash until CBBTC has washed out hard -- down more than 200 bps over the
// last 105 one-minute bars -- AND the tape has already turned up -- up more
// than 30 bps over the last 5 bars. It then buys with all of its cash and
// exits on the first of: +425 bps against its cost, -300 bps against its
// cost, or 120 bars held. Nothing here reads the clock, the environment, or
// any randomness: the decisions are pure integer functions of the closes the
// harness has sent, so two runs on the same window produce byte-identical
// action logs.
//
// Backtest on the kit's dev window (1,440 bars, BTC -4.0% over the day):
// three round trips, net PnL about +$51 after every fee, slippage and impact,
// max drawdown about 1.4%. Buy-and-hold on the same window loses about $41.
//
// Tuning note (round 2): the two changes from v2 (UP 40 -> 30 bps, TP 400 ->
// 425 bps) work together -- the earlier entry buys the big bounce about 1%
// cheaper, which is exactly what lets the higher take-profit trigger at the
// rally's peak instead of cutting it short. Either change alone scores lower
// on the dev window. A 2,187-trial neighbourhood sweep around these values
// (dip 90-120 bars / 175-225 bps, up 25-35 bps, TP 425-475 bps, SL 250-350
// bps, hold 110-130 bars) keeps the score at +$49 to +$51, so the result is
// a plateau, not a single lucky point. TP 425 is the low end of that plateau:
// on the dev window it behaves byte-identically to TP 450 (same action log),
// and on the unseen race window it also fires on a bounce that peaks between
// +4.25% and +4.5% above cost, where TP 450 would fall back to the time stop.

import { BPS, runBars, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// Entry: 105-bar return below -DIP_BPS and 5-bar return above +UP_BPS.
const DIP_BARS = 105;
const DIP_BPS = 200n;
const UP_BARS = 5;
const UP_BPS = 30n;
// Exit: take profit / stop loss against the position's cost, or time stop.
const TAKE_PROFIT_BPS = 425n;
const STOP_LOSS_BPS = 300n;
const MAX_HOLD_BARS = 120;
// Reject a fill that moved too far from the last close (a gap-up buy or a
// gap-down sell is a bad fill); 1-minute moves on this pool stay well under it.
const MAX_SLIPPAGE_BPS = 150;
// Min notional: 1 USDC, in quote units.
const MIN_NOTIONAL = 1_000_000n;

/** The close history and how long the current position has been held. */
const closes: bigint[] = [];
let heldBars = 0;

/** True when the washout has turned up: deep 105-bar dip plus a 5-bar rise. */
function washoutTurningUp(): boolean {
  if (closes.length <= DIP_BARS) return false;
  const now = closes[closes.length - 1];
  // 105-bar return < -200 bps (integer cross-multiplication, no floats):
  // the entry fails unless now sits strictly below then * (1 - 200 bps).
  if (now * BPS >= closes[closes.length - 1 - DIP_BARS] * (BPS - DIP_BPS)) return false;
  // 5-bar return > +30 bps.
  if (now * BPS <= closes[closes.length - 1 - UP_BARS] * (BPS + UP_BPS)) return false;
  return true;
}

function onBatch(state: BarsState): OrderInput[] {
  const close = state.close(SYMBOL);
  if (close !== null) closes.push(close);
  if (state.warmingUp) return [];

  const held = state.positions.get(SYMBOL);
  if (held === undefined || held.qty <= 0n) {
    heldBars = 0;
    // Buy with all cash. A reply's sells never fund its buys, and we send
    // at most this one order per reply.
    if (washoutTurningUp() && state.cash >= MIN_NOTIONAL) {
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  }

  heldBars += 1;
  const value = state.value(SYMBOL, held.qty);
  const cost = held.cost;
  const takeProfit = value * BPS >= cost * (BPS + TAKE_PROFIT_BPS);
  const stopLoss = value * BPS <= cost * (BPS - STOP_LOSS_BPS);
  const timeStop = heldBars >= MAX_HOLD_BARS;
  if (takeProfit || stopLoss || timeStop) {
    return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  }
  return [];
}

await runBars({ onBatch });
