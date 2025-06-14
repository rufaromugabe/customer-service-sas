// src/storage.ts
import { AsyncLocalStorage } from "async_hooks";
import { PrismaClient } from "@prisma/client";

// This will let me access tenantContext.getStore() from anywhere in my code.
export const tenantContext = new AsyncLocalStorage<PrismaClient | undefined>();