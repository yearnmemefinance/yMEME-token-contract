//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestToken is ERC20("Token", "TOK"), Ownable{
    uint8 decimalsNew;
    constructor(uint8 _decimals)
    {
        decimalsNew = _decimals;
        _mint(msg.sender, 250000 * 10**decimals());
    }

    function decimals() public view virtual override returns(uint8){
        return decimalsNew;
    }
}