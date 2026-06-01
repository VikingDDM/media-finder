import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "IMAGO Media Finder",
    description: "Lightweight media metadata search demo with filtering, relevance scoring, and pagination."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}