const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkSignupLogs() {
  try {
    const logs = await prisma.signupLog.findMany({
      where: {
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`Found ${logs.length} active SignupLog entries:`);
    logs.forEach((log, index) => {
      console.log(`\n--- Entry ${index + 1} ---`);
      console.log('ID:', log.id);
      console.log('Email:', log.email);
      console.log('Phone:', log.phone);
      console.log('Reason:', log.reason);
      console.log('Deleted User ID:', log.deletedUserId);
      console.log('Deleted At:', log.deletedAt);
      console.log('Expires At:', log.expiresAt);
      console.log('Days Remaining:', Math.ceil((log.expiresAt - new Date()) / (1000 * 60 * 60 * 24)));
    });
  } catch (error) {
    console.error('Error checking signup logs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSignupLogs();
