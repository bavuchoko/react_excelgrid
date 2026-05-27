import type { CSSProperties } from "react";

/**
 * 서버에서 내려주는 시트별 에러는 다음과 같은 모양이다.
 * ```
 * errors: {
 *   necessary:   [{ "자산명": [3] }],
 *   duplicatedb: [{ "자산명": [0, 1, ...] }],
 *   codevalue:   [{ "업무그룹": [] }, { "자산위치": [1] }, ...],
 *   duplicate:   [{ "자산명": [4, 5] }],
 *   typeError:   [{ "등록일": [] }, ...],
 * }
 * ```
 * 각 카테고리의 값은 `{ 컬럼명: 행 인덱스[] }` 객체 배열이며,
 * 빈 배열은 "해당 카테고리에 해당하는 행이 없음" 을 뜻한다.
 */
export type SheetErrorColumnEntry = {
    /** 컬럼명(서버 응답 그대로). 헤더의 `name` 과 매칭된다. */
    columnName: string;
    /** 오류가 발생한 행 인덱스(0-based). UI 표시는 `+1` 해서 노출. */
    rows: number[];
    count: number;
};

export type SheetErrorCategory = {
    /** 서버 응답 키(`necessary` 등). 알 수 없는 키도 포함될 수 있다. */
    key: string;
    /** 사용자에게 보일 라벨. */
    label: string;
    /** 배지 색(텍스트·테두리·강조용). */
    color: string;
    /** 배지 배경색. */
    bg: string;
    /** 배지 안에 표시할 한 글자. */
    letter: string;
    /** 카테고리 총 오류 건수(모든 컬럼의 행 수 합). */
    count: number;
    /** 행이 1건 이상 있는 컬럼만 골라 둔 목록. */
    columns: SheetErrorColumnEntry[];
};

export type SheetErrorBreakdown = {
    /** `errors` 가 알려진 카테고리 객체 모양인지 여부. */
    structured: boolean;
    /** 알려진 카테고리는 항상 존재(count: 0 포함). 미지의 키는 뒤에 붙는다. */
    categories: SheetErrorCategory[];
    /** 모든 카테고리 합산 건수. */
    totalCount: number;
    /** 구조가 아닐 때(예: 문자열·배열) 사용할 평탄화 텍스트 목록. */
    flatMessages: string[];
};

/** 카테고리별 메타데이터(`necessary` 부터 순서 고정). */
type CategoryMeta = Pick<SheetErrorCategory, "key" | "label" | "color" | "bg" | "letter">;
const KNOWN_CATEGORIES: readonly CategoryMeta[] = [
    { key: "necessary",   label: "필수값 누락",  color: "#dc2626", bg: "#fee2e2", letter: "!" },
    { key: "duplicatedb", label: "DB 중복",     color: "#b45309", bg: "#fef3c7", letter: "D" },
    { key: "codevalue",   label: "코드값 오류", color: "#ea580c", bg: "#ffedd5", letter: "C" },
    { key: "duplicate",   label: "시트 중복",   color: "#a16207", bg: "#fef3c7", letter: "=" },
    { key: "typeError",   label: "형식 오류",   color: "#2563eb", bg: "#dbeafe", letter: "T" },
];
const UNKNOWN_META: Omit<CategoryMeta, "key" | "label" | "letter"> = {
    color: "#475569",
    bg: "#e2e8f0",
};

function isKnownErrorObject(errors: unknown): errors is Record<string, unknown> {
    if (!errors || typeof errors !== "object" || Array.isArray(errors)) return false;
    const obj = errors as Record<string, unknown>;
    return KNOWN_CATEGORIES.some((meta) => Array.isArray(obj[meta.key]));
}

/** `[{ 컬럼명: 행[] }, ...]` 모양에서 비어있지 않은 항목만 정리해 반환. */
function parseCategoryEntries(value: unknown): SheetErrorColumnEntry[] {
    if (!Array.isArray(value)) return [];
    const entries: SheetErrorColumnEntry[] = [];
    for (const item of value) {
        if (!item || typeof item !== "object" || Array.isArray(item)) continue;
        const obj = item as Record<string, unknown>;
        for (const [columnName, rowsRaw] of Object.entries(obj)) {
            if (!Array.isArray(rowsRaw)) continue;
            const rows: number[] = [];
            for (const r of rowsRaw) {
                if (typeof r === "number" && Number.isFinite(r)) rows.push(r);
                else if (typeof r === "string") {
                    const n = Number(r);
                    if (Number.isFinite(n)) rows.push(n);
                }
            }
            if (rows.length === 0) continue;
            entries.push({ columnName, rows, count: rows.length });
        }
    }
    return entries;
}

function flattenFreeformErrors(errors: unknown): string[] {
    const out: string[] = [];
    visit(errors);
    return out;
    function visit(node: unknown): void {
        if (node == null) return;
        if (typeof node === "string") {
            const s = node.trim();
            if (s) out.push(s);
            return;
        }
        if (typeof node === "number" || typeof node === "boolean" || typeof node === "bigint") {
            out.push(String(node));
            return;
        }
        if (Array.isArray(node)) {
            for (const item of node) visit(item);
            return;
        }
        if (typeof node === "object") {
            const o = node as Record<string, unknown>;
            for (const key of ["message", "error", "text", "msg", "detail", "description"]) {
                const v = o[key];
                if (typeof v === "string" && v.trim()) {
                    out.push(v);
                    return;
                }
            }
            for (const key of ["errors", "items", "messages", "details"]) {
                const v = o[key];
                if (Array.isArray(v)) {
                    for (const it of v) visit(it);
                    return;
                }
            }
            try {
                const s = JSON.stringify(node);
                if (s && s !== "{}") out.push(s);
            } catch {
                // ignore
            }
        }
    }
}

export function parseSheetErrors(errors: unknown): SheetErrorBreakdown {
    if (!isKnownErrorObject(errors)) {
        return {
            structured: false,
            categories: [],
            totalCount: 0,
            flatMessages: flattenFreeformErrors(errors),
        };
    }

    const obj = errors as Record<string, unknown>;
    const usedKeys = new Set<string>();
    const categories: SheetErrorCategory[] = KNOWN_CATEGORIES.map((meta) => {
        usedKeys.add(meta.key);
        const cols = parseCategoryEntries(obj[meta.key]);
        const count = cols.reduce((acc, c) => acc + c.count, 0);
        return { ...meta, count, columns: cols };
    });

    /** 알려지지 않은 카테고리도 그대로 보여 준다(라벨은 원래 키 사용). */
    for (const [k, v] of Object.entries(obj)) {
        if (usedKeys.has(k)) continue;
        const cols = parseCategoryEntries(v);
        const count = cols.reduce((acc, c) => acc + c.count, 0);
        const letter = k.charAt(0).toUpperCase() || "?";
        categories.push({
            key: k,
            label: k,
            ...UNKNOWN_META,
            letter,
            count,
            columns: cols,
        });
    }

    const totalCount = categories.reduce((acc, c) => acc + c.count, 0);
    return { structured: true, categories, totalCount, flatMessages: [] };
}

/** 시트에 표시할 검증 오류가 하나라도 있는지. */
export function hasSheetErrors(errors: unknown): boolean {
    if (errors == null) return false;
    const breakdown = parseSheetErrors(errors);
    return breakdown.totalCount > 0 || breakdown.flatMessages.length > 0;
}

/** 1-based 행 번호로 변환해 최대 20개까지 노출, 초과분은 "외 N개" 로 줄임. */
export function formatSheetErrorRowList(rows: readonly number[]): string {
    if (rows.length === 0) return "";
    const display = rows.slice().sort((a, b) => a - b).map((n) => n + 1);
    if (display.length <= 20) return display.join(", ");
    const head = display.slice(0, 20).join(", ");
    return `${head}, … 외 ${display.length - 20}개`;
}

/** 서버 `errors` 객체의 알려진 카테고리 키. */
export type SheetErrorCategoryKey =
    | "necessary"
    | "duplicatedb"
    | "codevalue"
    | "duplicate"
    | "typeError";

const KNOWN_ERROR_CATEGORY_KEYS = new Set<string>([
    "necessary",
    "duplicatedb",
    "codevalue",
    "duplicate",
    "typeError",
]);

function isSheetErrorCategoryKey(key: string): key is SheetErrorCategoryKey {
    return KNOWN_ERROR_CATEGORY_KEYS.has(key);
}

/** 원본 `data` 행 인덱스 + 컬럼명(`Header.name`) 기준 셀 오류 조회. */
export type SheetCellErrorLookup = {
    getCategories(sourceRowIndex: number, columnName: string): readonly SheetErrorCategoryKey[];
};

/** 구조화된 `errors` 에서 셀별 카테고리 목록 인덱스를 만든다. */
export function buildSheetCellErrorLookup(errors: unknown): SheetCellErrorLookup | null {
    if (!isKnownErrorObject(errors)) return null;
    const obj = errors as Record<string, unknown>;
    const map = new Map<string, SheetErrorCategoryKey[]>();

    for (const meta of KNOWN_CATEGORIES) {
        if (!isSheetErrorCategoryKey(meta.key)) continue;
        const cols = parseCategoryEntries(obj[meta.key]);
        for (const col of cols) {
            for (const row of col.rows) {
                const mapKey = `${row}\0${col.columnName}`;
                const list = map.get(mapKey) ?? [];
                if (!list.includes(meta.key)) list.push(meta.key);
                map.set(mapKey, list);
            }
        }
    }

    return {
        getCategories(sourceRowIndex, columnName) {
            return map.get(`${sourceRowIndex}\0${columnName}`) ?? [];
        },
    };
}

/**
 * 셀에 겹쳐 그릴 오류 스타일(그리드 본문).
 * - necessary: 붉은 배경
 * - duplicate(시트/엑셀 중복): 붉은 글자
 * - duplicatedb: 붉은 점선 테두리
 * - codevalue: 글자 검정 + 빨간 취소선(`text-decoration-color`)
 * - typeError: 파란 글자 (duplicate 와 동시면 붉은 글자 우선)
 */
export function mergeSheetErrorCellStyles(
    categories: readonly SheetErrorCategoryKey[],
): CSSProperties {
    if (categories.length === 0) return {};
    const set = new Set(categories);
    const style: CSSProperties = {};

    if (set.has("necessary")) {
        style.backgroundColor = "#fecaca";
    }
    if (set.has("duplicatedb")) {
        /** `outline` 은 레이아웃 밖으로 그려져 가상 행(30px)과 어긋난다 — inset 으로 셀 안에만 표시 */
        style.boxShadow = "inset 0 0 0 1px #dc2626";
    }
    if (set.has("codevalue")) {
        style.textDecoration = "line-through";
        style.textDecorationColor = "#dc2626";
    }
    if (set.has("duplicate")) {
        style.color = "#dc2626";
    } else if (set.has("typeError")) {
        style.color = "#2563eb";
    }

    return style;
}

export type SheetErrorBadgeStyles = {
    container: CSSProperties;
    text: CSSProperties;
};

/** 하단 오류 배지(`js-grid-sheet-error-badge`) — 셀과 동일한 시각 규칙. */
export function getSheetErrorBadgeStyles(
    categoryKey: string,
    active: boolean,
): SheetErrorBadgeStyles {
    const baseContainer: CSSProperties = {
        backgroundColor: "#ffffff",
        border: "1px solid #e5e7eb",
        color: "#374151",
    };
    const baseText: CSSProperties = {};

    if (!active) {
        return {
            container: { ...baseContainer, opacity: 0.45 },
            text: baseText,
        };
    }

    if (!isSheetErrorCategoryKey(categoryKey)) {
        return { container: baseContainer, text: baseText };
    }

    switch (categoryKey) {
        case "necessary":
            return {
                container: {
                    ...baseContainer,
                    backgroundColor: "#fecaca",
                    border: "1px solid #fca5a5",
                },
                text: { color: "#7f1d1d" },
            };
        case "duplicate":
            return {
                container: baseContainer,
                text: { color: "#dc2626", fontWeight: 600 },
            };
        case "duplicatedb":
            return {
                container: {
                    ...baseContainer,
                    border: "1px dashed #dc2626",
                },
                text: { color: "#7f1d1d", fontWeight: 600 },
            };
        case "codevalue":
            return {
                container: baseContainer,
                text: {
                    color: "#374151",
                    textDecoration: "line-through",
                    textDecorationColor: "#dc2626",
                    fontWeight: 600,
                },
            };
        case "typeError":
            return {
                container: baseContainer,
                text: { color: "#2563eb", fontWeight: 600 },
            };
        default:
            return { container: baseContainer, text: baseText };
    }
}
