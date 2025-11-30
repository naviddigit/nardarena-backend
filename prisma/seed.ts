import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create AI system user
  const aiUser = await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'ai@nardarena.com',
      username: 'AI_Player',
      displayName: 'AI Opponent',
      passwordHash: await bcrypt.hash('AI_PLAYER_NO_LOGIN', 12),
      avatar: '/assets/images/avatar/ai-avatar.webp',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
      stats: {
        create: {
          balance: 0,
          gamesPlayed: 0,
          gamesWon: 0,
          gamesLost: 0,
        },
      },
    },
  });
  console.log('✅ AI Player created:', aiUser.username);

  // Create admin user
  const adminPassword = await bcrypt.hash('Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@nardarena.com' },
    update: {},
    create: {
      email: 'admin@nardarena.com',
      username: 'admin',
      displayName: 'System Administrator',
      passwordHash: adminPassword,
      role: 'ADMIN', // Admin role
      status: 'ACTIVE',
      emailVerified: true,
      stats: {
        create: {
          balance: 0,
        },
      },
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Create test users
  const testPassword = await bcrypt.hash('Test123!', 12);
  
  const user1 = await prisma.user.upsert({
    where: { email: 'player1@test.com' },
    update: {},
    create: {
      email: 'player1@test.com',
      username: 'player1',
      displayName: 'Test Player 1',
      passwordHash: testPassword,
      status: 'ACTIVE',
      emailVerified: true,
      stats: {
        create: {
          balance: 100,
          gamesPlayed: 10,
          gamesWon: 6,
          gamesLost: 4,
          totalSetsWon: 18,
          totalSetsLost: 12,
          currentStreak: 2,
          bestStreak: 5,
        },
      },
    },
  });
  console.log('✅ Test user 1 created:', user1.email);

  const user2 = await prisma.user.upsert({
    where: { email: 'player2@test.com' },
    update: {},
    create: {
      email: 'player2@test.com',
      username: 'player2',
      displayName: 'Test Player 2',
      passwordHash: testPassword,
      status: 'ACTIVE',
      emailVerified: true,
      stats: {
        create: {
          balance: 50,
          gamesPlayed: 8,
          gamesWon: 3,
          gamesLost: 5,
          totalSetsWon: 9,
          totalSetsLost: 15,
          currentStreak: 0,
          bestStreak: 3,
        },
      },
    },
  });
  console.log('✅ Test user 2 created:', user2.email);

  // ==========================================
  // SYSTEM SETTINGS - Wallet Configuration
  // ==========================================
  
  const systemSettings = [
    // API Keys
    { key: 'trongrid_api_key', value: '', description: 'TronGrid API Key', category: 'api' },
    { key: 'bscscan_api_key', value: '', description: 'BSCScan API Key', category: 'api' },
    
    // Network
    { key: 'use_testnet', value: 'true', description: 'Use Testnet (true) or Mainnet (false)', category: 'network' },
    { key: 'wallet_check_interval_minutes', value: '10', description: 'Check interval in minutes', category: 'network' },
    { key: 'wallet_check_history_hours', value: '10', description: 'Check wallets created within X hours', category: 'network' },
    { key: 'trc20_confirmations_required', value: '19', description: 'TRC20 confirmations needed', category: 'network' },
    { key: 'bsc_confirmations_required', value: '12', description: 'BSC confirmations needed', category: 'network' },
    
    // Withdraw
    { key: 'min_withdraw_amount', value: '10.00', description: 'Minimum withdraw amount (USD)', category: 'withdraw' },
    { key: 'max_withdraw_amount', value: '999999.00', description: 'Maximum withdraw amount (USD)', category: 'withdraw' },
    { key: 'max_daily_withdraw_per_user', value: '999999.00', description: 'Daily withdraw limit per user (USD)', category: 'withdraw' },
    { key: 'auto_withdraw_enabled', value: 'false', description: 'Auto process withdrawals', category: 'withdraw' },
    { key: 'require_email_verified', value: 'true', description: 'Require verified email for withdraw', category: 'withdraw' },
    
    // Fees
    { key: 'trc20_network_fee_usd', value: '1.00', description: 'TRC20 network fee in USD', category: 'fee' },
    { key: 'bsc_network_fee_usd', value: '1.00', description: 'BSC network fee in USD', category: 'fee' },
    { key: 'withdraw_fee_percent', value: '0.5', description: 'Additional fee percentage on network fee', category: 'fee' },
    
    // Master Wallet
    { key: 'auto_settlement_enabled', value: 'true', description: 'Auto settle to master wallet daily', category: 'master_wallet' },
    { key: 'settlement_threshold_usd', value: '1000.00', description: 'Min balance for auto settlement', category: 'master_wallet' },
    { key: 'master_wallet_trc20_address', value: '', description: 'Master wallet address for TRC20', category: 'master_wallet' },
    { key: 'master_wallet_bsc_address', value: '', description: 'Master wallet address for BSC', category: 'master_wallet' },
  ];

  for (const setting of systemSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log(`✅ Created ${systemSettings.length} system settings`);

  console.log('🎉 Database seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
