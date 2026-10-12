// Hosting providers name the Postgres connection string differently (Neon on Vercel can add a prefix).
// Find it under the common names so a renamed variable doesn't break the app.

type Env = Record<string, string | undefined>;

function pick(env: Env, names: string[], suffix: string) {
  for (const n of names) if (env[n]) return { name: n, value: env[n]! };
  const prefixed = Object.keys(env).find((k) => k.endsWith(suffix) && env[k]);
  return prefixed ? { name: prefixed, value: env[prefixed]! } : null;
}

/** Pooled URL, used by the app at runtime. */
export function databaseUrl(env: Env = process.env) {
  return pick(env, ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"], "_DATABASE_URL");
}

/** Direct (unpooled) URL, preferred for migrations. */
export function directDatabaseUrl(env: Env = process.env) {
  return pick(env, ["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"], "_DATABASE_URL_UNPOOLED");
}
