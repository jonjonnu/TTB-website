// Build on Vercel: create/upgrade the database tables, load sample data into an empty database, build the app.
// Each step says what it is doing, so a failed deploy log shows where it stopped.
import { execSync } from "node:child_process";
import { databaseUrl, directDatabaseUrl } from "../src/lib/database-url";

function fail(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

const url = databaseUrl();
if (!url) {
  fail(
    "No database connection found. In Vercel open Storage, create or connect a Neon database to this project " +
      "(tick Production and Preview), then redeploy. Expected an environment variable named DATABASE_URL.",
  );
}
const direct = directDatabaseUrl();
console.log(`Database: using ${url.name}${direct ? ` (migrations via ${direct.name})` : ""}`);
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 16) {
  console.warn("⚠ AUTH_SECRET is missing or shorter than 16 characters: logins will fail until it is set in Settings → Environment Variables.");
}

const env = { ...process.env, DATABASE_URL: url.value };
function step(label: string, cmd: string, extra: Record<string, string> = {}) {
  console.log(`\n▶ ${label}`);
  try {
    execSync(cmd, { stdio: "inherit", env: { ...env, ...extra } });
  } catch {
    fail(`Step failed: ${label}. The lines above show the reason.`);
  }
}

step("Generating database client", "prisma generate");
step("Creating/upgrading database tables", "prisma migrate deploy", direct ? { DATABASE_URL: direct.value } : {});
step("Loading sample data (only if the database is empty)", "tsx prisma/seed.ts", { SEED_IF_EMPTY: "1" });
step("Building the app", "next build");
