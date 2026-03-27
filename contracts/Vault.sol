// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./Agent.sol";

/**
 * @title AgentSwap Vault
 * @dev ERC-20 share token. Users deposit baseToken, receive shares proportional
 *      to their ownership. The Vault forwards swap calls to the Agent and tracks
 *      share accounting. Reentrancy-safe via OpenZeppelin ReentrancyGuard.
 */
contract Vault is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable baseToken;
    Agent  public immutable agent;

    event Deposited(address indexed user, uint256 amount, uint256 shares);
    event Withdrawn(address indexed user, uint256 shares, uint256 amount);
    event AgentOrderPlaced(address tokenOut, uint256 amountIn, uint256 minOut, uint256 deadline);

    constructor(
        address _baseToken,
        address _agent,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        require(_baseToken != address(0), "Vault: zero baseToken");
        require(_agent    != address(0), "Vault: zero agent");
        baseToken = IERC20(_baseToken);
        agent     = Agent(payable(_agent));
    }

    // ─── User actions ────────────────────────────────────────────────────────

    /**
     * @dev Deposit baseToken, receive vault shares.
     *      Shares are minted proportional to current TVL.
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Vault: zero amount");

        uint256 supply = totalSupply();
        uint256 balance = baseToken.balanceOf(address(this));

        baseToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 shares = (supply == 0 || balance == 0)
            ? amount
            : (amount * supply) / balance;

        _mint(msg.sender, shares);
        emit Deposited(msg.sender, amount, shares);
    }

    /**
     * @dev Burn shares, receive proportional baseToken back.
     */
    function withdraw(uint256 shares) external nonReentrant {
        require(shares > 0, "Vault: zero shares");
        require(balanceOf(msg.sender) >= shares, "Vault: insufficient shares");

        uint256 supply  = totalSupply();
        uint256 balance = baseToken.balanceOf(address(this));
        uint256 amount  = (shares * balance) / supply;

        _burn(msg.sender, shares);
        baseToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, shares, amount);
    }

    // ─── Agent calls (owner = operator/deployer) ──────────────────────────────

    /**
     * @dev Instruct the Agent to execute a limit-order swap.
     *      Only the Vault owner (worker operator) can call this.
     * @param tokenOut   Token to receive
     * @param amountIn   Amount of baseToken to sell
     * @param minAmountOut Slippage floor
     * @param deadline   Expiry timestamp
     */
    function placeOrder(
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external onlyOwner nonReentrant returns (uint256 amountOut) {
        require(amountIn <= baseToken.balanceOf(address(this)), "Vault: insufficient balance");

        baseToken.safeIncreaseAllowance(address(agent), amountIn);
        amountOut = agent.executeLimitOrder(
            address(baseToken),
            tokenOut,
            amountIn,
            minAmountOut,
            deadline
        );

        emit AgentOrderPlaced(tokenOut, amountIn, minAmountOut, deadline);
    }

    /**
     * @dev Pull a token held by the Agent back into the Vault.
     */
    function recoverFromAgent(address token, uint256 amount) external onlyOwner {
        agent.withdraw(token, amount);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function tvl() external view returns (uint256) {
        return baseToken.balanceOf(address(this));
    }

    function sharePrice() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 1e18;
        return (baseToken.balanceOf(address(this)) * 1e18) / supply;
    }
}
