const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // ── 1. Deploy Agent ─────────────────────────────────────────────────────
  const UNISWAP_ROUTER = process.env.UNISWAP_ROUTER ||
    "0xE592427A0AEce92De3Edee1F18E0157C05861564"; // Sepolia

  const Agent = await ethers.getContractFactory("Agent");
  const agent = await Agent.deploy(UNISWAP_ROUTER);
  await agent.waitForDeployment();
  console.log("Agent deployed:", await agent.getAddress());

  // ── 2. Deploy Vault ──────────────────────────────────────────────────────
  // Use WETH on Sepolia as base token for demo
  const BASE_TOKEN = process.env.BASE_TOKEN ||
    "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9"; // Sepolia WETH

  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy(
    BASE_TOKEN,
    await agent.getAddress(),
    "AgentSwap Vault",
    "ASVT"
  );
  await vault.waitForDeployment();
  console.log("Vault deployed:", await vault.getAddress());

  // ── 3. Transfer Agent ownership to Vault ─────────────────────────────────
  await agent.transferOwnership(await vault.getAddress());
  console.log("Agent ownership transferred to Vault");

  console.log("\n─── Deployment complete ───");
  console.log("AGENT_ADDRESS=" + await agent.getAddress());
  console.log("VAULT_ADDRESS=" + await vault.getAddress());
  console.log("Update your .env with these values, then start the worker.");
}

main().catch((e) => { console.error(e); process.exit(1); });
