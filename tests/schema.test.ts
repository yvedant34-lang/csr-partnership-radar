import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const read = (f: string) => readFileSync(path.join(__dirname, "../seed", f), "utf8");

describe("schema + seed_live.sql on Postgres (PGlite)", () => {
  it("loads, enforces one lead per company/signal/week, and seeds 15 leads", async () => {
    const db = new PGlite();
    await db.exec(read("schema.sql"));
    await db.exec(read("seed_live.sql"));
    await db.exec(read("seed_live.sql")); // idempotent
    const hasLusha = existsSync(path.join(__dirname, "../seed/private/seed_lusha.sql"));
    if (hasLusha) await db.exec(read("private/seed_lusha.sql"));

    const n = await db.query<{ n: number }>("select count(*)::int n from leads");
    expect(n.rows[0].n).toBe(15);
    const ev = await db.query<{ n: number }>("select count(*)::int n from lead_stage_events");
    expect(ev.rows[0].n).toBe(15);
    const c = await db.query<{ source: string; n: number }>(
      "select source, count(*)::int n from lead_contacts group by source order by source");
    expect(c.rows).toEqual(hasLusha
      ? [{ source: "lusha", n: 10 }, { source: "source_text", n: 13 }]
      : [{ source: "source_text", n: 13 }]);
    if (!hasLusha) return db.close();
    const sona = await db.query<{ name: string }>(
      "select c.name from lead_contacts c join leads l on l.id = c.lead_id where l.lead_id = 'LIVE-013' and c.source = 'lusha'");
    expect(sona.rows).toEqual([{ name: "Anupam Bajpai" }]);

    // Same company, signal and IST week as BASF (posted Tue 15 Sep) -> rejected.
    await expect(
      db.exec(`insert into leads (company_name, signal_type, posted_at) values ('basf india ltd', 'unspent_csr', '2026-09-18T10:00:00+05:30')`),
    ).rejects.toThrow(/duplicate key/);
    // Next week is fine.
    await db.exec(`insert into leads (company_name, signal_type, posted_at) values ('BASF India Ltd', 'unspent_csr', '2026-09-22T10:00:00+05:30')`);
    await db.close();
  });
});
