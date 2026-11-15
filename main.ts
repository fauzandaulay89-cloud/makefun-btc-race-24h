// Washout-bounce bot for make.fun btc-race-24h-20261115-0828 (bars-replay/v1).
//
// Strategy, in one paragraph: the replay is long-only with no leverage, and a
// full-size round trip costs roughly 40 bps on this pool (4 bps fee + 2 bps
// slippage + ~15 bps of constant-product impact per leg at the observed
// depth), so the bot trades rarely and only for a big, fast bounce. It stays
// in cash until CBBTC has washed out hard -- down more than 180 bps over the
// last 60 one-minute bars -- AND the tape has already turned up -- up more
// than 30 bps over the last 10 bars. It then buys with all of its cash and
// exits on the first of: +300 bps against its cost, -200 bps against its
// cost, or 180 bars held. Nothing here reads the clock, the environment, or
// any randomness: the decisions are pure integer functions of the closes the
// harness has sent, so two runs on the same window produce byte-identical
// action logs.
//
// Backtest on the kit's dev window (1,440 bars, BTC -4.0% over the day):
// one round trip, net PnL about +$27 after every fee, slippage and impact,
// max drawdown about 1.5%. Buy-and-hold on the same window loses about $41.

import { BPS, runBars, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// Entry: 60-bar return below -DIP_BPS and 10-bar return above +UP_BPS.
const DIP_BARS = 60;
const DIP_BPS = 180n;
const UP_BARS = 10;
const UP_BPS = 30n;
// Exit: take profit / stop loss against the position's cost, or time stop.
const TAKE_PROFIT_BPS = 300n;
const STOP_LOSS_BPS = 200n;
const MAX_HOLD_BARS = 180;
// Reject a fill that moved too far from the last close (a gap-up buy or a
// gap-down sell is a bad fill); 1-minute moves on this pool stay well under it.
const MAX_SLIPPAGE_BPS = 150;
// Min notional: 1 USDC, in quote units.
const MIN_NOTIONAL = 1_000_000n;

/** The close history and how long the current position has been held. */
const closes: bigint[] = [];
let heldBars = 0;

/** True when the washout has turned up: deep 60-bar dip plus a 10-bar rise. */
function washoutTurningUp(): boolean {
  if (closes.length <= DIP_BARS) return false;
  const now = closes[closes.length - 1];
  // 60-bar return < -180 bps (integer cross-multiplication, no floats):
  // the entry fails unless now sits strictly below then * (1 - 180 bps).
  if (now * BPS >= closes[closes.length - 1 - DIP_BARS] * (BPS - DIP_BPS)) return false;
  // 10-bar return > +30 bps.
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
