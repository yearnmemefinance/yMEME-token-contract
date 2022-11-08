/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-etherscan");
require('hardhat-contract-sizer');
// require("solidity-coverage");
require("@tenderly/hardhat-tenderly")
 
 // require('hardhat-spdx-license-identifier');
 // require("hardhat-gas-reporter");
 const CONFIG = require("./credentials.js");
 
 module.exports = {
     solidity: {
         compilers: [
             {
                 version: "0.8.10",
                 settings: {
                     optimizer: {
                         enabled: true,
                         runs: 1000,
                     },
                 },
             },
             {
                version: "0.5.16",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 1000,
                    },
                },
            }
         ],
     },
     spdxLicenseIdentifier: {
         overwrite: true,
         runOnCompile: true,
     },
     // gasReporter: {
     //     currency: 'USD',
     //     gasPrice: 1
     // },
     defaultNetwork: "hardhat",
     mocha: {
         timeout: 1000000000000,
     },
 
     networks: {
         hardhat: {
            // blockGasLimit: 10000000000000,
            allowUnlimitedContractSize: true,
            timeout: 1000000000000,
            chainId: 1,
            forking: {
                url: "https://rpc.ankr.com/eth"
            },
            accounts: {
                accountsBalance: "100000000000000000000000000000",
                count: 20,
            },
         },
         bscMainnet: {
            url: `https://bsc-dataseed.binance.org/`,
            accounts: [CONFIG.wallet.PKEY],
            // gasPrice: 30000000000,
        },
         bscTestnet: {
             url: `https://data-seed-prebsc-1-s1.binance.org:8545/`,
             accounts: [CONFIG.wallet.PKEY],
            //  gasPrice: 30000000000,
         },
        rinkeby: {
            url: "https://rinkeby-light.eth.linkpool.io/",
            accounts: [CONFIG.wallet.PKEY],
        },
        
        local: {
            url: 'http://127.0.0.1:8545',
            forking: {
                url: "https://rpc.ankr.com/eth"
            },
        }
     },
 
     contractSizer: {
         alphaSort: false,
         runOnCompile: true,
         disambiguatePaths: false,
     },

     etherscan: {
        apiKey: CONFIG.etherscan.KEY,
     },

     tenderly: {
		username: "Gurkaran",
		project: "project"
	}
 };
 