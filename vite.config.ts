import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    if (mode === "lib") {
        return {
            plugins: [react()],
            build: {
                lib: {
                    entry: resolve(__dirname, "src/index.ts"),
                    name: "ReactExcelGrid",
                    formats: ["es", "cjs"],
                    fileName: (format) =>
                        format === "es" ? "index.mjs" : "index.cjs",
                },
                rollupOptions: {
                    // react / react-dom / react/jsx-runtime 은 사용처에서 제공
                    external: [
                        "react",
                        "react-dom",
                        "react/jsx-runtime",
                        "@bavuchoko/js-tooltip",
                        "@tanstack/react-virtual",
                    ],
                    output: {
                        globals: {
                            react: "React",
                            "react-dom": "ReactDOM",
                            "react/jsx-runtime": "ReactJSXRuntime",
                        },
                    },
                },
                // 타입 선언은 tsc -p tsconfig.lib.json 으로 별도 생성
                outDir: "dist",
                sourcemap: true,
                emptyOutDir: false,
            },
        };
    }

    // 기본 모드: 데모 앱 빌드
    return {
        plugins: [react()],
    };
});
