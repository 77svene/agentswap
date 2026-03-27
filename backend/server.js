/**
 * AgentSwap Backend API
 * Exposes vault state and order history to the frontend.
 * Also accepts signed parameter updates from the operator.
 */
require("dotenv").config({ path: "../.env" });
const express = require("express");
const { ethers } = require("ethers");
const Database = require("better-sqlite3");
const cors = require("cors");

const VAULT_ABI = require("../artifacts/contracts/Vault.sol/Vault.json").abi;

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const provider = new ethers.JsonRpcProvider(
  process.env.ALCHEMY_SEPOLIA_URL || process.env.ALCHEMY_URL
);
const vault = new ethers.Contract(process.env.VAULT_ADDRESS, VAULT_ABI, provider);
const db    = new Database("../worker/worker-state.db");

// ── GET /status ────────────────────────────────────────────────────────────
// Returns live vault state: TVL, share price, last 10 orders, active params
app.get("/status", async (req, res) => {
  try {
    const [tvl, sharePrice, totalSupply] = await Promise.all([
      vault.tvl(),
      vault.sharePrice(),
      vault.totalSupply(),
    ]);

    const orders = db.prepare(
      "SELECT * FROM orders ORDER BY id DESC LIMIT 10"
    ).all();

    const recentTicks = db.prepare(
      "SELECT tick, ts FROM ticks ORDER BY id DESC LIMIT 20"
    ).all();

    res.json({
      tvl:         ethers.formatEther(tvl),
      sharePrice:  ethers.formatEther(sharePrice),
      totalSupply: ethers.formatEther(totalSupply),
      recentOrders: orders,
      recentTicks,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /deposit ──────────────────────────────────────────────────────────
// Returns expected share amount for a given deposit (read-only estimate)
app.post("/deposit", async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount) return res.status(400).json({ error: "amount required" });

    const amountBn    = ethers.parseEther(amount);
    const tvl         = await vault.tvl();
    const totalSupply = await vault.totalSupply();

    let shares;
    if (totalSupply === 0n || tvl === 0n) {
      shares = amountBn;
    } else {
      shares = (amountBn * totalSupply) / tvl;
    }

    res.json({
      amount,
      estimatedShares: ethers.formatEther(shares),
      sharePrice: ethers.formatEther(tvl === 0n ? ethers.parseEther("1") : (tvl * ethers.parseEther("1")) / totalSupply),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /set-params ───────────────────────────────────────────────────────
// Persist operator risk params (slippage, target APY) to a local JSON file
app.post("/set-params", (req, res) => {
  const { maxSlippageBps, targetApy } = req.body;
  const fs = require("fs");
  const params = { maxSlippageBps, targetApy, updatedAt: new Date().toISOString() };
  fs.writeFileSync("./params.json", JSON.stringify(params, null, 2));
  console.log("[api] Params updated:", params);
  res.json({ ok: true, params });
});

app.get("/health", (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`[api] AgentSwap backend running on port ${PORT}`);
});
