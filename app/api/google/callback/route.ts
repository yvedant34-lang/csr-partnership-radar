import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connect } from "@/lib/gcal";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const expected = jar.get("radar_google_state")?.value;
  jar.delete("radar_google_state");
  if (!(await isAdmin())) redirect("/login?next=/settings");
  if (url.searchParams.get("error")) redirect(`/settings?google=${encodeURIComponent(url.searchParams.get("error")!)}`);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!expected || !state || state !== expected || !code) redirect("/settings?google=state_mismatch");
  let result = "connected";
  try {
    await connect(code);
  } catch (e) {
    result = (e as Error).message.slice(0, 160);
  }
  redirect(`/settings?google=${encodeURIComponent(result)}`);
}
