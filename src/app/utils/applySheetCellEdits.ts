import { areCellValuesEqual } from "../js-grid/cellModified.ts";
import type {
    Content,
    ExcelGridData,
    GridCellEditEvent,
    SheetCellPasteBatch,
} from "../type/Type.ts";

/** 단일 셀 편집을 `ExcelGridData` 에 반영한다. */
export function applySheetCellEdit(
    data: ExcelGridData,
    sheetName: string,
    event: GridCellEditEvent,
): ExcelGridData {
    const sheet = data[sheetName];
    if (!sheet) return data;

    if (areCellValuesEqual(event.previousValue, event.value)) return data;

    let rowIdx = event.sourceRowIndex;
    if (rowIdx < 0 || rowIdx >= sheet.data.length) {
        rowIdx = sheet.data.indexOf(event.row as Content);
    }
    if (rowIdx < 0) return data;

    const nextRow: Content = {
        ...(event.row as Content),
        [event.columnKey]: event.value,
    };
    const nextData = sheet.data.slice();
    nextData[rowIdx] = nextRow;
    return { ...data, [sheetName]: { ...sheet, data: nextData } };
}

/** 붙여넣기 배치를 `ExcelGridData` 에 반영한다. */
export function applySheetCellsPaste(
    data: ExcelGridData,
    batches: SheetCellPasteBatch[],
): ExcelGridData {
    let next = data;
    for (const batch of batches) {
        const sheet = next[batch.sheetName];
        if (!sheet) continue;

        const updates = new Map<number, unknown>();
        for (const it of batch.items) {
            if (areCellValuesEqual(it.previousValue, it.value)) continue;
            const idx =
                it.sourceRowIndex >= 0 && it.sourceRowIndex < sheet.data.length
                    ? it.sourceRowIndex
                    : sheet.data.indexOf(it.row as Content);
            if (idx >= 0) updates.set(idx, batch.value);
        }
        if (updates.size === 0) continue;

        const updated = sheet.data.map((row, idx) => {
            if (!updates.has(idx)) return row;
            return { ...(row as Content), [batch.columnKey]: updates.get(idx) };
        });
        next = { ...next, [batch.sheetName]: { ...sheet, data: updated } };
    }
    return next;
}
