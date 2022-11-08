//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20VotesComp.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

import "hardhat/console.sol";

contract YMEME is ERC20VotesComp, Ownable{
    using SafeMath for uint256;
    
    uint public buyFees;
    uint public sellFees;
    uint public totalFee;
    uint256 public swapTokensAtAmount = 1000e18;
    uint256 public tokenMaxCap = 2_000_000_000 * 10** decimals();

    bool public inSwapAndLiquify = false;

    address public timelock;
    address public feeWallet;
    address public uniswapV2Pair;

    mapping(address => bool) public isAutomatedMarketMakerPair;
    mapping(address => bool) public isExcludedFromTxFees;

    modifier isOwnerOrTimelock() {
        require(msg.sender == owner() || msg.sender == timelock, "Not owner or timelock");
        _;
    }

    constructor(address _router) ERC20("Yearn Meme Finance", "yMEME") ERC20Permit("yMEME") {
        _mint(msg.sender, 1_000_000_000 * 10 ** decimals());
        feeWallet = msg.sender;

        uniswapV2Pair = IUniswapV2Factory(IUniswapV2Router02(_router).factory()).createPair(address(this), IUniswapV2Router02(_router).WETH());

        isExcludedFromTxFees[address(this)] = true;

        _setAutomatedMarketMakerPair(uniswapV2Pair, true);
    }

    function _transfer( address sender, address recipient, uint256 amount ) internal virtual override {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");
        require(balanceOf(sender) >= amount, "ERC20: transfer amount exceeds balance");

        if (amount == 0) {
            super._transfer(sender, recipient, 0);
            return;
        }

        uint256 totalContractFee = shouldTakeFee(sender, recipient) ? takeFee(sender, recipient, amount) : 0;
        super._transfer(sender, feeWallet, totalContractFee);
        super._transfer(sender, recipient, amount.sub(totalContractFee));
    }

    function shouldTakeFee(address sender, address recipient) internal view returns (bool) {
        return !isExcludedFromTxFees[sender] && !isExcludedFromTxFees[recipient];
    }

    function calcPercent(uint amount, uint percentBP) internal pure returns (uint) {
        return amount.mul(percentBP).div(10000);
    }

    function takeFee(address sender, address recipient, uint256 amount) internal view returns (uint256) {
        uint appliedFee;
        if(isAutomatedMarketMakerPair[sender]) {
            appliedFee = buyFees;
        } 
        else if(isAutomatedMarketMakerPair[recipient]) { 
            appliedFee = sellFees;
        } 
        return calcPercent(amount, appliedFee);
    }

    function mint(address _user, uint256 amount) external isOwnerOrTimelock {
        require(totalSupply().add(amount) <= tokenMaxCap, "Max cap reached");
        _mint(_user, amount);
    }

    function setTimelock(address _timelock) external isOwnerOrTimelock {
        timelock = _timelock;
    }

    function setFees(uint _buyFees, uint _sellFees) external isOwnerOrTimelock {
        require(_buyFees <= 500 && _sellFees <= 500, "Buy fees too high");
        buyFees = _buyFees;
        sellFees = _sellFees;
    }

    function setFeeWallet(address _feeWallet) external isOwnerOrTimelock {
        feeWallet = _feeWallet;
    }

    function toggleExcludeFromFees(address _address) external isOwnerOrTimelock {
        isExcludedFromTxFees[_address] = !isExcludedFromTxFees[_address];
    }

    function setSwapTokensAtAmount(uint256 amount) external isOwnerOrTimelock {
        swapTokensAtAmount = amount;
    }

    function setAutomatedMarketMakerPair(address pair, bool value) external isOwnerOrTimelock {
        require(pair != uniswapV2Pair, "The Uniswap pair cannot be removed from automatedMarketMakerPairs");
        _setAutomatedMarketMakerPair(pair, value);
    }

    function _setAutomatedMarketMakerPair(address pair, bool value) private {
        require(isAutomatedMarketMakerPair[pair] != value, "NNN: Automated market maker pair is already set to that value");
        isAutomatedMarketMakerPair[pair] = value;
    }

}