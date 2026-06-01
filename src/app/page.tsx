"use client";
import { useEffect, useMemo, useState } from "react";

export default function Home() {
    return (
        <main className="min-h-screen">
            <section className="border-b border-line bg-white/70">
                <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-wide text-rust">IMAGO search</p>
                            <h1 className="mt-1 text-3xl font-semibold text-ink sm:text-4xl">Media metadata finder</h1>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}