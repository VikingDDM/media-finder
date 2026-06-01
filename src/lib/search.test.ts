import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractRestrictions, parseDate, searchMedia } from "./search";

describe("search preprocessing", () => {
    it("normalizes German date strings to ISO dates", () => {
        assert.equal(parseDate("30.03.1952"), "1952-03-30");
        assert.equal(parseDate("31.02.1952"), null);
    });

    it("extracts publication restriction tokens", () => {
        assert.deepEqual(extractRestrictions("caption PUBLICATIONxINxGERxSUIxAUTxONLY"), [
            "PUBLICATION IN GER SUI AUT ONLY"
        ]);
    });
});

describe("searchMedia", () => {
    it("matches text queries with weighted relevance", () => {
        const result = searchMedia({ q: "Chelsea", pageSize: 5 });
        assert.ok(result.total > 0);
        assert.match(result.items[0].suchtext, /Chelsea/i);
    });

    it("filters by credit, restriction, and date range", () => {
        const result = searchMedia({
            credit: "IMAGO / Bildbyran",
            restrictions: ["PUBLICATION NOT IN JPN"],
            dateFrom: "1952-01-01",
            dateTo: "1952-12-31"
        });

        assert.ok(result.total > 0);
        assert.equal(result.items[0].fotografen, "IMAGO / Bildbyran");
        assert.ok(result.items[0].restrictions.includes("PUBLICATION NOT IN JPN"));
    });

    it("sorts by date ascending", () => {
        const result = searchMedia({ q: "PUBLICATION", sort: "date_asc", pageSize: 20 });
        const dates = result.items.map((item) => item.dateIso ?? "");
        assert.deepEqual(dates, [...dates].sort());
    });
});
