import seed from "../../seed.json";
import type { FacetsResponse, RawMediaItem, SearchItem, SearchParams, SearchResponse } from "./types";

type IndexedItem = SearchItem & {
    searchText: string;
    weightedTokens: Map<string, number>;
    tokenSet: Set<string>;
    time: number;
};

const STOP_WORDS = new Set([
    "a",
    "an",
    "and",
    "auf",
    "der",
    "die",
    "das",
    "for",
    "her",
    "his",
    "in",
    "mit",
    "of",
    "the",
    "und",
    "x"
]);

const RESTRICTION_PATTERN = /\bPUBLICATIONx(?:IN|NOT)x[A-Zx]+(?:ONLY)?\b/g;
const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;
const MAX_PAGE_SIZE = 100;

const rawItems = seed as RawMediaItem[];

function normalizeText(value: string): string {
    return value
        .normalize("NFKD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_/.-]+/g, " ")
        .toLowerCase();
}

function tokenize(value: string): string[] {
    const normalized = normalizeText(value);
    return [...normalized.matchAll(TOKEN_PATTERN)]
        .map((match) => match[0])
        .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function parseDate(value: string): string | null {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
    if (!match) return null;

    const [, day, month, year] = match;
    const iso = `${year}-${month}-${day}`;
    const date = new Date(`${iso}T00:00:00.000Z`);

    if (
        Number.isNaN(date.getTime()) ||
        date.getUTCFullYear() !== Number(year) ||
        date.getUTCMonth() + 1 !== Number(month) ||
        date.getUTCDate() !== Number(day)
    ) {
        return null;
    }

    return iso;
}

export function extractRestrictions(value: string): string[] {
    const matches = value.match(RESTRICTION_PATTERN) ?? [];
    return [...new Set(matches.map((match) => match.replaceAll("x", " ").trim()))];
}

function addWeightedTokens(target: Map<string, number>, value: string, weight: number) {
    for (const token of tokenize(value)) {
        target.set(token, Math.max(target.get(token) ?? 0, weight));
    }
}

function buildIndex(items: RawMediaItem[]): IndexedItem[] {
    return items.map((item) => {
        const dateIso = parseDate(item.datum);
        const restrictions = extractRestrictions(item.suchtext);
        const weightedTokens = new Map<string, number>();

        addWeightedTokens(weightedTokens, item.suchtext, 6);
        addWeightedTokens(weightedTokens, item.fotografen, 3);
        addWeightedTokens(weightedTokens, item.bildnummer, 2);
        for (const restriction of restrictions) {
            addWeightedTokens(weightedTokens, restriction, 1);
        }

        return {
            ...item,
            dateIso,
            restrictions,
            snippet: item.suchtext,
            searchText: normalizeText(`${item.suchtext} ${item.fotografen} ${item.bildnummer}`),
            weightedTokens,
            tokenSet: new Set(weightedTokens.keys()),
            time: dateIso ? Date.parse(`${dateIso}T00:00:00.000Z`) : 0
        };
    });
}

const index = buildIndex(rawItems);

const facets: FacetsResponse = (() => {
    const credits = new Set<string>();
    const restrictions = new Set<string>();
    const dates: string[] = [];

    for (const item of index) {
        credits.add(item.fotografen);
        item.restrictions.forEach((restriction) => restrictions.add(restriction));
        if (item.dateIso) dates.push(item.dateIso);
    }

    dates.sort();

    return {
        credits: [...credits].sort((a, b) => a.localeCompare(b)),
        restrictions: [...restrictions].sort((a, b) => a.localeCompare(b)),
        dateMin: dates[0] ?? null,
        dateMax: dates.at(-1) ?? null
    };
})();

function getScore(item: IndexedItem, queryTokens: string[]): number {
    if (queryTokens.length === 0) return 0;

    let score = 0;
    for (const queryToken of queryTokens) {
        const exactWeight = item.weightedTokens.get(queryToken);
        if (exactWeight) {
            score += exactWeight * 10;
            continue;
        }

        let prefixWeight = 0;
        for (const token of item.tokenSet) {
            if (token.startsWith(queryToken) || queryToken.startsWith(token)) {
                prefixWeight = Math.max(prefixWeight, item.weightedTokens.get(token) ?? 0);
            }
        }
        score += prefixWeight * 4;
    }

    return score;
}

function makeSnippet(text: string, queryTokens: string[]): string {
    if (queryTokens.length === 0) return text.length > 180 ? `${text.slice(0, 177)}...` : text;

    const normalized = normalizeText(text);
    const firstHit = queryTokens
        .map((token) => normalized.indexOf(token))
        .filter((position) => position >= 0)
        .sort((a, b) => a - b)[0];

    if (firstHit === undefined) {
        return text.length > 180 ? `${text.slice(0, 177)}...` : text;
    }

    const start = Math.max(0, firstHit - 55);
    const end = Math.min(text.length, firstHit + 135);
    return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

function normalizePage(value: unknown, fallback: number): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : fallback;
}

export function getFacets(): FacetsResponse {
    return facets;
}

export function searchMedia(params: SearchParams): SearchResponse {
    const startedAt = performance.now();
    const queryTokens = tokenize(params.q ?? "");
    const page = normalizePage(params.page, 1);
    const pageSize = Math.min(normalizePage(params.pageSize, 24), MAX_PAGE_SIZE);
    const fromTime = params.dateFrom ? Date.parse(`${params.dateFrom}T00:00:00.000Z`) : null;
    const toTime = params.dateTo ? Date.parse(`${params.dateTo}T23:59:59.999Z`) : null;
    const selectedRestrictions = new Set(params.restrictions?.filter(Boolean) ?? []);

    const matched: SearchItem[] = [];

    for (const item of index) {
        if (params.credit && item.fotografen !== params.credit) continue;
        if (fromTime && item.time < fromTime) continue;
        if (toTime && item.time > toTime) continue;
        if (selectedRestrictions.size > 0 && !item.restrictions.some((restriction) => selectedRestrictions.has(restriction))) {
            continue;
        }

        const score = getScore(item, queryTokens);
        if (queryTokens.length > 0 && score <= 0) continue;

        matched.push({
            id: item.id,
            suchtext: item.suchtext,
            bildnummer: item.bildnummer,
            fotografen: item.fotografen,
            datum: item.datum,
            hoehe: item.hoehe,
            breite: item.breite,
            dateIso: item.dateIso,
            restrictions: item.restrictions,
            snippet: makeSnippet(item.suchtext, queryTokens),
            score
        });
    }

    matched.sort((a, b) => {
        if (params.sort === "date_asc") {
            return Date.parse(a.dateIso ?? "0000-01-01") - Date.parse(b.dateIso ?? "0000-01-01");
        }
        if (params.sort === "date_desc") {
            return Date.parse(b.dateIso ?? "0000-01-01") - Date.parse(a.dateIso ?? "0000-01-01");
        }
        return (b.score ?? 0) - (a.score ?? 0) || Date.parse(b.dateIso ?? "0000-01-01") - Date.parse(a.dateIso ?? "0000-01-01");
    });

    const total = matched.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;

    return {
        items: matched.slice(start, start + pageSize),
        page: safePage,
        pageSize,
        total,
        totalPages,
        responseTimeMs: Math.round((performance.now() - startedAt) * 100) / 100
    };
}

export function getDatasetSize(): number {
    return index.length;
}
