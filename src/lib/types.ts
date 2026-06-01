export type RawMediaItem = {
    id: number;
    suchtext: string;
    bildnummer: string;
    fotografen: string;
    datum: string;
    hoehe?: string;
    breite?: string;
};

export type SearchItem = RawMediaItem & {
    dateIso: string | null;
    restrictions: string[];
    snippet: string;
    score?: number;
};

export type SortOrder = "date_asc" | "date_desc";

export type SearchParams = {
    q?: string;
    credit?: string;
    dateFrom?: string;
    dateTo?: string;
    restrictions?: string[];
    sort?: SortOrder;
    page?: number;
    pageSize?: number;
};

export type SearchResponse = {
    items: SearchItem[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    responseTimeMs: number;
};

export type FacetsResponse = {
    credits: string[];
    restrictions: string[];
    dateMin: string | null;
    dateMax: string | null;
};
