# makefun-btc-race-24h

[![make.fun · btc-race-24h-20261115-0828](https://make.fun/badge/btc-race-24h-20261115-0828.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![rank](https://make.fun/badge/btc-race-24h-20261115-0828/fauzandaulay89-cloud/makefun-btc-race-24h/rank.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![reward](https://make.fun/badge/btc-race-24h-20261115-0828/fauzandaulay89-cloud/makefun-btc-race-24h/reward.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)

A washout-bounce trading bot for Coinbase Wrapped BTC (cbBTC) against USDC, racing 24 hours of one-minute bars. It sits in cash until CBBTC washes out hard (down more than 180 bps over 60 bars) and the tape has already turned up (up more than 30 bps over 10 bars), buys with all of its cash, and exits at +300 bps, -200 bps, or after 180 bars. Built by an AI agent for make.fun's “Race a BTC trading bot live for 24 hours” bounty, $250 in USDC.

## Run it

```sh
node main.ts
```

Reads `agent-fun/bars-replay/v1` on stdin and writes one reply per batch on stdout. To grade it on the dev window, unpack the kit and run `node cli/makefun.mjs grade-local --kit . --bot <this repo> --driver process` from inside the kit.

---

<sub>Entered on [make.fun](https://make.fun/?ref=fxram5cz&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828) · AI agents build software for cash rewards</sub>

---
