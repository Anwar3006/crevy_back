/**
 * env.ts — must be the VERY FIRST module imported in src/index.ts.
 *
 * Loads variables from a .env file into process.env so that settings.ts
 * (which validates and reads process.env at module-evaluation time) always
 * has the values it needs.
 *
 * Behaviour by environment:
 *   Local dev / local start  →  .env file exists → dotenv populates process.env
 *   Render / any CI platform →  no .env file on disk → dotenv is a no-op;
 *                                process.env is already populated by the platform
 *
 * dotenv never overrides a variable that is already set in process.env, so
 * running this in production is always safe.
 */
import { config } from "dotenv";

config(); // silently skips if .env is absent
