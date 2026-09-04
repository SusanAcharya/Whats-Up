import { BOT_IDS, type BotId, type BotPref, type Preferences } from "./types";

export type PrefOption = { id: string; label: string; keywords: string[] };

export type PrefSection = {
  key: keyof BotPref;
  label: string;
  options: PrefOption[];
  allowCustom?: boolean;
  dependsOn?: { key: keyof BotPref; values: string[] };
};

export type BotPrefConfig = {
  botId: BotId;
  blurb: string;
  sections: PrefSection[];
};

function opt(id: string, label: string, keywords: string[] = [label]): PrefOption {
  return { id, label, keywords };
}

const SOCCER_LEAGUES: PrefOption[] = [
  opt("premier-league", "Premier League", ["premier league", "epl"]),
  opt("la-liga", "La Liga", ["la liga"]),
  opt("serie-a", "Serie A", ["serie a"]),
  opt("bundesliga", "Bundesliga", ["bundesliga"]),
  opt("ligue-1", "Ligue 1", ["ligue 1"]),
  opt("champions-league", "Champions League", ["champions league", "ucl"]),
  opt("europa-league", "Europa League", ["europa league"]),
  opt("mls", "MLS", ["mls", "major league soccer"]),
  opt("world-cup", "World Cup", ["world cup", "fifa"]),
  opt("euros", "Euros", ["euros", "european championship"]),
];

const SOCCER_TEAMS: PrefOption[] = [
  opt("real-madrid", "Real Madrid"),
  opt("barcelona", "Barcelona", ["barcelona", "barca"]),
  opt("liverpool", "Liverpool"),
  opt("arsenal", "Arsenal"),
  opt("man-city", "Man City", ["manchester city", "man city"]),
  opt("man-united", "Man United", ["manchester united", "man utd", "man united"]),
  opt("chelsea", "Chelsea"),
  opt("tottenham", "Tottenham", ["tottenham", "spurs"]),
  opt("bayern", "Bayern Munich", ["bayern"]),
  opt("psg", "PSG", ["psg", "paris saint-germain"]),
  opt("inter", "Inter Milan", ["inter milan", "inter "]),
  opt("juventus", "Juventus"),
  opt("atletico", "Atletico Madrid", ["atletico"]),
  opt("napoli", "Napoli"),
  opt("dortmund", "Dortmund", ["borussia dortmund", "dortmund"]),
];

const NBA_TEAMS: PrefOption[] = [
  opt("lakers", "Lakers"),
  opt("celtics", "Celtics"),
  opt("warriors", "Warriors"),
  opt("knicks", "Knicks"),
  opt("nuggets", "Nuggets"),
  opt("mavericks", "Mavericks"),
  opt("heat", "Heat"),
  opt("bucks", "Bucks"),
];

const NFL_TEAMS: PrefOption[] = [
  opt("chiefs", "Chiefs"),
  opt("eagles", "Eagles"),
  opt("49ers", "49ers"),
  opt("cowboys", "Cowboys"),
  opt("bills", "Bills"),
  opt("lions", "Lions"),
];

export const BOT_PREF_CONFIG: BotPrefConfig[] = [
  {
    botId: "sporty",
    blurb: "Pick a sport, then the leagues and teams you actually care about. Sporty will ignore the rest.",
    sections: [
      {
        key: "sports",
        label: "Sport",
        options: [
          opt("soccer", "Football / Soccer", ["soccer", "fifa", "uefa", "football"]),
          opt("nba", "NBA", ["nba", "basketball"]),
          opt("nfl", "NFL", ["nfl"]),
          opt("tennis", "Tennis", ["tennis", "atp", "wta", "wimbledon", "us open"]),
          opt("f1", "Formula 1", ["formula 1", "f1", "grand prix"]),
          opt("cricket", "Cricket", ["cricket", "ipl", "test match"]),
          opt("mma", "MMA", ["mma", "ufc", "bellator", "fight night"]),
        ],
      },
      {
        key: "leagues",
        label: "Leagues",
        dependsOn: { key: "sports", values: ["soccer"] },
        options: SOCCER_LEAGUES,
      },
      {
        key: "teams",
        label: "Clubs",
        dependsOn: { key: "sports", values: ["soccer"] },
        options: SOCCER_TEAMS,
        allowCustom: true,
      },
      {
        key: "leagues",
        label: "NBA",
        dependsOn: { key: "sports", values: ["nba"] },
        options: [opt("nba-league", "NBA season", ["nba"])],
      },
      {
        key: "teams",
        label: "NBA teams",
        dependsOn: { key: "sports", values: ["nba"] },
        options: NBA_TEAMS,
        allowCustom: true,
      },
      {
        key: "leagues",
        label: "NFL",
        dependsOn: { key: "sports", values: ["nfl"] },
        options: [opt("nfl-league", "NFL season", ["nfl"])],
      },
      {
        key: "teams",
        label: "NFL teams",
        dependsOn: { key: "sports", values: ["nfl"] },
        options: NFL_TEAMS,
        allowCustom: true,
      },
      {
        key: "teams",
        label: "Players",
        dependsOn: { key: "sports", values: ["tennis"] },
        options: [
          opt("djokovic", "Djokovic"),
          opt("alcaraz", "Alcaraz"),
          opt("swiatek", "Swiatek"),
          opt("sinner", "Sinner"),
        ],
        allowCustom: true,
      },
      {
        key: "teams",
        label: "Teams",
        dependsOn: { key: "sports", values: ["f1"] },
        options: [
          opt("ferrari", "Ferrari"),
          opt("red-bull", "Red Bull", ["red bull", "verstappen"]),
          opt("mclaren", "McLaren"),
          opt("mercedes", "Mercedes", ["mercedes", "hamilton"]),
        ],
        allowCustom: true,
      },
      {
        key: "teams",
        label: "Sides",
        dependsOn: { key: "sports", values: ["cricket"] },
        options: [
          opt("india", "India"),
          opt("australia", "Australia"),
          opt("england", "England"),
          opt("csk", "CSK", ["chennai super kings", "csk"]),
          opt("mi", "Mumbai Indians", ["mumbai indians"]),
        ],
        allowCustom: true,
      },
    ],
  },
  {
    botId: "pitch",
    blurb: "Leagues and clubs for live scores. Ask pitch in the DM — table, kickoff, who's winning.",
    sections: [
      {
        key: "leagues",
        label: "Leagues",
        options: SOCCER_LEAGUES,
      },
      {
        key: "teams",
        label: "Clubs",
        options: SOCCER_TEAMS,
        allowCustom: true,
      },
    ],
  },
  {
    botId: "globie",
    blurb: "Regions and beats. Globie stays quiet unless it matches.",
    sections: [
      {
        key: "topics",
        label: "Focus",
        options: [
          opt("world", "World", ["world", "global", "united nations"]),
          opt("war", "Conflict", ["war", "ceasefire", "invasion", "gaza", "ukraine"]),
          opt("politics", "Politics", ["election", "president", "prime minister", "parliament"]),
          opt("asia", "Asia", ["china", "india", "japan", "taiwan", "korea"]),
          opt("europe", "Europe", ["eu", "europe", "uk", "france", "germany"]),
          opt("americas", "Americas", ["united states", "brazil", "mexico", "canada"]),
          opt("climate", "Climate", ["climate", "wildfire", "hurricane", "flood"]),
        ],
      },
    ],
  },
  {
    botId: "techie",
    blurb: "Companies and beats. No random startup noise unless you ask for it.",
    sections: [
      {
        key: "topics",
        label: "Beats",
        options: [
          opt("ai", "AI", [
            "ai",
            "openai",
            "anthropic",
            "gemini",
            "llm",
            "chatgpt",
            "claude",
            "artificial intelligence",
          ]),
          opt("apple", "Apple", ["apple", "iphone", "ipad", "macos"]),
          opt("google", "Google", ["google", "android", "youtube", "gemini"]),
          opt("microsoft", "Microsoft", ["microsoft", "windows", "openai"]),
          opt("meta", "Meta", ["meta", "instagram", "facebook", "whatsapp"]),
          opt("nvidia", "Nvidia", ["nvidia"]),
          opt("security", "Security", ["hack", "breach", "ransomware", "privacy"]),
          opt("startups", "Startups", ["startup", "funding", "series a", "ipo"]),
        ],
      },
    ],
  },
  {
    botId: "popcorn",
    blurb: "What kind of culture ping you want.",
    sections: [
      {
        key: "topics",
        label: "Focus",
        options: [
          opt("movies", "Movies", ["movie", "film", "box office", "trailer", "oscar"]),
          opt("tv", "TV", ["netflix", "hbo", "disney+", "amazon prime", "prime video", "series", "emmy"]),
          opt("music", "Music", ["album", "tour", "grammy", "billboard", "spotify"]),
          opt("celebrity", "Celebrity", ["celebrity", "red carpet"]),
          opt("games", "Games", ["game", "video game", "playstation", "xbox", "nintendo", "steam", "twitch"]),
        ],
      },
    ],
  },
  {
    botId: "stonks",
    blurb: "Macro vs companies. Stonks will not dump random tickers on you.",
    sections: [
      {
        key: "topics",
        label: "Focus",
        options: [
          opt("macro", "Macro", ["fed", "inflation", "recession", "interest rate", "jobs report"]),
          opt("markets", "Markets", ["stock", "s&p", "nasdaq", "dow", "crypto", "wall street"]),
          opt("tech-biz", "Big tech", ["apple", "microsoft", "nvidia", "amazon", "alphabet", "google"]),
          opt("jobs", "Jobs / layoffs", ["layoff", "hiring", "unemployment"]),
          opt("energy", "Energy", ["oil", "opec", "gas prices"]),
        ],
      },
    ],
  },
  {
    botId: "labrat",
    blurb: "Pick the science you actually read.",
    sections: [
      {
        key: "topics",
        label: "Focus",
        options: [
          opt("space", "Space", ["nasa", "spacex", "mars", "telescope", "orbit"]),
          opt("climate", "Climate", ["climate", "emissions", "glacier"]),
          opt("health", "Health", ["vaccine", "cancer", "fda", "study"]),
          opt("physics", "Physics", ["quantum", "particle", "fusion"]),
          opt("bio", "Biology", ["gene", "crispr", "dna"]),
          opt("ai-science", "AI", ["ai", "machine learning", "neural net", "llm"]),
        ],
      },
    ],
  },
];

export function emptyPref(): BotPref {
  return { sports: [], leagues: [], teams: [], topics: [], keywords: [] };
}

export function defaultPreferences(): Preferences {
  return {
    globie: { ...emptyPref(), topics: ["world", "politics"] },
    sporty: {
      ...emptyPref(),
      sports: ["soccer", "cricket", "f1", "mma"],
      leagues: ["premier-league", "champions-league"],
      teams: ["chelsea"],
      keywords: ["fantasy premier league", "fpl"],
    },
    techie: {
      ...emptyPref(),
      topics: ["ai", "apple", "google", "meta", "startups"],
      keywords: [
        "chatgpt",
        "openai",
        "claude",
        "anthropic",
        "gemini",
        "ai products",
        "ai companies",
      ],
    },
    popcorn: {
      ...emptyPref(),
      topics: ["movies", "music", "tv", "games"],
      keywords: ["spotify", "netflix", "amazon prime", "box office", "video games", "twitch"],
    },
    stonks: {
      ...emptyPref(),
      topics: ["markets", "tech-biz", "jobs"],
      keywords: ["apple", "nvidia", "ipo", "wall street", "nepse", "google"],
    },
    labrat: {
      ...emptyPref(),
      topics: ["space", "physics", "climate", "ai-science"],
      keywords: ["nasa", "ai"],
    },
    pitch: {
      ...emptyPref(),
      leagues: ["premier-league", "la-liga", "champions-league"],
    },
  };
}

export function normalizePreferences(raw: unknown): Preferences {
  const defaults = defaultPreferences();
  if (!raw || typeof raw !== "object") return defaults;
  const input = raw as Partial<Record<BotId, Partial<BotPref>>>;
  const bots: BotId[] = [...BOT_IDS];
  const next = { ...defaults };
  for (const id of bots) {
    const row = input[id];
    if (!row) continue;
    next[id] = {
      sports: cleanList(row.sports),
      leagues: cleanList(row.leagues),
      teams: cleanList(row.teams),
      topics: cleanList(row.topics),
      keywords: cleanList(row.keywords),
    };
  }
  return next;
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim().toLowerCase().slice(0, 40)).filter(Boolean))].slice(0, 20);
}

export function allOptionsFor(botId: BotId): PrefOption[] {
  const config = BOT_PREF_CONFIG.find((row) => row.botId === botId);
  return config?.sections.flatMap((section) => section.options) ?? [];
}

export function keywordsForPref(botId: BotId, pref: BotPref): string[] {
  const options = allOptionsFor(botId);
  const selected = [...pref.sports, ...pref.leagues, ...pref.topics];
  const words: string[] = [];
  for (const id of selected) {
    const option = options.find((row) => row.id === id);
    if (option) words.push(...option.keywords);
    else words.push(id);
  }
  for (const team of pref.teams) {
    const option = options.find((row) => row.id === team);
    words.push(...(option?.keywords ?? [team.replace(/-/g, " ")]));
  }
  for (const word of pref.keywords ?? []) words.push(word);
  if (botId === "sporty" && pref.sports.includes("soccer")) {
    const soccerLeagueIds = new Set(SOCCER_LEAGUES.map((row) => row.id));
    const picked = pref.leagues.filter((id) => soccerLeagueIds.has(id));
    if (picked.length === 0 && pref.teams.length === 0) {
      words.push(...SOCCER_LEAGUES.flatMap((row) => row.keywords));
    }
  }
  return [...new Set(words.map((word) => word.toLowerCase()))];
}

export function prunePref(botId: BotId, pref: BotPref): BotPref {
  const config = BOT_PREF_CONFIG.find((row) => row.botId === botId);
  if (!config) return pref;
  const allOptionIds = new Set(
    config.sections.flatMap((section) => section.options.map((option) => option.id)),
  );
  const visibleOptionIds = new Set<string>();
  for (const section of config.sections) {
    if (!sectionVisible(section, pref)) continue;
    for (const option of section.options) visibleOptionIds.add(option.id);
  }
  const customOk = config.sections.some(
    (section) => section.allowCustom && sectionVisible(section, pref),
  );
  const keep = (id: string) => {
    if (!allOptionIds.has(id)) return customOk;
    return visibleOptionIds.has(id);
  };
  return {
    sports: pref.sports.filter(keep),
    leagues: pref.leagues.filter(keep),
    teams: pref.teams.filter(keep),
    topics: pref.topics.filter(keep),
    keywords: pref.keywords ?? [],
  };
}

export function prunePreferences(prefs: Preferences): Preferences {
  const bots: BotId[] = [...BOT_IDS];
  const next = { ...prefs };
  for (const id of bots) next[id] = prunePref(id, prefs[id]);
  return next;
}

export function prefSummary(botId: BotId, pref: BotPref): string {
  const options = allOptionsFor(botId);
  const ids = [...pref.sports, ...pref.leagues, ...pref.topics, ...pref.teams, ...(pref.keywords ?? [])];
  const labels = ids
    .map((id) => options.find((row) => row.id === id)?.label ?? id.replace(/-/g, " "))
    .filter(Boolean);
  if (labels.length === 0) return "using defaults";
  return labels.slice(0, 4).join(" · ") + (labels.length > 4 ? " +" : "");
}

export function googleNewsSearch(query: string) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

export function feedsForPref(botId: BotId, pref: BotPref, fallback: string[]): string[] {
  const keywords = keywordsForPref(botId, pref);
  if (keywords.length === 0) return fallback;
  const query = `${keywords
    .slice(0, 8)
    .map((word) => (word.includes(" ") ? `"${word}"` : word))
    .join(" OR ")} when:1d`;
  // Publisher feeds first — they usually include images. Google News is coverage only.
  const publishers = fallback.filter((url) => !url.includes("news.google."));
  const googleFallback = fallback.filter((url) => url.includes("news.google."));
  return [...publishers, googleNewsSearch(query), ...googleFallback].slice(0, 4);
}

export function sectionVisible(section: PrefSection, pref: BotPref) {
  if (!section.dependsOn) return true;
  const selected = pref[section.dependsOn.key];
  return section.dependsOn.values.some((value) => selected.includes(value));
}