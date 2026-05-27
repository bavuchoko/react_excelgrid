import { gridRowNumericId } from "../hook/CommonMethod.ts";
import type { ExcelGridData } from "../type/Type.ts";

export type RemoveRowsFromExcelGridDataArgs = {
    /** 삭제 반영 전 값 */
    data: ExcelGridData;
    /** 대상 시트 이름(`onDeleteClick` 발생 시 활성 시트 이름과 일치해야 함) */
    sheetName: string;
    /**
     * 삭제 확정된 행(그리드 `onDeleteClick(rows)` 에서 받은 객체 그대로).
     * - `row.id`가 유한한 `number`(또는 숫자 문자열)이면 해당 id로 같은 시트 행을 제거한다.
     * - 그렇지 않으면 `data` 안의 행 객체 **참조 동일성**으로 제거한다.
     */
    removedRows: readonly unknown[];
};

export type RemoveRowsByIdsFromExcelGridDataArgs = {
    /** 삭제 반영 전 값 */
    data: ExcelGridData;
    /** 삭제 확정 id 목록 */
    ids: readonly number[];
};

/**
 * 삭제 API 성공 후 `setData`(또는 사용처 상태 갱신)에 넘기기 위한 순수 헬퍼.
 * 헤더에 `applyHeaderStateToHeader`를 쓰는 것과 같은 자리에서 쓰면 된다.
 */
export function removeRowsFromExcelGridData(args: RemoveRowsFromExcelGridDataArgs): ExcelGridData {
    const { data, sheetName, removedRows } = args;
    if (removedRows.length === 0) return data;

    const byId = new Set<number>();
    const byRef = new Set<unknown>();
    for (const r of removedRows) {
        const id = gridRowNumericId(r);
        if (id != null) byId.add(id);
        else byRef.add(r);
    }

    const sheet = data[sheetName];
    if (!sheet) return data;

    const nextData = sheet.data.filter((row) => {
        const id = gridRowNumericId(row);
        if (id != null && byId.has(id)) return false;
        if (byRef.has(row)) return false;
        return true;
    });

    if (nextData.length === sheet.data.length) return data;

    return {
        ...data,
        [sheetName]: { ...sheet, data: nextData },
    };
}

/**
 * `ids`만으로 대상 시트를 찾아 삭제 반영한다.
 * - 전역 유니크 id를 전제로, `ids`를 모두 포함하는 첫 시트를 찾아 제거한다.
 * - 대상 시트를 찾지 못하면 원본 `data`를 그대로 반환한다.
 */
export function removeRowsByIdsFromExcelGridData(args: RemoveRowsByIdsFromExcelGridDataArgs): ExcelGridData {
    const { data, ids } = args;
    const uniqueIds = Array.from(new Set(ids.filter((id) => Number.isFinite(id))));
    if (uniqueIds.length === 0) return data;

    const targetSheetName = Object.entries(data).find(([, sheet]) => {
        const idSet = new Set<number>();
        for (const row of sheet.data) {
            const id = gridRowNumericId(row);
            if (id != null) idSet.add(id);
        }
        return uniqueIds.every((id) => idSet.has(id));
    })?.[0];

    if (!targetSheetName) return data;

    const removedRows = uniqueIds.map((id) => ({ id }));
    return removeRowsFromExcelGridData({ data, sheetName: targetSheetName, removedRows });
}
