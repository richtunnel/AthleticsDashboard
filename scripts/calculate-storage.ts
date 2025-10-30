/**
 * Script to calculate and update storage usage for all organizations
 * Run with: npx ts-node scripts/calculate-storage.ts
 */

import { PrismaClient } from "@prisma/client";
import { updateOrganizationStorageUsage, formatBytes } from "../src/lib/services/storage.service";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting storage calculation for all organizations...\n");

  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      storageUsageBytes: true,
      storageQuotaBytes: true,
    },
  });

  console.log(`Found ${organizations.length} organizations to process.\n`);

  for (const org of organizations) {
    console.log(`Processing organization: ${org.name} (${org.id})`);
    console.log(`  Current usage: ${formatBytes(org.storageUsageBytes)}`);
    console.log(`  Quota: ${formatBytes(org.storageQuotaBytes)}`);

    try {
      const newUsage = await updateOrganizationStorageUsage(org.id);
      console.log(`  Updated usage: ${formatBytes(newUsage)}`);
      console.log(`  Usage: ${((Number(newUsage) / Number(org.storageQuotaBytes)) * 100).toFixed(2)}%`);
      console.log("  ✓ Success\n");
    } catch (error) {
      console.error(`  ✗ Error: ${error}`);
      console.log("");
    }
  }

  console.log("Storage calculation completed!");
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
