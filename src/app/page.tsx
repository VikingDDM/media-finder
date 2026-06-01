"use client";

import { useEffect, useMemo, useState } from "react";
import type { FacetsResponse, SearchResponse, SortOrder } from "@/lib/types";

type FacetsPayload = FacetsResponse & { datasetSize: number };
type AnalyticsPayload = {
    searches: number;
    averageResponseTimeMs: number;
    topKeywords: Array<{ keyword: string; count: number }>;
};

const PAGE_SIZE = 18;

function useDebouncedValue<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const handle = window.setTimeout(() => setDebounced(value), delayMs);
        return () => window.clearTimeout(handle);
    }, [delayMs, value]);

    return debounced;
}

function buildParams(state: {
    query: string;
    credit: string;
    dateFrom: string;
    dateTo: string;
    restrictions: string[];
    sort: SortOrder;
    page: number;
}) {
    const params = new URLSearchParams({
        q: state.query,
        sort: state.sort,
        page: String(state.page),
        pageSize: String(PAGE_SIZE)
    });

    if (state.credit) params.set("credit", state.credit);
    if (state.dateFrom) params.set("dateFrom", state.dateFrom);
    if (state.dateTo) params.set("dateTo", state.dateTo);
    for (const restriction of state.restrictions) params.append("restriction", restriction);

    return params;
}

export default function Home() {
    const [query, setQuery] = useState("");
    const [credit, setCredit] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [restrictions, setRestrictions] = useState<string[]>([]);
    const [sort, setSort] = useState<SortOrder>("date_desc");
    const [page, setPage] = useState(1);
    const [facets, setFacets] = useState<FacetsPayload | null>(null);
    const [results, setResults] = useState<SearchResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRestrictionOpen, setIsRestrictionOpen] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
    const [popularKeywords, setPopularKeywords] = useState<AnalyticsPayload["topKeywords"]>([]);

    const debouncedQuery = useDebouncedValue(query, 250);

    function fetchAnalytics() {
        return fetch("/api/analytics")
            .then((response) => {
                if (!response.ok) throw new Error("Could not load frequent searches");
                return response.json() as Promise<AnalyticsPayload>;
            })
            .then((payload) => {
                setAnalytics(payload);
                return payload;
            });
    }

    useEffect(() => {
        fetch("/api/facets")
            .then((response) => {
                if (!response.ok) throw new Error("Could not load filters");
                return response.json() as Promise<FacetsPayload>;
            })
            .then(setFacets)
            .catch((caught: Error) => setError(caught.message));
    }, []);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const searchParams = useMemo(
        () =>
            buildParams({
                query: debouncedQuery,
                credit,
                dateFrom,
                dateTo,
                restrictions,
                sort,
                page
            }),
        [credit, dateFrom, dateTo, debouncedQuery, page, restrictions, sort]
    );

    useEffect(() => {
        const controller = new AbortController();
        setIsLoading(true);
        setError(null);

        fetch(`/api/search?${searchParams.toString()}`, { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error("Search failed");
                return response.json() as Promise<SearchResponse>;
            })
            .then((payload) => {
                setResults(payload);
                fetchAnalytics().catch(() => undefined);
            })
            .catch((caught: Error) => {
                if (caught.name !== "AbortError") setError(caught.message);
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false);
            });

        return () => controller.abort();
    }, [searchParams]);

    function toggleRestriction(value: string) {
        setRestrictions((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
        setPage(1);
    }

    function loadPopularKeywords() {
        setIsSearchFocused(true);
        fetchAnalytics()
            .then((payload) => setPopularKeywords(payload.topKeywords))
            .catch(() => setPopularKeywords([]));
    }

    function resetFilters() {
        setQuery("");
        setCredit("");
        setDateFrom("");
        setDateTo("");
        setRestrictions([]);
        setPage(1);
    }

    const hasActiveFilters = query || credit || dateFrom || dateTo || restrictions.length > 0;

    return (
        <main className="min-h-screen">
            <section className="border-b border-line bg-white/70">
                <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-wide text-rust">IMAGO search layer</p>
                            <h1 className="mt-1 text-3xl font-semibold text-ink sm:text-4xl">Media metadata finder</h1>
                        </div>
                        <div className="text-sm text-ink/70">
                            {analytics ? `${analytics.searches.toLocaleString()} searches` : "Loading searches"}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                        <div className="relative flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium">
                            <label htmlFor="media-search">Search</label>
                            <input
                                id="media-search"
                                className="focus-ring h-12 rounded-md border border-line bg-white px-4 text-base shadow-sm"
                                placeholder="Try Chelsea, Swift, PUBLICATION IN GER, 0001000003"
                                value={query}
                                onBlur={() => window.setTimeout(() => setIsSearchFocused(false), 120)}
                                onChange={(event) => {
                                    setQuery(event.target.value);
                                    setPage(1);
                                }}
                                onFocus={loadPopularKeywords}
                            />
                            {isSearchFocused && popularKeywords.length > 0 && (
                                <div className="absolute left-0 right-0 top-[76px] z-30 rounded-md border border-line bg-white p-2 shadow-soft">
                                    <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-ink/50">Frequent searches</div>
                                    <div className="flex flex-wrap gap-2">
                                        {popularKeywords.map((item) => (
                                            <button
                                                key={item.keyword}
                                                className="focus-ring rounded-md bg-field px-3 py-2 text-sm font-medium text-ink hover:bg-line"
                                                type="button"
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={() => {
                                                    setQuery(item.keyword);
                                                    setPage(1);
                                                    setIsSearchFocused(false);
                                                }}
                                            >
                                                {item.keyword}
                                                <span className="ml-2 text-xs text-ink/50">{item.count}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {hasActiveFilters && (
                            <button
                                className="focus-ring h-12 rounded-md border border-line bg-white px-3 text-sm font-semibold text-ink shadow-sm hover:border-rust"
                                type="button"
                                onClick={resetFilters}
                            >
                                Reset filters
                            </button>
                        )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_minmax(260px,1fr)_180px_180px]">
                        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
                            Credit
                            <select
                                className="focus-ring h-11 rounded-md border border-line bg-white px-3 shadow-sm"
                                value={credit}
                                onChange={(event) => {
                                    setCredit(event.target.value);
                                    setPage(1);
                                }}
                            >
                                <option value="">All credits</option>
                                {facets?.credits.map((item) => (
                                    <option key={item} value={item}>
                                        {item}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className="relative flex flex-col gap-1 text-sm font-medium">
                            <span id="restriction-label">Restrictions</span>
                            <button
                                className="focus-ring flex h-11 items-center justify-between gap-3 rounded-md border border-line bg-white px-3 text-left shadow-sm"
                                type="button"
                                aria-controls="restriction-menu"
                                aria-expanded={isRestrictionOpen}
                                aria-haspopup="listbox"
                                onClick={() => setIsRestrictionOpen((current) => !current)}
                            >
                                <span className="truncate">{restrictions.length > 0 ? `${restrictions.length} selected` : "All restrictions"}</span>
                                <span aria-hidden="true" className="text-ink/50">
                                    v
                                </span>
                            </button>
                            {isRestrictionOpen && (
                                <div
                                    id="restriction-menu"
                                    className="absolute left-0 right-0 top-[70px] z-20 max-h-72 overflow-y-auto rounded-md border border-line bg-white p-2 shadow-soft"
                                    role="listbox"
                                    aria-labelledby="restriction-label"
                                    aria-multiselectable="true"
                                >
                                    {facets?.restrictions.map((restriction) => {
                                        const selected = restrictions.includes(restriction);
                                        return (
                                            <label
                                                key={restriction}
                                                className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm font-medium hover:bg-field"
                                            >
                                                <input
                                                    className="mt-1 accent-moss"
                                                    type="checkbox"
                                                    checked={selected}
                                                    onChange={() => toggleRestriction(restriction)}
                                                />
                                                <span>{restriction}</span>
                                            </label>
                                        );
                                    })}
                                    {restrictions.length > 0 && (
                                        <button
                                            className="focus-ring mt-1 w-full rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:border-rust"
                                            type="button"
                                            onClick={() => {
                                                setRestrictions([]);
                                                setPage(1);
                                            }}
                                        >
                                            Clear restrictions
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <label className="flex flex-col gap-1 text-sm font-medium">
                            From
                            <input
                                className="focus-ring h-11 rounded-md border border-line bg-white px-3 shadow-sm"
                                type="date"
                                min={facets?.dateMin ?? undefined}
                                max={facets?.dateMax ?? undefined}
                                value={dateFrom}
                                onChange={(event) => {
                                    setDateFrom(event.target.value);
                                    setPage(1);
                                }}
                            />
                        </label>

                        <label className="flex flex-col gap-1 text-sm font-medium">
                            To
                            <input
                                className="focus-ring h-11 rounded-md border border-line bg-white px-3 shadow-sm"
                                type="date"
                                min={facets?.dateMin ?? undefined}
                                max={facets?.dateMax ?? undefined}
                                value={dateTo}
                                onChange={(event) => {
                                    setDateTo(event.target.value);
                                    setPage(1);
                                }}
                            />
                        </label>
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                <div className="mb-4 flex min-h-8 flex-col gap-3 text-sm text-ink/70 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        {results ? (
                            <>
                                <span className="font-semibold text-ink">{results.total.toLocaleString()}</span> results in{" "}
                                {results.responseTimeMs.toFixed(2)} ms
                            </>
                        ) : (
                            "Preparing results"
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <label className="flex items-center gap-2 font-medium text-ink">
                            Date sort
                            <select
                                className="focus-ring h-10 rounded-md border border-line bg-white px-3 text-sm shadow-sm"
                                value={sort}
                                onChange={(event) => {
                                    setSort(event.target.value as SortOrder);
                                    setPage(1);
                                }}
                            >
                                <option value="date_desc">Newest first</option>
                                <option value="date_asc">Oldest first</option>
                            </select>
                        </label>
                    </div>
                </div>

                {error ? (
                    <div className="rounded-md border border-rust bg-white p-5 text-rust shadow-soft">{error}</div>
                ) : isLoading ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {Array.from({ length: 6 }, (_, index) => (
                            <div key={index} className="h-48 animate-pulse rounded-md border border-line bg-white shadow-sm" />
                        ))}
                    </div>
                ) : results && results.items.length === 0 ? (
                    <div className="rounded-md border border-line bg-white p-8 text-center shadow-soft">
                        <h2 className="text-xl font-semibold">No media items found</h2>
                        <p className="mt-2 text-ink/70">Broaden the query or remove one of the active filters.</p>
                    </div>
                ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {results?.items.map((item) => (
                            <article key={item.id} className="flex min-h-56 flex-col rounded-md border border-line bg-white p-4 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className="font-mono text-base font-semibold text-ink">{item.bildnummer}</h2>
                                        <p className="mt-1 text-sm text-ink/70">{item.fotografen}</p>
                                    </div>
                                    <time className="rounded-md bg-field px-2 py-1 text-sm font-medium text-moss" dateTime={item.dateIso ?? undefined}>
                                        {item.datum}
                                    </time>
                                </div>

                                <p className="mt-4 flex-1 text-sm leading-6 text-ink/80">{item.snippet}</p>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    {item.restrictions.length > 0 ? (
                                        item.restrictions.map((restriction) => (
                                            <span key={restriction} className="rounded-md bg-field px-2 py-1 text-xs font-medium text-moss">
                                                {restriction}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="rounded-md bg-field px-2 py-1 text-xs font-medium text-ink/50">No restriction detected</span>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                {results && results.totalPages > 1 && (
                    <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Pagination">
                        <button
                            className="focus-ring rounded-md border border-line bg-white px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
                            type="button"
                            disabled={results.page <= 1}
                            onClick={() => setPage((current) => Math.max(1, current - 1))}
                        >
                            Previous
                        </button>
                        <span className="text-sm font-medium text-ink/70">
                            Page {results.page} of {results.totalPages}
                        </span>
                        <button
                            className="focus-ring rounded-md border border-line bg-white px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
                            type="button"
                            disabled={results.page >= results.totalPages}
                            onClick={() => setPage((current) => current + 1)}
                        >
                            Next
                        </button>
                    </nav>
                )}
            </section>
        </main>
    );
}
