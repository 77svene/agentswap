# AgentSwap — Autonomous ERC-8004 Liquidity Agent

> **lablab.ai · AI Trading Agents ERC-8004 Hackathon · Best ERC-8004 Trading Agent · $55,000 SURGE**

The first trustless agent that continuously rebalances Uniswap V3 liquidity positions using on-chain limit orders executed via ERC-8004, eliminating custodial keys and enabling permissionless, yield-optimizing swaps.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Off-Chain Worker (Node.js)                      │
│  · WebSocket subscription → Alchemy              │
│  · The Graph → pool tick / liquidity queries     │
│  · Volatility calc (std dev, 100-tick window)    │
│  · Triggers rebalance when drift > 1.5%          │
│  · Calls Vault.placeOrder() via ethers.js        │
└────────────────────┬────────────────────────────┘
                     │ signed tx
┌────────────────────▼────────────────────────────┐
│  Vault.sol (ERC-20 share token)                  │
│  · deposit() / withdraw()                        │
│  · placeOrder() → calls Agent.executeLimitOrder() │
│  · sharePrice() based on live TVL                │
└────────────────────┬────────────────────────────┘
                     │ delegatecall
┌────────────────────▼────────────────────────────┐
│  Agent.sol (ERC-8004)                            │
│  · executeLimitOrder(tokenIn, tokenOut, ...)     │
│  · Uniswap V3 ExactInputSingle                   │
│  · Slippage enforced on-chain                    │
│  · Chainlink oracle validation (PriceOracle.sol) │
└─────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Install dependencies

```bash
npm install
cd frontend && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in ALCHEMY_URL, ALCHEMY_SEPOLIA_URL, DEPLOYER_PRIVATE_KEY, ETHERSCAN_API_KEY
```

### 3. Run tests

```bash
npm test
```

### 4. Deploy to Sepolia

```bash
npm run deploy
# Copy AGENT_ADDRESS and VAULT_ADDRESS into .env
```

### 5. Start worker + backend

```bash
npm run dev
# Worker: monitors pool ticks and places limit orders autonomously
# Backend: exposes /status, /deposit, /set-params on port 3000
```

### 6. Start frontend

```bash
cd frontend && npm run dev
# Open http://localhost:5173
```

---

## Contracts

| Contract | Description |
|---|---|
| `Agent.sol` | ERC-8004 agent. Executes limit-order swaps via Uniswap V3. Owned by Vault. |
| `Vault.sol` | ERC-20 share vault. Handles deposits, withdrawals, and order routing. |
| `PriceOracle.sol` | Chainlink aggregator wrapper. Validates market conditions before orders. |

---

## Key Design Decisions

**No custodial keys.** Agent.sol is owned by the Vault contract. Users deposit into the Vault and hold shares — no private key exposure.

**On-chain slippage enforcement.** `minAmountOut` is enforced at the EVM level inside `Agent.executeLimitOrder()`. No off-chain trust required.

**Volatility-triggered rebalancing.** The worker calculates standard deviation across the last 100 pool ticks. Only triggers when price drift exceeds 1.5% from the rolling mean — avoids churn in sideways markets.

**Chainlink validation.** `PriceOracle.sol` checks Chainlink feeds before every swap. Rejects stale data (>1hr) and excessive deviation (>1%) from oracle price.

---

## Live Demo

- Contracts deployed on **Sepolia testnet**
- Frontend live at: [https://agentswap.vercel.app](https://agentswap.vercel.app)
- GitHub: [https://github.com/77svene/agentswap](https://github.com/77svene/agentswap)

---

## Tech Stack

- Solidity 0.8.24 · Hardhat · OpenZeppelin · Uniswap V3 SDK
- Node.js · ethers.js v6 · The Graph · Alchemy WebSocket
- React + Vite · viem · wagmi
- Chainlink Price Feeds · better-sqlite3 · Express
