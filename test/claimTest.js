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

describe("Token", function () {

  before(async() =>{

    const currentTime = Math.floor(Date.now() / 1000)

    const TOKEN = await ethers.getContractFactory("TestToken");
    burntoken = await TOKEN.deploy(9);
    await burntoken.deployed();

    claimtoken = await TOKEN.deploy(18);
    await claimtoken.deployed();

    const CLAIM = await ethers.getContractFactory("Claim");
    claim = await CLAIM.deploy(burntoken.address, claimtoken.address);
    await claim.deployed();

    accounts = await ethers.getSigners();
    
  })

  it ("should print contract addresses", async () => {
    console.log({
        burntoken: burntoken.address,
        claimtoken: claimtoken.address,
    })
  })

  it("Should set conversion ratio", async () => {
    // 1 burn token -> 1000 claim token
    await claim.setConversionRatio(100000);
  })

  it("Should claim tokens", async () => {
    await claimtoken.transfer(claim.address, ethers.utils.parseUnits("100000", 18));
    await burntoken.approve(claim.address, ethers.utils.parseUnits("1000", 9));
    const burnBalBef = await burntoken.balanceOf(accounts[0].address);
    const claimBalBef = await claimtoken.balanceOf(accounts[0].address);

    await claim.claim(ethers.utils.parseUnits("100", 9));

    const burnBalAft = await burntoken.balanceOf(accounts[0].address);
    const claimBalAft = await claimtoken.balanceOf(accounts[0].address);

    expect(burnBalBef.sub(burnBalAft)).to.equal(ethers.utils.parseUnits("100", 9));
    expect(claimBalAft.sub(claimBalBef)).to.equal(ethers.utils.parseUnits("100000", 18));
  })

});
