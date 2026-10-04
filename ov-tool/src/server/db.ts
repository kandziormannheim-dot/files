import { PrismaClient } from "@prisma/client";

// Ein Client pro Prozess; im Dev-Modus über Hot Reloads hinweg wiederverwenden.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
