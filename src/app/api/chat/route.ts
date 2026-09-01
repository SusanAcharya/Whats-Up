import { isBotId } from "@/lib/bots";
import { botReply } from "@/lib/ai";
import { footballSnapshot } from "@/lib/football";
import { defaultPreferences, normalizePreferences } from "@/lib/preferences";
import type { BotId, BotPref, Preferences } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      botId?: string;
      message?: string;
      history?: { role?: string; content?: string }[];
      newsContext?: { title?: string; text?: string }[];
      preferences?: Preferences;
    };

    if (!body.botId || !isBotId(body.botId) || !body.message?.trim()) {
      return Response.json({ error: "missing message" }, { status: 400 });
    }

    const history = (body.history ?? [])
      .filter(
        (turn) =>
          (turn.role === "user" || turn.role === "assistant") &&
          typeof turn.content === "string",
      )
      .map((turn) => ({
        role: turn.role as "user" | "assistant",
        content: turn.content!.slice(0, 1500),
      }))
      .slice(-8);

    const newsContext = (body.newsContext ?? [])
      .filter((row) => typeof row.title === "string" && typeof row.text === "string")
      .map((row) => ({
        title: row.title!.slice(0, 200),
        text: row.text!.slice(0, 500),
      }))
      .slice(0, 5);

    let liveContext: string | undefined;
    if (body.botId === "pitch") {
      const prefs = normalizePreferences(body.preferences);
      const pref: BotPref = prefs.pitch ?? defaultPreferences().pitch;
      try {
        liveContext = (await footballSnapshot(pref)).asText.slice(0, 3500);
      } catch (error) {
        console.warn("pitch snapshot failed", error);
        liveContext = "live scores are down right now.";
      }
    }

    const reply = await botReply({
      botId: body.botId as BotId,
      history,
      message: body.message.trim().slice(0, 1500),
      newsContext,
      liveContext,
    });

    return Response.json({ reply });
  } catch (error) {
    console.error("chat failed", error);
    return Response.json(
      { error: "bot is buffering. send that again." },
      { status: 500 },
    );
  }
}
