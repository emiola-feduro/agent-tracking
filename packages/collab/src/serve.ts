#!/usr/bin/env bun
/**
 * Runs the shared server: DATABASE_URL=postgres://user:pass@host/db COLLAB_PORT=4400 bun packages/collab/src/serve.ts
 * Without DATABASE_URL it keeps its data in collab.db (SQLite) next to where it runs.
 */
import { createCollabServer } from "./server";
import { openCollabStore } from "./store";

const url = process.env.DATABASE_URL ?? "collab.db";
const store = await openCollabStore(url);
const app = createCollabServer(store, { allowSignup: process.env.COLLAB_SIGNUP !== "0" });
const server = Bun.serve({ port: Number(process.env.COLLAB_PORT ?? 4400), fetch: app.fetch });
console.log(`Servidor compartido de Agent Tracking en http://localhost:${server.port} (${url.startsWith("postgres") ? "PostgreSQL" : "SQLite"})`);
