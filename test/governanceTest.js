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
    accounts = await ethers.getSigners();

    const TOKEN = await ethers.getContractFactory("Token");
    token = await TOKEN.deploy("Token", "TOK", ethers.utils.parseEther('1000000000'));
    await token.deployed();

    const GOVERNOR = await ethers.getContractFactory("GovernorAlpha");
    governor = await GOVERNOR.deploy(token.address, accounts[0].address);
    await governor.deployed();

    const TIMELOCK = await ethers.getContractFactory("Timelock");
    timelock = await TIMELOCK.deploy(governor.address, 3 * 24 * 60 * 60);
    await timelock.deployed();

  })

  it ("should print contract addresses", async () => {
    console.log({
        token: token.address,
        timelock: timelock.address,
        governor: governor.address,
    })
  })

  it("Should set timelock", async () => {
    await governor.setTimelock(timelock.address);
    await token.setTimelock(timelock.address);
  })

  it("Should be able to propose", async () => {
    let targets = [];
    let values = [];
    let signatures = [];
    targets.push(token.address);
    values.push(0);
    signatures.push("mint(address,uint256)");



    let types = []
    let params = []
    let vals = [];
    types.push("address")
    types.push("uint256")
    vals.push(accounts[8].address);
    vals.push(ethers.utils.parseEther("1000"))

    let temp = await web3.eth.abi.encodeParameters(types, vals)
    params.push(temp);

    await token.transfer(accounts[1].address, ethers.utils.parseEther("100001"));
    await token.transfer(accounts[2].address, ethers.utils.parseEther("300001"));

    await token.connect(accounts[1]).delegate(accounts[1].address)
    await token.connect(accounts[2]).delegate(accounts[2].address);
    // await token.delegate(accounts[3])

    let votes = await token.getCurrentVotes(accounts[1].address);
    let threshold = await governor.proposalThreshold();
    console.log({
        votes: votes.toString(),
        threshold: threshold.toString(),
    })

    await governor.connect(accounts[1]).propose(targets, values, signatures, params, 'TEST PROPOSAL');
    await advanceBlocks(10);

    let proposal_id = await governor.proposalCount.call();

    console.log({
        proposal_id: proposal_id.toString(),
    })
  })

  it("Should be able to cast vote", async () => {
    await governor.connect(accounts[1]).castVote(1, true);
    await governor.connect(accounts[2]).castVote(1, true);
    const proposalData = await governor.proposals(1);
    console.log({
        forVotes: proposalData.forVotes.toString(),
    })
  })

  it("Should go to queue state", async () => {
    for (let q = 0; q < 173; q++) {
        await advanceBlocks(100);
    }

    let state = await governor.state(1);
    console.log({
        state: state.toString(),
    })

    await governor.queue(1);

    let stateAft = await governor.state(1);
    console.log({
        stateAft: stateAft.toString(),
    })
  })

  it("Should execute", async () => {
    const balBef = await token.balanceOf(accounts[8].address);

    await advancetime(3 * 24 * 60 * 60 + 1);
    await advanceBlock()

    await governor.execute(1);

    const balAft = await token.balanceOf(accounts[8].address);
    console.log({
        balBef: ethers.utils.formatEther(balBef),
        balAft: ethers.utils.formatEther(balAft),
    })
  })

});
