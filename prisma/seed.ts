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
