type AnalyticsSnapshot = {
    searches: number;
    averageResponseTimeMs: number;
    topKeywords: Array<{ keyword: string; count: number }>;
};

const keywordCounts = new Map<string, number>();
let searches = 0;
let totalResponseTimeMs = 0;

function tokenizeQuery(query: string): string[] {
    return query
        .toLowerCase()
        .split(/[^a-z0-9\u00c0-\u024f]+/i)
        .map((token) => token.trim())
        .filter((token) => token.length > 1);
}

export function recordSearch(query: string | undefined, responseTimeMs: number) {
    searches += 1;
    totalResponseTimeMs += responseTimeMs;

    for (const keyword of tokenizeQuery(query ?? "")) {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1);
    }
}

export function getAnalytics(): AnalyticsSnapshot {
    return {
        searches,
        averageResponseTimeMs: searches === 0 ? 0 : Math.round((totalResponseTimeMs / searches) * 100) / 100,
        topKeywords: [...keywordCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([keyword, count]) => ({ keyword, count }))
    };
}
