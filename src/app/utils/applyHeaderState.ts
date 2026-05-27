import type {ExcelGridData, Header, HeaderState, SheetHeaderSavePayload} from "../type/Type.ts";

/**
 * 저장된 HeaderState(순서/visible/width)를 기존 Header[]에 반영해 새 Header[]를 만든다.
 * - state에 없는 컬럼은 기존 순서를 유지하며 뒤에 붙는다.
 * - name 은 state의 name 을 우선 적용한다.
 */
export function applyHeaderStateToHeader(args: {
    headers: Header[];
    state: HeaderState[];
}): Header[] {
    const { headers, state } = args;
    const byKey = new Map(headers.map((h) => [h.key, h] as const));
    const used = new Set<string>();

    const next: Header[] = [];
    for (const s of state) {
        const h = byKey.get(s.key);
        if (!h) continue;
        used.add(s.key);
        next.push({
            ...h,
            name: s.name ?? h.name,
            width: s.width ?? h.width,
        });
    }

    // state에 없는 신규/미저장 컬럼은 뒤에 유지
    for (const h of headers) {
        if (used.has(h.key)) continue;
        next.push(h);
    }

    return next;
}

/**
 * `onHeaderSave(payload)` 성공 후 `ExcelGridData` 전체에 헤더 상태를 반영한다.
 * - 대상 시트(`payload.sheetName`)를 찾지 못하면 원본 `data`를 그대로 반환한다.
 */
export function applyHeaderStateToExcelGridData(args: {
    data: ExcelGridData;
    payload: SheetHeaderSavePayload;
}): ExcelGridData {
    const { data, payload } = args;
    const sheet = data[payload.sheetName];
    if (!sheet) return data;

    const nextHeaders = applyHeaderStateToHeader({
        headers: sheet.headers,
        state: payload.headers,
    });
    if (nextHeaders === sheet.headers) return data;

    return {
        ...data,
        [payload.sheetName]: { ...sheet, headers: nextHeaders },
    };
}

