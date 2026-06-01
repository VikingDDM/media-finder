import type { Config } from "tailwindcss";

const config: Config = {
    content: ["./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                ink: "#17202a",
                field: "#f6f7f2",
                line: "#d7ddd2",
                moss: "#506a45",
                rust: "#b6532e",
                ocean: "#1f6f8b"
            },
            boxShadow: {
                soft: "0 12px 30px rgba(23, 32, 42, 0.10)"
            }
        }
    },
    plugins: []
};

export default config;
