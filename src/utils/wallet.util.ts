import { ethers } from 'ethers';
import * as crypto from 'crypto';
import basex from 'base-x';

// Base58 alphabet for Bitcoin/Tron
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const bs58 = basex(BASE58);

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
 * Generate TRC20 (Tron) wallet using crypto
 */
export function generateTrc20Wallet(useTestnet: boolean = false): {
  address: string;
  privateKey: string;
} {
  // Generate random private key (32 bytes)
  const privateKeyBytes = crypto.randomBytes(32);
  const privateKeyHex = privateKeyBytes.toString('hex');

  // For Tron addresses, we'll use ethers to generate the address
  // then convert it to Tron format (base58 with prefix)
  const wallet = new ethers.Wallet(privateKeyHex);
  const ethAddress = wallet.address;
  
  // Convert Ethereum address to Tron address format
  // Tron mainnet addresses start with 'T' (0x41 prefix)
  // Testnet addresses start with 'T' as well but use different network
  const addressBytes = Buffer.from(ethAddress.slice(2), 'hex');
  const prefixedAddress = Buffer.concat([Buffer.from([0x41]), addressBytes]);
  
  // Calculate checksum
  const hash1 = crypto.createHash('sha256').update(prefixedAddress).digest();
  const hash2 = crypto.createHash('sha256').update(hash1).digest();
  const checksum = hash2.slice(0, 4);
  
  // Combine address and checksum, then encode to base58
  const addressWithChecksum = Buffer.concat([prefixedAddress, checksum]);
  const tronAddress = bs58.encode(addressWithChecksum);

  return {
    address: tronAddress,
    privateKey: privateKeyHex,
  };
}

/**
 * Validate BSC address format
 */
export function isValidBscAddress(address: string): boolean {
  return ethers.utils.isAddress(address);
}

/**
 * Validate TRC20 address format
 */
export function isValidTrc20Address(
  address: string,
  useTestnet: boolean = false
): boolean {
  try {
    // Tron addresses should start with 'T' and be 34 characters long
    if (!address || address.length !== 34 || !address.startsWith('T')) {
      return false;
    }
    
    // Try to decode base58
    const decoded = bs58.decode(address);
    if (decoded.length !== 25) {
      return false;
    }
    
    // Verify checksum
    const addressBytes = decoded.slice(0, 21);
    const checksum = decoded.slice(21);
    
    const hash1 = crypto.createHash('sha256').update(Buffer.from(addressBytes)).digest();
    const hash2 = crypto.createHash('sha256').update(hash1).digest();
    const expectedChecksum = hash2.slice(0, 4);
    
    return Buffer.from(checksum).equals(Buffer.from(expectedChecksum));
  } catch (error) {
    return false;
  }
}

/**
 * Get USDT balance for BSC address
 */
export async function getBscUsdtBalance(
  address: string,
  contractAddress: string,
  rpcUrl: string
): Promise<string> {
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  
  // USDT ABI for balanceOf function
  const abi = ['function balanceOf(address) view returns (uint256)'];
  const contract = new ethers.Contract(contractAddress, abi, provider);
  
  const balance = await contract.balanceOf(address);
  return ethers.utils.formatUnits(balance, 18); // BSC USDT has 18 decimals
}

/**
 * Get USDT balance for TRC20 address using TronGrid API
 */
export async function getTrc20UsdtBalance(
  address: string,
  contractAddress: string,
  rpcUrl: string
): Promise<string> {
  try {
    // Use TronGrid API to get token balance
    const apiUrl = rpcUrl.replace('/jsonrpc', '');
    const response = await fetch(
      `${apiUrl}/v1/accounts/${address}/transactions/trc20?limit=1&contract_address=${contractAddress}`
    );
    
    if (!response.ok) {
      return '0';
    }
    
    const data = await response.json();
    
    // Alternative: Direct balance query
    const balanceResponse = await fetch(
      `${apiUrl}/v1/accounts/${address}`
    );
    
    if (!balanceResponse.ok) {
      return '0';
    }
    
    const balanceData = await balanceResponse.json();
    const trc20Balances = balanceData.data?.[0]?.trc20 || [];
    
    // Find USDT balance
    const usdtBalance = trc20Balances.find(
      (token: any) => token[contractAddress]
    );
    
    if (usdtBalance && usdtBalance[contractAddress]) {
      const balance = usdtBalance[contractAddress];
      // TRC20 USDT has 6 decimals
      return (Number(balance) / 1000000).toFixed(6);
    }
    
    return '0';
  } catch (error) {
    console.error('Error fetching TRC20 balance:', error);
    return '0';
  }
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
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  // USDT ABI for transfer function
  const abi = ['function transfer(address to, uint256 amount) returns (bool)'];
  const contract = new ethers.Contract(contractAddress, abi, wallet);
  
  // Convert amount to wei (18 decimals for BSC USDT)
  const amountWei = ethers.utils.parseUnits(amount, 18);
  
  // Send transaction
  const tx = await contract.transfer(toAddress, amountWei);
  await tx.wait();
  
  return tx.hash;
}

/**
 * Send USDT on TRC20 network
 * Note: For production, consider using TronWeb library or external signing service
 */
export async function sendTrc20Usdt(
  privateKey: string,
  toAddress: string,
  amount: string,
  contractAddress: string,
  rpcUrl: string
): Promise<string> {
  // For now, we'll throw an error as sending requires TronWeb or signing service
  // This functionality should be implemented when withdrawal feature is needed
  throw new Error(
    'TRC20 sending not implemented. Use TronWeb library or external signing service for production.'
  );
  
  // TODO: Implement using TronGrid API or TronWeb when needed
  // const amountSun = Math.floor(parseFloat(amount) * 1000000);
  // ...
}
