import type { BotId, Preferences } from "@/lib/types";
import { isBotId } from "@/lib/bots";
import { collectFlashes } from "@/lib/pipeline";
import { summarizeFlashes } from "@/lib/ai";
import { normalizePreferences } from "@/lib/preferences";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      bots?: string[];
      seenUrls?: string[];
      seenTitles?: string[];
      preferences?: Preferences;
    };
    const bots = (body.bots ?? []).filter(isBotId);
    const seenUrls = Array.isArray(body.seenUrls)
      ? body.seenUrls.filter((url) => typeof url === "string").slice(0, 400)
      : [];
    const seenTitles = Array.isArray(body.seenTitles)
      ? body.seenTitles.filter((title) => typeof title === "string").slice(0, 200)
      : [];
    const preferences = normalizePreferences(body.preferences);

    if (bots.length === 0) {
      return Response.json({ items: [] });
    }

    const stories = await collectFlashes(bots as BotId[], seenUrls, seenTitles, preferences);
    const items = await summarizeFlashes(stories);
    return Response.json({ items });
  } catch (error) {
    console.error("ingest failed", error);
    return Response.json(
      { error: "could not fetch the timeline. try again." },
      { status: 500 },
    );
  }
}
