import { NextResponse } from "next/server";
import { getDatasetSize, getFacets } from "@/lib/search";

export const dynamic = "force-static";

export function GET() {
    return NextResponse.json({
        ...getFacets(),
        datasetSize: getDatasetSize()
    });
}
