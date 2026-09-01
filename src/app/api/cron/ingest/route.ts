import { runCronIngest } from "@/lib/server-ingest";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runCronIngest();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("cron ingest failed", error);
    return Response.json({ error: "cron failed" }, { status: 500 });
  }
}
