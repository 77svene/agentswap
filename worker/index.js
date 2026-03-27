/**
 * AgentSwap Off-Chain Worker
 * Monitors Uniswap V3 pool ticks via Alchemy WebSocket,
 * queries The Graph for current state, calculates optimal
 * rebalance windows, and submits signed limit orders to the Vault.
 */
require("dotenv").config({ path: "../.env" });
const { ethers } = require("ethers");
const { request, gql } = require("graphql-request");
const Database = require("better-sqlite3");

const VAULT_ABI = require("../artifacts/contracts/Vault.sol/Vault.json").abi;
const AGENT_ABI = require("../artifacts/contracts/Agent.sol/Agent.json").abi;

const {
  ALCHEMY_URL,
  DEPLOYER_PRIVATE_KEY,
  VAULT_ADDRESS,
  CHAINLINK_ETH_USD,
} = process.env;

const GRAPH_URL =
  "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3";
const WETH_USDC_POOL = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";
const TICK_WINDOW   = 100;   // price ticks to track for volatility
const SLIPPAGE_BPS  = 50;    // 0.5% max slippage
const REBALANCE_THRESHOLD = 0.015; // 1.5% price drift triggers rebalance

const db = new Database("./worker-state.db");

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT,
      tokenOut TEXT,
      amountIn TEXT,
      minAmountOut TEXT,
      deadline INTEGER,
      txHash TEXT,
      status TEXT
    );
    CREATE TABLE IF NOT EXISTS ticks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT,
      tick INTEGER,
      sqrtPriceX96 TEXT
    );
  `);
}

function tickToPrice(tick) {
  return Math.pow(1.0001, tick);
}

function calcStdDev(arr) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

async function fetchPoolState() {
  const query = gql`
    query {
      pool(id: "${WETH_USDC_POOL}") {
        tick
        sqrtPrice
        liquidity
        token0Price
        token1Price
      }
    }
  `;
  const data = await request(GRAPH_URL, query);
  return data.pool;
}

async function shouldRebalance(provider, vaultContract) {
  const pool = await fetchPoolState();
  const currentPrice = parseFloat(pool.token0Price);

  // Load last 100 ticks from DB
  const rows = db.prepare("SELECT tick FROM ticks ORDER BY id DESC LIMIT ?").all(TICK_WINDOW);
  const prices = rows.map(r => tickToPrice(r.tick));

  // Persist current tick
  db.prepare("INSERT INTO ticks (ts, tick, sqrtPriceX96) VALUES (?, ?, ?)")
    .run(new Date().toISOString(), parseInt(pool.tick), pool.sqrtPrice);

  if (prices.length < 10) {
    console.log("[worker] Accumulating tick history...", prices.length, "samples");
    return { rebalance: false };
  }

  const mean   = prices.reduce((a, b) => a + b, 0) / prices.length;
  const stdDev = calcStdDev(prices);
  const drift  = Math.abs(currentPrice - mean) / mean;

  console.log(`[worker] Price: ${currentPrice.toFixed(6)} | Mean: ${mean.toFixed(6)} | StdDev: ${stdDev.toFixed(6)} | Drift: ${(drift * 100).toFixed(2)}%`);

  if (drift > REBALANCE_THRESHOLD) {
    const tvl = await vaultContract.tvl();
    const amountIn = tvl / 10n; // Use 10% of TVL per order
    return { rebalance: true, amountIn, currentPrice, stdDev };
  }
  return { rebalance: false };
}

async function main() {
  initDb();
  console.log("[worker] AgentSwap worker starting...");
  console.log("[worker] Vault:", VAULT_ADDRESS);

  const provider = new ethers.WebSocketProvider(ALCHEMY_URL);
  const signer   = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
  const vault    = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);

  console.log("[worker] Connected. Monitoring pool:", WETH_USDC_POOL);

  // Subscribe to pool Swap events via provider
  provider.on("block", async (blockNumber) => {
    console.log(`[worker] Block ${blockNumber}`);
    try {
      const { rebalance, amountIn, currentPrice } = await shouldRebalance(provider, vault);
      if (!rebalance) return;

      // Build limit order: sell WETH for USDC
      const USDC_SEPOLIA = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8";
      const deadline = Math.floor(Date.now() / 1000) + 300; // 5 min
      const minAmountOut = (amountIn * BigInt(10000 - SLIPPAGE_BPS)) / 10000n;

      console.log(`[worker] Placing order: ${ethers.formatEther(amountIn)} WETH -> USDC (min: ${ethers.formatUnits(minAmountOut, 6)})`);

      const tx = await vault.placeOrder(USDC_SEPOLIA, amountIn, minAmountOut, deadline);
      const receipt = await tx.wait();

      db.prepare("INSERT INTO orders (ts, tokenOut, amountIn, minAmountOut, deadline, txHash, status) VALUES (?,?,?,?,?,?,?)")
        .run(new Date().toISOString(), USDC_SEPOLIA, amountIn.toString(), minAmountOut.toString(), deadline, receipt.hash, "confirmed");

      console.log(`[worker] Order confirmed. tx: ${receipt.hash}`);
    } catch (e) {
      console.error("[worker] Error:", e.message);
    }
  });

  provider.on("error", (e) => console.error("[worker] Provider error:", e));
}

main().catch(e => { console.error("[worker] FATAL:", e); process.exit(1); });
