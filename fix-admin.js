const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAdmin() {
  const result = await prisma.user.update({
    where: { email: 'admin@nardarena.com' },
    data: { role: 'ADMIN' },
  });
  console.log('✅ Admin role updated:', result.email, result.role);
}

fixAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
