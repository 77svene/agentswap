const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Vault", function () {
  let vault, agent, token, owner, alice, bob;

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("MockWETH", "mWETH", 18);

    const MockRouter = await ethers.getContractFactory("MockSwapRouter");
    const router = await MockRouter.deploy();

    const Agent = await ethers.getContractFactory("Agent");
    agent = await Agent.deploy(await router.getAddress());

    const Vault = await ethers.getContractFactory("Vault");
    vault = await Vault.deploy(
      await token.getAddress(),
      await agent.getAddress(),
      "AgentSwap Vault",
      "ASVT"
    );

    // Transfer agent ownership to Vault
    await agent.transferOwnership(await vault.getAddress());

    // Mint tokens to alice and bob
    await token.mint(alice.address, ethers.parseEther("1000"));
    await token.mint(bob.address,   ethers.parseEther("1000"));
  });

  it("mints shares 1:1 on first deposit", async function () {
    const amount = ethers.parseEther("100");
    await token.connect(alice).approve(await vault.getAddress(), amount);
    await vault.connect(alice).deposit(amount);
    expect(await vault.balanceOf(alice.address)).to.equal(amount);
    expect(await vault.tvl()).to.equal(amount);
  });

  it("mints proportional shares on subsequent deposits", async function () {
    const first = ethers.parseEther("100");
    const second = ethers.parseEther("200");
    await token.connect(alice).approve(await vault.getAddress(), first);
    await vault.connect(alice).deposit(first);

    await token.connect(bob).approve(await vault.getAddress(), second);
    await vault.connect(bob).deposit(second);

    const aliceShares = await vault.balanceOf(alice.address);
    const bobShares   = await vault.balanceOf(bob.address);
    // Bob deposited 2x, so should hold 2x shares
    expect(bobShares).to.equal(aliceShares * 2n);
  });

  it("allows withdrawal and returns correct token amount", async function () {
    const amount = ethers.parseEther("100");
    await token.connect(alice).approve(await vault.getAddress(), amount);
    await vault.connect(alice).deposit(amount);

    const shares = await vault.balanceOf(alice.address);
    await vault.connect(alice).withdraw(shares);

    expect(await vault.balanceOf(alice.address)).to.equal(0n);
    expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("1000"));
  });

  it("reverts withdraw with insufficient shares", async function () {
    await expect(vault.connect(alice).withdraw(1n))
      .to.be.revertedWith("Vault: insufficient shares");
  });

  it("reverts deposit of zero", async function () {
    await expect(vault.connect(alice).deposit(0n))
      .to.be.revertedWith("Vault: zero amount");
  });

  it("sharePrice returns 1e18 when empty", async function () {
    expect(await vault.sharePrice()).to.equal(ethers.parseEther("1"));
  });
});
