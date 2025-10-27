import { cleanupRoles } from "@/app/dashboard/settings/actions";

async function runCleanup() {
  const result = await cleanupRoles();
  if (result.success) {
    console.log(`Successfully cleaned up ${result.count} users.`);
  } else {
    console.error(`Cleanup failed: ${result.error}`);
  }
}

runCleanup()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
