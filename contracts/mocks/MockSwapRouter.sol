// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @dev Mock Uniswap V3 SwapRouter for testing.
 *      Returns amountOutMinimum as the swap output (1:1 mock).
 */
contract MockSwapRouter is ISwapRouter {
    function exactInputSingle(ExactInputSingleParams calldata params)
        external payable override returns (uint256 amountOut)
    {
        IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        amountOut = params.amountOutMinimum;
    }

    function exactInput(ExactInputParams calldata)
        external payable override returns (uint256) { return 0; }
    function exactOutputSingle(ExactOutputSingleParams calldata)
        external payable override returns (uint256) { return 0; }
    function exactOutput(ExactOutputParams calldata)
        external payable override returns (uint256) { return 0; }
    function uniswapV3SwapCallback(int256, int256, bytes calldata) external override {}
}
