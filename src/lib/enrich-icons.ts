type EnrichableTopic = {
  type?: string;
  topic?: string;
  source_url?: string;
  sourceUrl?: string;
  icon?: string;
  image?: string;
};

type PolymarketEvent = {
  slug?: string;
  title?: string;
  question?: string;
  icon?: string;
  image?: string;
  markets?: Array<{
    slug?: string;
    question?: string;
    icon?: string;
    image?: string;
  }>;
};

function getSourceUrl(topic: EnrichableTopic) {
  return topic?.source_url || topic?.sourceUrl || "";
}

function getSlugFromSourceUrl(sourceUrl: string) {
  if (!sourceUrl) return null;

  try {
    const url = new URL(sourceUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const eventIndex = parts.findIndex(
      (part) => part === "event" || part === "market",
    );
    return eventIndex >= 0 ? parts[eventIndex + 1] || null : null;
  } catch {
    return null;
  }
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMatch(query: string, candidate: string) {
  const normalizedQuery = normalizeText(query);
  const normalizedCandidate = normalizeText(candidate);

  if (!normalizedQuery || !normalizedCandidate) return 0;
  if (normalizedQuery === normalizedCandidate) return 1000;
  if (normalizedCandidate.includes(normalizedQuery)) return 700;
  if (normalizedQuery.includes(normalizedCandidate)) return 500;

  const queryWords = normalizedQuery.split(" ").filter(Boolean);
  const candidateWords = new Set(
    normalizedCandidate.split(" ").filter(Boolean),
  );
  const overlap = queryWords.filter((word) => candidateWords.has(word)).length;
  return (
    overlap * 100 -
    Math.abs(normalizedCandidate.length - normalizedQuery.length)
  );
}

function getBestSearchMatch(query: string, events: PolymarketEvent[]) {
  let best:
    | {
        score: number;
        slug?: string;
        icon?: string;
        image?: string;
      }
    | undefined;

  for (const event of events) {
    const eventLabel = event.question || event.title || "";
    const eventScore = scoreMatch(query, eventLabel);
    if (!best || eventScore > best.score) {
      best = {
        score: eventScore,
        slug: event.slug,
        icon: event.icon,
        image: event.image,
      };
    }

    for (const market of event.markets || []) {
      const marketScore = scoreMatch(query, market.question || "");
      if (!best || marketScore > best.score) {
        best = {
          score: marketScore,
          slug: market.slug || event.slug,
          icon: market.icon || event.icon,
          image: market.image || event.image,
        };
      }
    }
  }

  return best;
}

async function enrichMissingIconsFromSearch<T extends EnrichableTopic>(
  topics: T[],
) {
  const results = await Promise.all(
    topics.map(async (topic) => {
      const query = topic.topic?.trim();
      if (!query) return topic;

      try {
        const searchUrl = `https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(query)}`;
        const res = await fetch(searchUrl, {
          cache: "no-store",
          headers: { "User-Agent": "hemlo/1.0" },
        });

        if (!res.ok) return topic;

        const payload = (await res.json()) as { events?: PolymarketEvent[] };
        const match = getBestSearchMatch(
          query,
          Array.isArray(payload?.events) ? payload.events : [],
        );

        if (!match || (!match.icon && !match.image)) return topic;

        return {
          ...topic,
          source_url:
            topic.source_url ||
            (match.slug
              ? `https://polymarket.com/event/${match.slug}`
              : undefined),
          sourceUrl:
            topic.sourceUrl ||
            (match.slug
              ? `https://polymarket.com/event/${match.slug}`
              : undefined),
          icon: topic.icon || match.icon || match.image,
          image: topic.image || match.image || match.icon,
        };
      } catch {
        return topic;
      }
    }),
  );

  return results;
}

export async function enrichWithIcons<T extends EnrichableTopic>(
  topics: T[],
): Promise<T[]> {
  const enriched = [...topics];

  const predictionMarkets = enriched.filter((t) => t.type === "prediction");
  if (predictionMarkets.length === 0) return enriched;

  const slugs = Array.from(
    new Set(
      predictionMarkets
        .map((t) => getSlugFromSourceUrl(getSourceUrl(t)))
        .filter(Boolean),
    ),
  );

  let topicsWithResolvedIcons = enriched;

  if (slugs.length > 0) {
    try {
      const url = `https://gamma-api.polymarket.com/events?slug=${slugs.join("&slug=")}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "User-Agent": "hemlo/1.0" },
      });

      if (res.ok) {
        const events = (await res.json()) as PolymarketEvent[];
        const iconMap: Record<string, { icon: string; image: string }> = {};
        events.forEach((ev) => {
          if (ev.slug) {
            iconMap[ev.slug] = {
              icon: ev.icon || ev.image || "",
              image: ev.image || ev.icon || "",
            };
          }
        });

        topicsWithResolvedIcons = enriched.map((t) => {
          if (t.type !== "prediction") return t;

          const slug = getSlugFromSourceUrl(getSourceUrl(t));
          if (!slug || !iconMap[slug]) return t;

          return {
            ...t,
            icon: t.icon || iconMap[slug].icon,
            image: t.image || iconMap[slug].image,
          };
        });
      }
    } catch (err) {
      console.error("Icon enrichment failed:", err);
    }
  }

  const missingIcons = topicsWithResolvedIcons.filter(
    (topic) => topic.type === "prediction" && !topic.icon && !topic.image,
  );

  if (missingIcons.length === 0) return topicsWithResolvedIcons;

  return enrichMissingIconsFromSearch(topicsWithResolvedIcons);
}
