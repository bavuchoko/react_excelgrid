import type {ExcelGridData, Header, HeaderState, SheetHeaderSavePayload} from "../type/Type.ts";

function headersLayoutEqual(a: readonly Header[], b: readonly Header[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        const x = a[i]!;
        const y = b[i]!;
        if (x.key !== y.key) return false;
        if (Boolean(x.visible ?? true) !== Boolean(y.visible ?? true)) return false;
        if ((x.width ?? 0) !== (y.width ?? 0)) return false;
        if ((x.name ?? "") !== (y.name ?? "")) return false;
    }
    return true;
}

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
            visible: s.visible,
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
 * 필드 메뉴 순서·표시·너비를 시트 `headers`에 반영한다.
 * `pinnedHeaderKeys`(예: `id`)는 맨 앞에 두고 layout 대상에서 제외한다.
 */
export function applyHeaderLayoutToHeaders(args: {
    headers: Header[];
    layout: HeaderState[];
    pinnedHeaderKeys?: ReadonlySet<string>;
}): Header[] {
    const pinned = args.pinnedHeaderKeys ?? new Set<string>();
    const pinnedHeaders = args.headers.filter((h) => pinned.has(h.key));
    const managedHeaders = args.headers.filter((h) => !pinned.has(h.key));
    const managedNext = applyHeaderStateToHeader({
        headers: managedHeaders,
        state: args.layout,
    });
    return [...pinnedHeaders, ...managedNext];
}

/**
 * `onHeaderSave(payload)` 성공 후 `ExcelGridData` 전체에 헤더 상태를 반영한다.
 * - 대상 시트(`payload.sheetName`)를 찾지 못하면 원본 `data`를 그대로 반환한다.
 */
export function applyHeaderStateToExcelGridData(args: {
    data: ExcelGridData;
    payload: SheetHeaderSavePayload;
    pinnedHeaderKeys?: ReadonlySet<string>;
}): ExcelGridData {
    const { data, payload } = args;
    const sheet = data[payload.sheetName];
    if (!sheet) return data;

    const nextHeaders = applyHeaderLayoutToHeaders({
        headers: sheet.headers,
        layout: payload.headers,
        pinnedHeaderKeys: args.pinnedHeaderKeys,
    });
    if (headersLayoutEqual(nextHeaders, sheet.headers)) return data;

    return {
        ...data,
        [payload.sheetName]: { ...sheet, headers: nextHeaders },
    };
}
