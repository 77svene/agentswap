// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AgentSwap ERC-8004 Agent
 * @dev ERC-8004 compliant agent that executes limit-order swaps via Uniswap V3.
 *      Holds user funds; only the Vault (owner) can invoke execute().
 *      Slippage is enforced on-chain via minAmountOut.
 */
contract Agent is Ownable {
    using SafeERC20 for IERC20;

    ISwapRouter public immutable swapRouter;
    uint24 public constant POOL_FEE = 3000; // 0.3%

    event LimitOrderExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 deadline
    );

    constructor(address _swapRouter) Ownable(msg.sender) {
        require(_swapRouter != address(0), "AgentSwap: zero router");
        swapRouter = ISwapRouter(_swapRouter);
    }

    /**
     * @dev Execute a limit-order swap. Called by Vault on behalf of users.
     * @param tokenIn  ERC-20 to sell
     * @param tokenOut ERC-20 to buy
     * @param amountIn Exact amount of tokenIn to swap
     * @param minAmountOut Minimum acceptable tokenOut (slippage guard)
     * @param deadline Unix timestamp after which the order reverts
     * @return amountOut Actual tokenOut received
     */
    function executeLimitOrder(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external onlyOwner returns (uint256 amountOut) {
        require(block.timestamp <= deadline, "AgentSwap: order expired");
        require(amountIn > 0, "AgentSwap: zero amountIn");

        // Pull tokens from caller (Vault)
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        // Approve router
        IERC20(tokenIn).safeIncreaseAllowance(address(swapRouter), amountIn);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: POOL_FEE,
            recipient: address(this),
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0
        });

        amountOut = swapRouter.exactInputSingle(params);
        require(amountOut >= minAmountOut, "AgentSwap: slippage exceeded");

        emit LimitOrderExecuted(tokenIn, tokenOut, amountIn, amountOut, deadline);
    }

    /**
     * @dev Withdraw any token held by the agent back to owner (Vault).
     */
    function withdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(msg.sender, amount);
    }

    receive() external payable {}
}
