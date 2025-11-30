import { ethers } from 'ethers';
const TronWeb = require('tronweb');

/**
 * Network configuration
 */
export interface NetworkConfig {
  name: string;
  symbol: string;
  contractAddress: string;
  rpcUrl: string;
  apiUrl: string;
  explorerUrl: string;
  decimals: number;
}

/**
 * Get network configuration based on testnet setting
 */
export function getNetworkConfig(
  network: 'TRC20' | 'BSC',
  useTestnet: boolean = false
): NetworkConfig {
  const configs = {
    TRC20: {
      mainnet: {
        name: 'Tron Network',
        symbol: 'USDT',
        contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        rpcUrl: 'https://api.trongrid.io',
        apiUrl: 'https://api.trongrid.io/v1',
        explorerUrl: 'https://tronscan.org',
        decimals: 6,
      },
      testnet: {
        name: 'Tron Shasta Testnet',
        symbol: 'USDT',
        contractAddress: 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs',
        rpcUrl: 'https://api.shasta.trongrid.io',
        apiUrl: 'https://api.shasta.trongrid.io/v1',
        explorerUrl: 'https://shasta.tronscan.org',
        decimals: 6,
      },
    },
    BSC: {
      mainnet: {
        name: 'Binance Smart Chain',
        symbol: 'USDT',
        contractAddress: '0x55d398326f99059fF775485246999027B3197955',
        rpcUrl: 'https://bsc-dataseed.binance.org',
        apiUrl: 'https://api.bscscan.com/api',
        explorerUrl: 'https://bscscan.com',
        decimals: 18,
      },
      testnet: {
        name: 'BSC Testnet',
        symbol: 'USDT',
        contractAddress: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
        rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545',
        apiUrl: 'https://api-testnet.bscscan.com/api',
        explorerUrl: 'https://testnet.bscscan.com',
        decimals: 18,
      },
    },
  };

  return configs[network][useTestnet ? 'testnet' : 'mainnet'];
}

/**
 * Generate BSC (Ethereum-compatible) wallet
 */
export function generateBscWallet(): {
  address: string;
  privateKey: string;
} {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

/**
 * Generate TRC20 (Tron) wallet
 */
export function generateTrc20Wallet(useTestnet: boolean = false): {
  address: string;
  privateKey: string;
} {
  const tronWeb = new TronWeb({
    fullHost: useTestnet
      ? 'https://api.shasta.trongrid.io'
      : 'https://api.trongrid.io',
  });

  const account = tronWeb.createAccount();
  return {
    address: account.address.base58,
    privateKey: account.privateKey,
  };
}

/**
 * Validate BSC address format
 */
export function isValidBscAddress(address: string): boolean {
  return ethers.isAddress(address);
}

/**
 * Validate TRC20 address format
 */
export function isValidTrc20Address(
  address: string,
  useTestnet: boolean = false
): boolean {
  const tronWeb = new TronWeb({
    fullHost: useTestnet
      ? 'https://api.shasta.trongrid.io'
      : 'https://api.trongrid.io',
  });

  return tronWeb.isAddress(address);
}

/**
 * Get USDT balance for BSC address
 */
export async function getBscUsdtBalance(
  address: string,
  contractAddress: string,
  rpcUrl: string
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  // USDT ABI for balanceOf function
  const abi = ['function balanceOf(address) view returns (uint256)'];
  const contract = new ethers.Contract(contractAddress, abi, provider);
  
  const balance = await contract.balanceOf(address);
  return ethers.formatUnits(balance, 18); // BSC USDT has 18 decimals
}

/**
 * Get USDT balance for TRC20 address
 */
export async function getTrc20UsdtBalance(
  address: string,
  contractAddress: string,
  rpcUrl: string
): Promise<string> {
  const tronWeb = new TronWeb({
    fullHost: rpcUrl,
  });

  const contract = await tronWeb.contract().at(contractAddress);
  const balance = await contract.balanceOf(address).call();
  
  // TRC20 USDT has 6 decimals
  return (Number(balance) / 1000000).toFixed(6);
}

/**
 * Send USDT on BSC network
 */
export async function sendBscUsdt(
  privateKey: string,
  toAddress: string,
  amount: string,
  contractAddress: string,
  rpcUrl: string
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  // USDT ABI for transfer function
  const abi = ['function transfer(address to, uint256 amount) returns (bool)'];
  const contract = new ethers.Contract(contractAddress, abi, wallet);
  
  // Convert amount to wei (18 decimals for BSC USDT)
  const amountWei = ethers.parseUnits(amount, 18);
  
  // Send transaction
  const tx = await contract.transfer(toAddress, amountWei);
  await tx.wait();
  
  return tx.hash;
}

/**
 * Send USDT on TRC20 network
 */
export async function sendTrc20Usdt(
  privateKey: string,
  toAddress: string,
  amount: string,
  contractAddress: string,
  rpcUrl: string
): Promise<string> {
  const tronWeb = new TronWeb({
    fullHost: rpcUrl,
    privateKey: privateKey,
  });

  const contract = await tronWeb.contract().at(contractAddress);
  
  // Convert amount to sun (6 decimals for TRC20 USDT)
  const amountSun = Math.floor(parseFloat(amount) * 1000000);
  
  // Send transaction
  const tx = await contract.transfer(toAddress, amountSun).send();
  
  return tx;
}
