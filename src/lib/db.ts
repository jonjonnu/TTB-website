import { PrismaClient } from "@prisma/client";
import { databaseUrl } from "@/lib/database-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: databaseUrl()?.value });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
