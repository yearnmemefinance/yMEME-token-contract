const { expect } = require("chai");
const fs = require('fs')
const { ethers } = require("hardhat");
const { BigNumber, utils } = require("ethers")
const CONFIG = require("../credentials.js");

// const nftABI = require("../artifacts/contracts/NFT.sol/NFT.json").abi;

let tokenABI = (JSON.parse(fs.readFileSync('./artifacts/contracts/Token.sol/Token.json', 'utf8'))).abi;
let burnTokenABI = (JSON.parse(fs.readFileSync('./artifacts/contracts/test/testToken.sol/TestToken.json', 'utf8'))).abi;
let claimABI = (JSON.parse(fs.readFileSync('./artifacts/contracts/Claim.sol/Claim.json', 'utf8'))).abi;

const provider = new ethers.providers.JsonRpcProvider(`https://ethereum-goerli-rpc.allthatnode.com`)
const signer = new ethers.Wallet(CONFIG.wallet.PKEY);
const account = signer.connect(provider);

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

  let tokenAdd = "0x241df29737f9D58b2ae5051830509D27D0Df21be"
  let burnTokenAdd = "0x25A583f7e0c7dEFe9d5ABB09E84786F5566FE93f"
  let claimAdd = "0x0A9BF76de7a9771ABEf76C4EB9fC8d9c5Af1a2a4"

  token = new ethers.Contract(
    tokenAdd,
    tokenABI,
    account,
  );

  burnToken = new ethers.Contract(
    burnTokenAdd,
    burnTokenABI,
    account,
  );

  claim = new ethers.Contract(
    claimAdd,
    claimABI,
    account,
  );

  before(async() =>{

    const currentTime = Math.floor(Date.now() / 1000)

    // const TOKEN = await ethers.getContractFactory("Token");
    // token = await TOKEN.deploy();
    // await token.deployed();

    // const TESTTOKEN = await ethers.getContractFactory("TestToken");
    // burnToken = await TESTTOKEN.deploy(9);
    // await burnToken.deployed();

    // const CLAIM = await ethers.getContractFactory("Claim");
    // claim = await CLAIM.deploy(burnToken.address, token.address);
    // await claim.deployed();

    uniswapRouter  = await ethers.getContractAt("IUniswapV2Router02", UNISWAPV2ROUTERADDRESS);
    // uniswapFactory = await ethers.getContractAt("IUniswapV2Factory", FACTORY_ADDRESS);
    wethAddress    = await uniswapRouter.WETH();
    // pairAddress    = await uniswapFactory.getPair(wethAddress, token.address);
    // uniswapPair    = await ethers.getContractAt("IUniswapV2Pair", pairAddress);

    accounts = await ethers.getSigners();
    
  })

  it ("should print contract addresses", async () => {
    console.log({
      token: token.address,
      burnToken: burnToken.address,
      claim: claim.address,
    })
  })

  it("Should mint new tokens", async () => {
    tx = await token.mint(account.address, ethers.utils.parseUnits("1000", 18))
    await tx.wait()
  })

  it("Should add liquidity", async () => {
    tx = await token.approve(UNISWAPV2ROUTERADDRESS, ethers.utils.parseEther("1000000"))
    await tx.wait()
    tx = await uniswapRouter.addLiquidityETH(token.address, ethers.utils.parseEther("1000000"), 0, 0, accounts[0].address, (Date.now() + 100000), {value: ethers.utils.parseEther('0.01')}); // provide 1000 WETH + 100000 token liquidity to uniswap
    await tx.wait()
  })

  it("Should set fee", async () => {
    tx = await token.setFees(200, 400)
    await tx.wait()
    tx = await token.setFeeWallet("0x0000000000000000000000000000000000000000")
    await tx.wait()
  })

  it("Should take no tax and tax", async () => {
    tx = await token.toggleExcludeFromFees(account.address)
    await tx.wait()
    tx = await token.transfer("0x000000000000000000000000000000000000dead", ethers.utils.parseEther("100"))
    await tx.wait()
    const path = [token.address, wethAddress];
    tx = await token.approve(UNISWAPV2ROUTERADDRESS, ethers.utils.parseEther("100"));
    await tx.wait()
    tx = await uniswapRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
      ethers.utils.parseEther("100"),
      0, // accept any amount of ETH
      path,
      account.address,
      new Date().getTime()
    )
    await tx.wait()
    tx = await uniswapRouter.swapExactETHForTokensSupportingFeeOnTransferTokens(
        0, // accept any amount of Tokens
        path.reverse(),
        account.address,
        new Date().getTime(), {
            value: ethers.utils.parseEther("0.001")
        }
    )
    await tx.wait()
  })

  it("Should claim tokens", async () => {
    tx = await token.transfer(claim.address, ethers.utils.parseUnits("1000", 18))
    await tx.wait()
    tx = await claim.setConversionRatio(100)
    await tx.wait()
    tx = await burnToken.approve(claim.address, ethers.utils.parseUnits("1000", 18))
    await tx.wait()
    tx = await claim.claim(ethers.utils.parseUnits("1000", 9))
    await tx.wait()
  })

  it("Should swap tokens present in token contract", async () => {
    const path = [token.address, wethAddress];
    tx = await token.setSwapTokensAtAmount(ethers.utils.parseUnits("150", 18))
    await tx.wait()
    tx = await token.approve(UNISWAPV2ROUTERADDRESS, ethers.utils.parseEther("100"));
    await tx.wait()
    tx = await uniswapRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
        ethers.utils.parseEther("100"),
        0, // accept any amount of ETH
        path,
        account.address,
        new Date().getTime()
      )
      await tx.wait()
  })
});
