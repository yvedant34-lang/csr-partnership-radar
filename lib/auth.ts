import "server-only";
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export function isCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  return !!secret && safeEqual(header, `Bearer ${secret}`);
}
