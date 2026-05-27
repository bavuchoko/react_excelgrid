import { areCellValuesEqual } from "./cellModified.ts";
import type { GridCellPasteBatch, GridCellPasteItem } from "../type/Type.ts";

/** 같은 시트·열 내부에서의 셀 범위(시작~끝 행). */
export type GridCellRange = {
    columnKey: string;
    rowStart: number;
    rowEnd: number;
};

export function normalizeCellRange(
    columnKey: string,
    rowA: number,
    rowB: number,
): GridCellRange {
    return {
        columnKey,
        rowStart: Math.min(rowA, rowB),
        rowEnd: Math.max(rowA, rowB),
    };
}

export function isCellInRange(
    range: GridCellRange | null,
    rowIndex: number,
    columnKey: string,
): boolean {
    if (!range) return false;
    return (
        range.columnKey === columnKey
        && rowIndex >= range.rowStart
        && rowIndex <= range.rowEnd
    );
}

/** 붙여넣기 대상 행 `i`(0-based)에 쓸 값. 한 줄이면 전 행 동일, 여러 줄이면 순환. */
export function pasteLineForRowIndex(lines: string[], rowOffset: number): string {
    if (lines.length === 0) return "";
    if (lines.length === 1) return lines[0]!;
    return lines[rowOffset % lines.length] ?? "";
}

export function parseClipboardLines(text: string): string[] {
    if (!text) return [""];
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.split("\n");
    if (lines.length > 1 && lines[lines.length - 1] === "") {
        lines.pop();
    }
    return lines;
}

/** 행 객체에서 식별 키 추출. 문자열/숫자가 아니면 문자열화. */
export function resolveRowId(
    row: unknown,
    rowIdKey: string,
): string | number | null | undefined {
    if (row == null || typeof row !== "object") return undefined;
    const v = (row as Record<string, unknown>)[rowIdKey];
    if (v == null) return undefined;
    if (typeof v === "string" || typeof v === "number") return v;
    return String(v);
}

function pasteValueGroupKey(columnKey: string, value: unknown): string {
    return `${columnKey}\u0000${String(value ?? "")}`;
}

/** 행 `id`(또는 `rowIdKey`)가 없으면 `sourceRowIndex` 를 식별자로 쓴다. */
export function resolveChangeRowId(
    row: unknown,
    sourceRowIndex: number,
    rowIdKey: string,
): string | number | null {
    const rowId = resolveRowId(row, rowIdKey);
    if (typeof rowId === "string" || typeof rowId === "number") return rowId;
    if (sourceRowIndex >= 0) return sourceRowIndex;
    return null;
}

function pasteRowIdentifier(item: GridCellPasteItem): string | number | null {
    if (typeof item.rowId === "string" || typeof item.rowId === "number") return item.rowId;
    return item.sourceRowIndex >= 0 ? item.sourceRowIndex : null;
}

/**
 * `GridCellPasteItem[]` → API 호출 단위로 묶기.
 * 같은 `columnKey` + `value` 는 `rowIds` 로 합친다.
 * `rowId` 가 없으면 `sourceRowIndex`(정렬 전 행 인덱스)를 식별자로 쓴다.
 */
export function groupPasteItemsIntoBatches(items: GridCellPasteItem[]): GridCellPasteBatch[] {
    const map = new Map<string, GridCellPasteBatch>();

    for (const item of items) {
        const groupKey = pasteValueGroupKey(item.columnKey, item.value);
        let batch = map.get(groupKey);
        if (!batch) {
            batch = {
                columnKey: item.columnKey,
                value: item.value,
                rowIds: [],
                items: [],
            };
            map.set(groupKey, batch);
        }
        const identifier = pasteRowIdentifier(item);
        if (identifier != null) batch.rowIds.push(identifier);
        batch.items.push(item);
    }

    return Array.from(map.values()).filter((b) => b.items.length > 0);
}

/** `previousValue` 와 붙여넣을 `value` 가 다른 항목만 남기고 `rowIds` 를 다시 만든다. */
export function filterChangedPasteBatches(
    batches: GridCellPasteBatch[],
): GridCellPasteBatch[] {
    const result: GridCellPasteBatch[] = [];
    for (const batch of batches) {
        const items = batch.items.filter(
            (it) => !areCellValuesEqual(it.previousValue, it.value),
        );
        if (items.length === 0) continue;
        const rowIds: Array<string | number> = [];
        for (const it of items) {
            const id = pasteRowIdentifier(it);
            if (id != null) rowIds.push(id);
        }
        result.push({
            columnKey: batch.columnKey,
            value: batch.value,
            rowIds,
            items,
        });
    }
    return result;
}
