export async function runNonCritical<T>(fn: () => Promise<T> | T, label: string): Promise<void> {
  try {
    await fn();
  } catch (error) {
    console.error(`Non-critical operation failed: ${label}`, error);
  }
}
