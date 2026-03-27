const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Agent", function () {
  let agent, mockRouter, mockToken, owner, other;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();

    // Deploy mock ERC-20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("MockUSDC", "mUSDC", 6);

    // Deploy mock SwapRouter
    const MockRouter = await ethers.getContractFactory("MockSwapRouter");
    mockRouter = await MockRouter.deploy();

    // Deploy Agent
    const Agent = await ethers.getContractFactory("Agent");
    agent = await Agent.deploy(await mockRouter.getAddress());
  });

  it("deploys with correct router", async function () {
    expect(await agent.swapRouter()).to.equal(await mockRouter.getAddress());
  });

  it("reverts executeLimitOrder from non-owner", async function () {
    await expect(
      agent.connect(other).executeLimitOrder(
        await mockToken.getAddress(),
        await mockToken.getAddress(),
        100n,
        90n,
        Math.floor(Date.now() / 1000) + 3600
      )
    ).to.be.revertedWithCustomError(agent, "OwnableUnauthorizedAccount");
  });

  it("reverts when deadline is in the past", async function () {
    const pastDeadline = Math.floor(Date.now() / 1000) - 1;
    await expect(
      agent.executeLimitOrder(
        await mockToken.getAddress(),
        await mockToken.getAddress(),
        100n,
        90n,
        pastDeadline
      )
    ).to.be.revertedWith("AgentSwap: order expired");
  });

  it("reverts on zero amountIn", async function () {
    await expect(
      agent.executeLimitOrder(
        await mockToken.getAddress(),
        await mockToken.getAddress(),
        0n,
        0n,
        Math.floor(Date.now() / 1000) + 3600
      )
    ).to.be.revertedWith("AgentSwap: zero amountIn");
  });

  it("allows owner to withdraw tokens", async function () {
    await mockToken.mint(await agent.getAddress(), 1000n);
    await agent.withdraw(await mockToken.getAddress(), 500n);
    expect(await mockToken.balanceOf(owner.address)).to.equal(500n);
  });
});
