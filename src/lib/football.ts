import { allOptionsFor } from "./preferences";
import type { BotPref } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

export const ESPN_LEAGUES: Record<string, { slug: string; label: string }> = {
  "premier-league": { slug: "eng.1", label: "Premier League" },
  "la-liga": { slug: "esp.1", label: "La Liga" },
  "serie-a": { slug: "ita.1", label: "Serie A" },
  bundesliga: { slug: "ger.1", label: "Bundesliga" },
  "ligue-1": { slug: "fra.1", label: "Ligue 1" },
  "champions-league": { slug: "uefa.champions", label: "Champions League" },
  "europa-league": { slug: "uefa.europa", label: "Europa League" },
  mls: { slug: "usa.1", label: "MLS" },
  "world-cup": { slug: "fifa.world", label: "World Cup" },
  euros: { slug: "uefa.euro", label: "Euros" },
};

export type LiveSide = {
  name: string;
  short: string;
  score: number;
  logo?: string;
};

export type LiveMatch = {
  id: string;
  league: string;
  leagueId: string;
  name: string;
  status: "pre" | "in" | "post";
  clock: string;
  detail: string;
  home: LiveSide;
  away: LiveSide;
  url: string;
  start: number;
  logo?: string;
};

export type TableRow = {
  rank: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gd: number;
  points: number;
};

export type FootballSnapshot = {
  matches: LiveMatch[];
  tables: { league: string; rows: TableRow[] }[];
  asText: string;
};

type EspnEvent = {
  id?: string;
  name?: string;
  date?: string;
  shortName?: string;
  competitions?: Array<{
    status?: {
      displayClock?: string;
      type?: { state?: string; completed?: boolean; detail?: string; shortDetail?: string };
    };
    competitors?: Array<{
      homeAway?: string;
      score?: string;
      team?: { displayName?: string; shortDisplayName?: string; abbreviation?: string; logo?: string };
    }>;
  }>;
  status?: {
    displayClock?: string;
    type?: { state?: string; detail?: string; shortDetail?: string };
  };
  links?: Array<{ rel?: string[]; href?: string }>;
};

function scoreboardUrl(slug: string) {
  return `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`;
}

function standingsUrl(slug: string) {
  return `https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`;
}

async function espnJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(7000),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json();
}

function parseState(value?: string): "pre" | "in" | "post" {
  if (value === "in") return "in";
  if (value === "post") return "post";
  return "pre";
}

function parseMatch(event: EspnEvent, league: string, leagueId: string): LiveMatch | null {
  const competition = event.competitions?.[0];
  const status = competition?.status ?? event.status;
  const homeRaw = competition?.competitors?.find((row) => row.homeAway === "home");
  const awayRaw = competition?.competitors?.find((row) => row.homeAway === "away");
  if (!homeRaw?.team?.displayName || !awayRaw?.team?.displayName) return null;
  const link =
    event.links?.find((row) => row.rel?.includes("summary"))?.href ||
    `https://www.espn.com/soccer/match/_/gameId/${event.id}`;
  const home: LiveSide = {
    name: homeRaw.team.displayName,
    short: homeRaw.team.abbreviation || homeRaw.team.shortDisplayName || homeRaw.team.displayName,
    score: Number(homeRaw.score ?? 0),
    logo: homeRaw.team.logo,
  };
  const away: LiveSide = {
    name: awayRaw.team.displayName,
    short: awayRaw.team.abbreviation || awayRaw.team.shortDisplayName || awayRaw.team.displayName,
    score: Number(awayRaw.score ?? 0),
    logo: awayRaw.team.logo,
  };
  return {
    id: String(event.id ?? `${home.short}-${away.short}-${event.date}`),
    league,
    leagueId,
    name: event.name || `${away.name} at ${home.name}`,
    status: parseState(status?.type?.state),
    clock: status?.displayClock || "",
    detail: status?.type?.shortDetail || status?.type?.detail || "",
    home,
    away,
    url: link,
    start: event.date ? Date.parse(event.date) : Date.now(),
    logo: home.logo || away.logo,
  };
}

function stat(entry: { stats?: Array<{ name?: string; value?: number; displayValue?: string }> }, names: string[]) {
  const row = entry.stats?.find((item) => item.name && names.includes(item.name));
  if (!row) return 0;
  const numeric = Number(row.value ?? row.displayValue);
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseTable(raw: unknown, league: string): { league: string; rows: TableRow[] } | null {
  const root = raw as {
    children?: Array<{
      standings?: {
        entries?: Array<{
          team?: { displayName?: string };
          stats?: Array<{ name?: string; value?: number; displayValue?: string }>;
        }>;
      };
    }>;
  };
  const entries = root.children?.[0]?.standings?.entries ?? [];
  if (entries.length === 0) return null;
  const rows = entries.slice(0, 20).map((entry, index) => ({
    rank: stat(entry, ["rank"]) || index + 1,
    team: entry.team?.displayName ?? "unknown",
    played: stat(entry, ["gamesPlayed", "played"]),
    won: stat(entry, ["wins", "win"]),
    drawn: stat(entry, ["ties", "draws", "draw"]),
    lost: stat(entry, ["losses", "loss"]),
    gd: stat(entry, ["pointDifferential", "goalDifference", "differential"]),
    points: stat(entry, ["points"]),
  }));
  return { league, rows };
}

export function leaguesForPref(pref: BotPref) {
  const picked = pref.leagues.filter((id) => ESPN_LEAGUES[id]);
  const ids = picked.length > 0 ? picked : ["premier-league"];
  return ids.map((id) => ({ id, ...ESPN_LEAGUES[id] })).slice(0, 4);
}

function teamNeedles(pref: BotPref) {
  const options = allOptionsFor("pitch");
  const words: string[] = [];
  for (const team of pref.teams) {
    const option = options.find((row) => row.id === team);
    words.push(...(option?.keywords ?? [team.replace(/-/g, " ")]));
  }
  return [...new Set(words.map((word) => word.toLowerCase()))];
}

export function matchFollowsPref(match: LiveMatch, pref: BotPref) {
  const needles = teamNeedles(pref);
  if (needles.length === 0) return true;
  const hay = `${match.home.name} ${match.away.name} ${match.home.short} ${match.away.short}`.toLowerCase();
  return needles.some((needle) => hay.includes(needle));
}

export function lineForMatch(match: LiveMatch) {
  const score = `${match.home.short} ${match.home.score}-${match.away.score} ${match.away.short}`;
  if (match.status === "in") {
    return `LIVE ${score} (${match.clock || "in play"}) · ${match.league}`;
  }
  if (match.status === "post") {
    return `FT ${score} · ${match.league}`;
  }
  return `${match.home.short} vs ${match.away.short} · ${match.detail || "upcoming"} · ${match.league}`;
}

export function storyText(match: LiveMatch) {
  if (match.status === "in") {
    return `${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}, ${match.clock || "live"} in the ${match.league}. that's the live score right now.`;
  }
  if (match.status === "post") {
    return `full time: ${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}. ${match.league}.`;
  }
  return `${match.away.name} visit ${match.home.name} — ${match.detail || "upcoming"}. that's the next ${match.league} kickoff on the list.`;
}

export async function fetchScoreboard(leagueId: string): Promise<LiveMatch[]> {
  const meta = ESPN_LEAGUES[leagueId];
  if (!meta) return [];
  const raw = (await espnJson(scoreboardUrl(meta.slug))) as { events?: EspnEvent[] } | null;
  if (!raw?.events) return [];
  return raw.events
    .map((event) => parseMatch(event, meta.label, leagueId))
    .filter((row): row is LiveMatch => Boolean(row));
}

export async function fetchTable(leagueId: string) {
  const meta = ESPN_LEAGUES[leagueId];
  if (!meta) return null;
  const raw = await espnJson(standingsUrl(meta.slug));
  if (!raw) return null;
  return parseTable(raw, meta.label);
}

export async function footballSnapshot(pref: BotPref): Promise<FootballSnapshot> {
  const leagues = leaguesForPref(pref);
  const [matchLists, tables] = await Promise.all([
    Promise.all(leagues.map((league) => fetchScoreboard(league.id))),
    Promise.all(leagues.slice(0, 2).map((league) => fetchTable(league.id))),
  ]);
  const matches = matchLists.flat().filter((match) => matchFollowsPref(match, pref));
  const ranked = [...matches].sort((a, b) => {
    const rank = (status: LiveMatch["status"]) => (status === "in" ? 0 : status === "post" ? 1 : 2);
    return rank(a.status) - rank(b.status) || a.start - b.start;
  });
  const cleanTables = tables.filter((row): row is { league: string; rows: TableRow[] } => Boolean(row));
  return {
    matches: ranked,
    tables: cleanTables,
    asText: snapshotText(ranked, cleanTables, pref),
  };
}

function snapshotText(
  matches: LiveMatch[],
  tables: { league: string; rows: TableRow[] }[],
  pref: BotPref,
) {
  const lines: string[] = [];
  const live = matches.filter((row) => row.status === "in");
  const done = matches.filter((row) => row.status === "post");
  const next = matches.filter((row) => row.status === "pre").slice(0, 6);
  if (live.length) {
    lines.push("LIVE:");
    for (const match of live) lines.push(`- ${lineForMatch(match)}`);
  }
  if (done.length) {
    lines.push("FULL TIME:");
    for (const match of done.slice(0, 8)) lines.push(`- ${lineForMatch(match)}`);
  }
  if (next.length) {
    lines.push("UPCOMING:");
    for (const match of next) lines.push(`- ${lineForMatch(match)}`);
  }
  if (matches.length === 0) lines.push("no matches on the followed leagues/clubs right now.");
  for (const table of tables) {
    const needles = teamNeedles(pref);
    const followed = table.rows.filter((row) =>
      needles.some((needle) => row.team.toLowerCase().includes(needle)),
    );
    const shown = [...followed, ...table.rows.slice(0, 6)]
      .filter((row, index, all) => all.findIndex((item) => item.rank === row.rank) === index)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 8);
    lines.push(`${table.league} TABLE:`);
    for (const row of shown) {
      lines.push(
        `- ${row.rank}. ${row.team} ${row.points}pts (p${row.played} w${row.won} d${row.drawn} l${row.lost} gd${row.gd})`,
      );
    }
  }
  return lines.join("\n");
}

export async function matchesForPref(pref: BotPref): Promise<LiveMatch[]> {
  const leagues = leaguesForPref(pref);
  const lists = await Promise.all(leagues.map((league) => fetchScoreboard(league.id)));
  return lists.flat().filter((match) => matchFollowsPref(match, pref));
}
