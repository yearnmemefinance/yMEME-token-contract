const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber, utils } = require("ethers")
const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545"); 
// const nftABI = require("../artifacts/contracts/NFT.sol/NFT.json").abi;

const advanceBlock = () => new Promise((resolve, reject) => {
  web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_mine',
      id: new Date().getTime(),
  }, async (err, result) => {
      if (err) { return reject(err) }
      // const newBlockhash =await web3.eth.getBlock('latest').hash
      return resolve()
  })
})

const advanceBlocks = async (num) => {
  let resp = []
  for (let i = 0; i < num; i += 1) {
      resp.push(advanceBlock())
  }
  await Promise.all(resp)
}

const advancetime = (time) => new Promise((resolve, reject) => {
  web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      id: new Date().getTime(),
      params: [time],
  }, async (err, result) => {
      if (err) { return reject(err) }
      const newBlockhash = (await web3.eth.getBlock('latest')).hash

      return resolve(newBlockhash)
  })
})

function printTable(TokenReserve, ETHReserve, price) {
  console.table([
      ["LP TOKEN", "LP WETH Amount", "Price"],
      [TokenReserve, ETHReserve, `${price} ETH/TOKEN`]
  ]);
}

describe("Token", function () {
  const UNISWAPV2ROUTERADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  const FACTORY_ADDRESS        = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
  const WETH_ADDRESS           = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

  const formatDecimals  = 1000000000000000000;

  before(async() =>{

    const currentTime = Math.floor(Date.now() / 1000)

    const TOKEN = await ethers.getContractFactory("YMEME");
    token = await TOKEN.deploy(UNISWAPV2ROUTERADDRESS);
    await token.deployed();

    uniswapRouter  = await ethers.getContractAt("IUniswapV2Router02", UNISWAPV2ROUTERADDRESS);
    uniswapFactory = await ethers.getContractAt("IUniswapV2Factory", FACTORY_ADDRESS);
    wethAddress    = await uniswapRouter.WETH();
    pairAddress    = await uniswapFactory.getPair(wethAddress, token.address);
    uniswapPair    = await ethers.getContractAt("IUniswapV2Pair", pairAddress);

    accounts = await ethers.getSigners();

    await hre.tenderly.persistArtifacts({
      name: "Token",
      address:token.address
    });
    
  })

  it ("should print contract addresses", async () => {
    console.log({
      token: token.address,
    })
  })

  it("Should mint new tokens", async () => {
    const balBef = await token.balanceOf(accounts[0].address)
    await token.mint(accounts[0].address, ethers.utils.parseUnits("1000", 5))
    const balAft = await token.balanceOf(accounts[0].address)
    expect(balAft).to.equal(balBef.add(ethers.utils.parseUnits("1000", 5)))
    await expect(token.connect(accounts[1]).mint(accounts[1].address, ethers.utils.parseUnits("1000", 5))).to.be.revertedWith("Not owner or timelock")
    await expect(token.mint(accounts[1].address, ethers.utils.parseUnits("1000000000"))).to.be.revertedWith("Max cap reached")
  })

  it("Should be able to transfer tokens", async () => {
    await token.transfer(accounts[1].address, ethers.utils.parseUnits("100", 5))
    const bal = await token.balanceOf(accounts[1].address)
    expect(bal).to.equal(ethers.utils.parseUnits("100", 5))
    await token.connect(accounts[2]).approve(accounts[1].address, ethers.utils.parseUnits("100", 5))
    await token.transfer(accounts[2].address, ethers.utils.parseUnits("100", 5))
    await token.connect(accounts[1]).transferFrom(accounts[2].address, accounts[1].address, ethers.utils.parseUnits("100", 5))
    const bal2 = await token.balanceOf(accounts[1].address)
    expect(bal2).to.equal(ethers.utils.parseUnits("200", 5))
  })

  it("Should add liquidty", async () => {
    await token.approve(UNISWAPV2ROUTERADDRESS, ethers.utils.parseEther("1000000"))
    await uniswapRouter.addLiquidityETH(token.address, ethers.utils.parseEther("1000000"), 0, 0, accounts[0].address, (Date.now() + 100000), {value: ethers.utils.parseEther('10000')}); // provide 1000 WETH + 100000 token liquidity to uniswap
  })

  it("Should set fee", async () => {
    await token.setFees(200, 400)
    await token.setFeeWallet(accounts[5].address)
  })

  it("should take no tax on transfer", async function () {
    const balBef = await token.balanceOf(accounts[0].address)
    await token.transfer(accounts[1].address, ethers.utils.parseEther("100"));
    const balAft = await token.balanceOf(accounts[0].address)
    expect(balAft).to.equal(balBef.sub(ethers.utils.parseEther("100")))
  });

  it("Should take no buy/sell tax for exempted users", async () => {
    await token.toggleExcludeFromFees(accounts[3].address)

    const path = [token.address, wethAddress];
    tokenPrice = ((await uniswapRouter.getAmountsOut(ethers.utils.parseEther('1'), path))[1]) / formatDecimals;

    const tokenBalUserBef = await token.balanceOf(accounts[3].address)
    const tokenBalContractBef = await token.balanceOf(token.address)
    const tokenBalFeeBef = await token.balanceOf(accounts[5].address)

    await uniswapRouter.connect(accounts[3]).swapExactETHForTokensSupportingFeeOnTransferTokens(
      0, // accept any amount of Tokens
      path.reverse(),
      accounts[3].address,
      new Date().getTime(), {
          value: ethers.utils.parseEther((parseFloat(tokenPrice)*100).toString())
      }
    )

    const tokenBalUserAft = await token.balanceOf(accounts[3].address)
    const tokenBalContractAft = await token.balanceOf(token.address)
    const tokenBalFeeAft = await token.balanceOf(accounts[5].address)

    await token.transfer(accounts[3].address, ethers.utils.parseEther("100"));
    await token.connect(accounts[3]).approve(UNISWAPV2ROUTERADDRESS, ethers.utils.parseEther("100"));
    await uniswapRouter.connect(accounts[3]).swapExactTokensForETHSupportingFeeOnTransferTokens(
      ethers.utils.parseEther("100"),
      0, // accept any amount of ETH
      path.reverse(),
      accounts[3].address,
      new Date().getTime()
    )

    const tokenBalUserAft2 = await token.balanceOf(accounts[3].address)
    const tokenBalContractAft2 = await token.balanceOf(token.address)
    const tokenBalFeeAft2 = await token.balanceOf(accounts[5].address)

    let reserves = await uniswapPair.getReserves();
    tokenReserve = reserves['reserve0']/formatDecimals;
    ETHReserve   = reserves['reserve1']/formatDecimals;

    tokenPrice = ((await uniswapRouter.getAmountsOut(ethers.utils.parseEther('1'), path.reverse()))[1]) / formatDecimals;
    printTable(tokenReserve, ETHReserve, tokenPrice);

    console.log({
      tokenBalUserBef: ethers.utils.formatEther(tokenBalUserBef),
      tokenBalUserAft: ethers.utils.formatEther(tokenBalUserAft),
      tokenBalUserAft2: ethers.utils.formatEther(tokenBalUserAft2),
      tokenBalContractBef: ethers.utils.formatEther(tokenBalContractBef),
      tokenBalContractAft: ethers.utils.formatEther(tokenBalContractAft),
      tokenBalContractAft2: ethers.utils.formatEther(tokenBalContractAft2),
      tokenBalFeeBef: ethers.utils.formatEther(tokenBalFeeBef),
      tokenBalFeeAft: ethers.utils.formatEther(tokenBalFeeAft),
      tokenBalFeeAft2: ethers.utils.formatEther(tokenBalFeeAft2),
    })
  })

  it("Should sell tax for uniswap works ", async function () {
  
    let tokenPrice, ETHReserve, tokenReserve;
    const path = [token.address, wethAddress];
    await token.transfer(accounts[2].address, ethers.utils.parseEther("100"));
    expect(await token.balanceOf(accounts[2].address) / 10**18).to.equal(100);

    await token.connect(accounts[2]).approve(UNISWAPV2ROUTERADDRESS, ethers.utils.parseEther("100"));

    const tokenBalUserBef = await token.balanceOf(accounts[2].address);
    const tokenBalContractBef = await token.balanceOf(token.address);
    const tokenBalFeeBef = await token.balanceOf(accounts[5].address);

    await uniswapRouter.connect(accounts[2]).swapExactTokensForETHSupportingFeeOnTransferTokens(
        ethers.utils.parseEther("100"),
        0, // accept any amount of ETH
        path,
        accounts[2].address,
        new Date().getTime()
    )

    const tokenBalUserAft = await token.balanceOf(accounts[2].address);
    const tokenBalContractAft = await token.balanceOf(token.address);
    const tokenBalFeeAft = await token.balanceOf(accounts[5].address);

    let reserves = await uniswapPair.getReserves();
    tokenReserve = reserves['reserve0']/formatDecimals;
    ETHReserve   = reserves['reserve1']/formatDecimals;

    tokenPrice = ((await uniswapRouter.getAmountsOut(ethers.utils.parseEther('1'), path))[1]) / formatDecimals;
    printTable(tokenReserve, ETHReserve, tokenPrice);
    console.log({
      tokenBalUserBef: ethers.utils.formatEther(tokenBalUserBef),
      tokenBalUserAft: ethers.utils.formatEther(tokenBalUserAft),
      tokenBalContractBef: ethers.utils.formatEther(tokenBalContractBef),
      tokenBalContractAft: ethers.utils.formatEther(tokenBalContractAft),
      tokenBalFeeBef: ethers.utils.formatEther(tokenBalFeeBef),
      tokenBalFeeAft: ethers.utils.formatEther(tokenBalFeeAft),
    })
  });

  it("should take buy tax on uniswap ", async function () {
    const path = [token.address, wethAddress];

    tokenPrice = ((await uniswapRouter.getAmountsOut(ethers.utils.parseEther('1'), path))[1]) / formatDecimals;
    
    const tokenBalUserBef = await token.balanceOf(accounts[1].address);
    const tokenBalContractBef = await token.balanceOf(token.address);
    const tokenBalFeeBef = await token.balanceOf(accounts[5].address);

    await uniswapRouter.connect(accounts[1]).swapExactETHForTokensSupportingFeeOnTransferTokens(
      0, // accept any amount of Tokens
      path.reverse(),
      accounts[1].address,
      new Date().getTime(), {
          value: ethers.utils.parseEther((parseFloat(tokenPrice)*100).toString())
      }
    )

    const tokenBalUserAft = await token.balanceOf(accounts[1].address);
    const tokenBalContractAft = await token.balanceOf(token.address);
    const tokenBalFeeAft = await token.balanceOf(accounts[5].address);

    let reserves = await uniswapPair.getReserves();
    tokenReserve = reserves['reserve0']/formatDecimals;
    ETHReserve   = reserves['reserve1']/formatDecimals;

    tokenPrice = ((await uniswapRouter.getAmountsOut(ethers.utils.parseEther('1'), path.reverse()))[1]) / formatDecimals;
    printTable(tokenReserve, ETHReserve, tokenPrice);

    console.log({
      tokenBalUserBef: ethers.utils.formatEther(tokenBalUserBef),
      tokenBalUserAft: ethers.utils.formatEther(tokenBalUserAft),
      tokenBalContractBef: ethers.utils.formatEther(tokenBalContractBef),
      tokenBalContractAft: ethers.utils.formatEther(tokenBalContractAft),
      tokenBalFeeBef: ethers.utils.formatEther(tokenBalFeeBef),
      tokenBalFeeAft: ethers.utils.formatEther(tokenBalFeeAft),
    })
  });

  it("Should transfer tokens to fee account after swapping", async() => {
    const path = [token.address, wethAddress];

    await token.setSwapTokensAtAmount(ethers.utils.parseEther("10"));
    await token.transfer(accounts[6].address, ethers.utils.parseEther("1000"));
    await token.connect(accounts[6]).approve(UNISWAPV2ROUTERADDRESS, ethers.utils.parseEther("1000"));

    const tokenBalUserBef = await token.balanceOf(accounts[6].address);
    const tokenBalContractBef = await token.balanceOf(token.address);
    const tokenBalFeeWalletBef = await token.balanceOf(accounts[5].address);

    await uniswapRouter.connect(accounts[6]).swapExactTokensForETHSupportingFeeOnTransferTokens(
      ethers.utils.parseEther("400"),
      0, // accept any amount of ETH
      path,
      accounts[6].address,
      new Date().getTime() + 12121212
    )
    await uniswapRouter.connect(accounts[6]).swapExactTokensForETHSupportingFeeOnTransferTokens(
      ethers.utils.parseEther("400"),
      0, // accept any amount of ETH
      path,
      accounts[6].address,
      new Date().getTime() + 12121212
    )

    const tokenBalUserAft = await token.balanceOf(accounts[6].address);
    const tokenBalContractAft = await token.balanceOf(token.address);
    const tokenBalFeeWalletAft = await token.balanceOf(accounts[5].address);

    console.log({
      tokenBalUserBef: ethers.utils.formatEther(tokenBalUserBef),
      tokenBalUserAft: ethers.utils.formatEther(tokenBalUserAft),
      tokenBalContractBef: ethers.utils.formatEther(tokenBalContractBef),
      tokenBalContractAft: ethers.utils.formatEther(tokenBalContractAft),
      tokenBalFeeWalletBef: ethers.utils.formatEther(tokenBalFeeWalletBef),
      tokenBalFeeWalletAft: ethers.utils.formatEther(tokenBalFeeWalletAft),
    })
  })
});
