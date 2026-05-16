// src/tests/helper.ts
import request from "supertest";
import app from "@/index";
import { db } from "@/config/db";
import { eq } from "drizzle-orm";
import { user } from "@/v2/parent-model";

export interface AuthHeaders {
  Cookie: string;
  userId: string; // The authenticated user's ID — needed for self-referential tests
}

/**
 * Creates (or reuses) a test user with the given roleId and returns the
 * session Cookie AND the user's ID from the sign-in response.
 *
 * ─── WHY HTTP CALLS INSTEAD OF auth.api ──────────────────────────────────────
 * auth.api.signInEmail() bypasses the full response pipeline so the session
 * hash is never written to the DB correctly → getSession() returns null → 401.
 * Going through real HTTP guarantees the session is persisted properly.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const getAuthHeaders = async (
  roleId: number = 1,
  overrides: { email?: string; firstName?: string; lastName?: string } = {}
): Promise<AuthHeaders> => {
  const email     = overrides.email     ?? `test-role-${roleId}@crevy-test.io`;
  const password  = "TestPass123!";
  const firstName = overrides.firstName ?? "Test";
  const lastName  = overrides.lastName  ?? "User";

  // ── 1. Register (idempotent) ───────────────────────────────────────────────
  const signUpRes = await request(app)
    .post("/api/auth/sign-up/email")
    .set("Content-Type", "application/json")
    .send({ name: `${firstName} ${lastName}`, email, password, firstName, lastName });

  const signUpOk      = signUpRes.status === 200 || signUpRes.status === 201;
  const alreadyExists = signUpRes.status === 422 || signUpRes.status === 409;

  if (!signUpOk && !alreadyExists) {
    throw new Error(
      `[Test helper] Sign-up failed (${signUpRes.status}): ${JSON.stringify(signUpRes.body)}`
    );
  }

  // ── 2. Assign roleId via direct DB write ───────────────────────────────────
  // roleId has input:false in the better-auth config — patch it ourselves.
  // We do this EVERY time to ensure the user has the role needed for the current test.
  await db.update(user).set({ roleId }).where(eq(user.email, email));

  // ── 3. Sign in through HTTP to get the real Set-Cookie header ─────────────
  const signInRes = await request(app)
    .post("/api/auth/sign-in/email")
    .set("Content-Type", "application/json")
    .send({ email, password });

  if (signInRes.status !== 200) {
    throw new Error(
      `[Test helper] Sign-in failed (${signInRes.status}): ${JSON.stringify(signInRes.body)}`
    );
  }

  // ── 4. Extract cookie ──────────────────────────────────────────────────────
  const setCookieHeader = signInRes.headers["set-cookie"] as string[] | string | undefined;

  if (!setCookieHeader || (Array.isArray(setCookieHeader) && setCookieHeader.length === 0)) {
    throw new Error(
      `[Test helper] Sign-in succeeded but no Set-Cookie header returned. ` +
      `Check that BETTER_AUTH_SECRET is set in vitest.config.ts env block.`
    );
  }

  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  const cookieString = cookies.map((c) => c.split(";")[0].trim()).join("; ");

  // ── 5. Extract userId from the sign-in response body ──────────────────────
  // better-auth returns { user: { id, email, ... }, session: {...} }
  const userId: string = signInRes.body?.user?.id ?? signInRes.body?.data?.user?.id;
  if (!userId) {
    throw new Error(
      `[Test helper] Could not extract userId from sign-in response. ` +
      `Response body: ${JSON.stringify(signInRes.body)}`
    );
  }

  return { Cookie: cookieString, userId };
};
