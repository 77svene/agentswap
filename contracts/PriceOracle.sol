// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title PriceOracle
 * @dev Wraps Chainlink AggregatorV3Interface. Returns prices with 18 decimal precision.
 *      Used by the Agent to validate market conditions before executing limit orders.
 */
library PriceOracle {
    uint256 private constant PRECISION = 1e18;

    /**
     * @dev Returns the latest price from a Chainlink feed, scaled to 18 decimals.
     * @param feed Chainlink AggregatorV3Interface address
     * @return price Latest price with 18 decimal precision
     */
    function getPrice(address feed) internal view returns (uint256 price) {
        AggregatorV3Interface aggregator = AggregatorV3Interface(feed);
        (, int256 answer, , uint256 updatedAt, ) = aggregator.latestRoundData();
        require(answer > 0, "PriceOracle: invalid price");
        require(block.timestamp - updatedAt <= 3600, "PriceOracle: stale data");

        uint8 decimals = aggregator.decimals();
        // Scale to 18 decimals
        if (decimals < 18) {
            price = uint256(answer) * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            price = uint256(answer) / (10 ** (decimals - 18));
        } else {
            price = uint256(answer);
        }
    }

    /**
     * @dev Returns true if the two prices deviate by more than maxBps (basis points).
     * @param priceA First price (18 decimals)
     * @param priceB Second price (18 decimals)
     * @param maxBps Maximum acceptable deviation in basis points (e.g. 100 = 1%)
     */
    function deviatesExcessively(
        uint256 priceA,
        uint256 priceB,
        uint256 maxBps
    ) internal pure returns (bool) {
        if (priceA == 0 || priceB == 0) return true;
        uint256 diff = priceA > priceB ? priceA - priceB : priceB - priceA;
        return (diff * 10000) / priceA > maxBps;
    }
}
