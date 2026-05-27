import { getValue } from "../hook/CommonMethod.ts";
import type { DataType } from "../type/Type.ts";

function compareCellValues(va: unknown, vb: unknown, type: DataType | undefined): number {
    const emptyA = va == null || va === "";
    const emptyB = vb == null || vb === "";
    if (emptyA && emptyB) return 0;
    if (emptyA) return 1;
    if (emptyB) return -1;

    switch (type) {
        case "number":
        case "score": {
            const na = Number(va);
            const nb = Number(vb);
            const fa = Number.isFinite(na) ? na : Number.NaN;
            const fb = Number.isFinite(nb) ? nb : Number.NaN;
            if (Number.isNaN(fa) && Number.isNaN(fb)) return 0;
            if (Number.isNaN(fa)) return 1;
            if (Number.isNaN(fb)) return -1;
            return fa - fb;
        }
        case "date": {
            const da = Date.parse(String(va));
            const db = Date.parse(String(vb));
            const na = Number.isFinite(da) ? da : Number.NaN;
            const nb = Number.isFinite(db) ? db : Number.NaN;
            if (Number.isNaN(na) && Number.isNaN(nb)) return 0;
            if (Number.isNaN(na)) return 1;
            if (Number.isNaN(nb)) return -1;
            return na - nb;
        }
        case "string":
        case "state":
        default:
            return String(va).localeCompare(String(vb), "ko", { numeric: true, sensitivity: "base" });
    }
}

/**
 * 페이지네이션 없이 전체 `content`를 화면에 쓸 때, 헤더 정렬 상태에 맞춰 행 순서를 만든다.
 * 같은 값이면 원래 인덱스 순(안정 정렬).
 */
export function sortRowsByHeader(
    rows: readonly unknown[],
    sortKey: string | null,
    sortDir: "ASC" | "DESC",
    headerTypeByKey: ReadonlyMap<string, DataType>,
): unknown[] {
    /** 정렬 컬럼 미선택·행 1개 이하면 원본 순서·참조 유지(대용량 시트에서 불필요한 복사 방지) */
    if (sortKey == null || rows.length <= 1) {
        return rows as unknown[];
    }
    const type = headerTypeByKey.get(sortKey);
    const indexed = rows.map((row, i) => ({ row, i }));
    indexed.sort((A, B) => {
        const va = getValue(A.row as object, sortKey);
        const vb = getValue(B.row as object, sortKey);
        let c = compareCellValues(va, vb, type);
        if (sortDir === "DESC") c = -c;
        if (c !== 0) return c;
        return A.i - B.i;
    });
    return indexed.map((x) => x.row);
}

/** `sortRowsByHeader` 결과와 표시 행 → 원본 인덱스 매핑(정렬 후에도 오류 `rowIndex` 추적용). */
export function sortRowsByHeaderWithSourceIndexes(
    rows: readonly unknown[],
    sortKey: string | null,
    sortDir: "ASC" | "DESC",
    headerTypeByKey: ReadonlyMap<string, DataType>,
): { rows: unknown[]; sourceIndexes: number[] } {
    if (sortKey == null || rows.length <= 1) {
        return {
            rows: rows as unknown[],
            sourceIndexes: rows.map((_, i) => i),
        };
    }
    const type = headerTypeByKey.get(sortKey);
    const indexed = rows.map((row, i) => ({ row, i }));
    indexed.sort((A, B) => {
        const va = getValue(A.row as object, sortKey);
        const vb = getValue(B.row as object, sortKey);
        let c = compareCellValues(va, vb, type);
        if (sortDir === "DESC") c = -c;
        if (c !== 0) return c;
        return A.i - B.i;
    });
    return {
        rows: indexed.map((x) => x.row),
        sourceIndexes: indexed.map((x) => x.i),
    };
}
