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

contract Token is ERC20VotesComp, Ownable{
    using SafeMath for uint256;
    
    uint public buyFees;
    uint public sellFees;
    uint public totalFee;
    uint256 public swapTokensAtAmount = 1000e18;

    bool public inSwapAndLiquify = false;

    address public timelock;
    address public feeWallet;
    IUniswapV2Router02 public uniswapV2Router;
    address public uniswapV2Pair;
    address public WETH;

    mapping(address => bool) public isAutomatedMarketMakerPair;
    mapping(address => bool) public isExcludedFromTxFees;

    modifier isOwnerOrTimelock() {
        require(msg.sender == owner() || msg.sender == timelock, "Not owner or timelock");
        _;
    }

    constructor(string memory name, string memory symbol, uint _amount, address _router) ERC20(name, symbol) ERC20Permit(name) {
        _mint(msg.sender, _amount);
        feeWallet = msg.sender;
        IUniswapV2Router02 _uniswapV2Router = IUniswapV2Router02(_router);

        WETH = _uniswapV2Router.WETH();

        uniswapV2Pair = IUniswapV2Factory(_uniswapV2Router.factory()).createPair(address(this), WETH);

        uniswapV2Router = _uniswapV2Router;

        isExcludedFromTxFees[address(this)] = true;

        _setAutomatedMarketMakerPair(uniswapV2Pair, true);
    }

    function _transfer( address sender, address recipient, uint256 amount ) internal virtual override {
        super._transfer(sender, recipient, amount);
        // if (inSwapAndLiquify) {
        //     super._transfer(sender, recipient, amount);
        // }

        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");
        require(balanceOf(sender) >= amount, "ERC20: transfer amount exceeds balance");

        if (amount == 0) {
            super._transfer(sender, recipient, 0);
            return;
        }
        
        bool canSwap = balanceOf(address(this)) >= swapTokensAtAmount;
        console.log("swap tokens at amount ", swapTokensAtAmount);
        console.log("contractTokenBalance ", balanceOf(address(this)));
        console.log("in swap ", inSwapAndLiquify);
        console.log("can swap ", canSwap);
        console.log("owner ", owner());
        console.log("sender ", sender);
        console.log("recipient ", recipient);
        console.log("!isAutomatedMarketMakerPair[sender] ", !isAutomatedMarketMakerPair[sender]);

        
        if (
            canSwap &&
            !inSwapAndLiquify &&
            !isAutomatedMarketMakerPair[sender]
        ) {
            inSwapAndLiquify = true;

            swapTokensForEth(balanceOf(address(this)));
            // payable(feeWallet).transfer(address(this).balance);

            inSwapAndLiquify = false;
        }

        uint256 totalContractFee = shouldTakeFee(sender, recipient) ? takeFee(sender, recipient, amount) : 0;
        console.log("total contract fee ", totalContractFee);
        console.log("sender ", sender, address(this));
        console.log("recipient ", recipient);
        console.log("amount ", amount, balanceOf(sender));
        console.log("before balance", balanceOf(sender), balanceOf(recipient));
        super._transfer(sender, address(this), totalContractFee);
        super._transfer(sender, recipient, amount.sub(totalContractFee));
        console.log("final balance", balanceOf(sender), balanceOf(recipient));
        console.log("HERERE 3");
    }

    function swapTokensForEth(uint256 tokenAmount) private {
        // generate the pancakeswap pair path of token -> weth
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = uniswapV2Router.WETH();

        _approve(address(this), address(uniswapV2Router), tokenAmount);

        // make the swap
        console.log("HERERE", tokenAmount);
        uniswapV2Router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0, // accept any amount of ETH
            path,
            address(this),
            block.timestamp * 2
        );
        console.log("HERERE 2");

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