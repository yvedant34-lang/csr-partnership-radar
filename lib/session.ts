import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Reads are public. Anything that changes data or spends Gemini/Lusha credits needs the
// passcode (ADMIN_PASSCODE). The cookie holds an HMAC of the passcode, never the passcode.
const COOKIE = "radar_admin";

function token(): string | null {
  const pass = process.env.ADMIN_PASSCODE;
  if (!pass) return null;
  return createHmac("sha256", pass).update("csr-radar-admin-v1").digest("hex");
}

export async function isAdmin(): Promise<boolean> {
  const want = token();
  const have = (await cookies()).get(COOKIE)?.value;
  if (!want || !have || have.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(have), Buffer.from(want));
}

export async function login(passcode: string): Promise<boolean> {
  const pass = process.env.ADMIN_PASSCODE ?? "";
  const ok = pass.length > 0 && passcode.length === pass.length && timingSafeEqual(Buffer.from(passcode), Buffer.from(pass));
  if (ok) {
    (await cookies()).set(COOKIE, token()!, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  return ok;
}

export async function logout() {
  (await cookies()).delete(COOKIE);
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Enter the passcode to make changes.");
}

export async function showSample(): Promise<boolean> {
  return (await cookies()).get("radar_sample")?.value === "1";
}
