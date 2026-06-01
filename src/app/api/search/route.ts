import { NextRequest, NextResponse } from "next/server";
import { recordSearch } from "@/lib/analytics";
import { searchMedia } from "@/lib/search";
import type { SearchParams, SortOrder } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseSearchParams(request: NextRequest): SearchParams {
    const params = request.nextUrl.searchParams;
    const sort = params.get("sort");

    return {
        q: params.get("q") ?? "",
        credit: params.get("credit") ?? undefined,
        dateFrom: params.get("dateFrom") ?? undefined,
        dateTo: params.get("dateTo") ?? undefined,
        restrictions: params.getAll("restriction").flatMap((value) => value.split(",")).filter(Boolean),
        sort: sort === "date_asc" || sort === "date_desc" ? (sort as SortOrder) : undefined,
        page: Number(params.get("page") ?? 1),
        pageSize: Number(params.get("pageSize") ?? 24)
    };
}

export function GET(request: NextRequest) {
    const searchParams = parseSearchParams(request);
    const result = searchMedia(searchParams);
    recordSearch(searchParams.q, result.responseTimeMs);
    return NextResponse.json(result);
}
