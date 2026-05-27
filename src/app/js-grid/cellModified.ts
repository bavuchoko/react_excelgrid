import { formatCellDisplayValue, getValue } from "../hook/CommonMethod.ts";
import type { Content } from "../type/Type.ts";

/** 사용자가 원본 대비 값을 바꾼 셀 배경색. */
export const MODIFIED_CELL_BG = "rgb(161, 255, 221)";

function normalizeComparable(value: unknown): string {
    if (value == null) return "";
    return formatCellDisplayValue(value).trim();
}

/** 두 셀 값이 동일한지(표시 문자열 기준) 비교. */
export function areCellValuesEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    return normalizeComparable(a) === normalizeComparable(b);
}

/**
 * 원본 스냅샷(`baseline`) 대비 현재 행·열 값이 바뀌었는지.
 * `sourceRowIndex` 는 정렬 전 `data` 배열의 0-based 인덱스.
 */
export function isCellModifiedFromBaseline(
    baseline: readonly Content[] | undefined,
    sourceRowIndex: number,
    columnKey: string,
    currentRow: Content,
): boolean {
    if (!baseline || sourceRowIndex < 0) return false;
    const baseRow = baseline[sourceRowIndex];
    if (!baseRow) return false;
    return !areCellValuesEqual(getValue(baseRow, columnKey), getValue(currentRow, columnKey));
}
