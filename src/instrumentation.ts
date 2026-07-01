export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureDatabaseReady } = await import("@/lib/jsondb");
    await ensureDatabaseReady().catch((e) => {
      console.error("[instrumentation] database preload failed", e);
    });
  }
}
