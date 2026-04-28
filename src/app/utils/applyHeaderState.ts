import type {Header, HeaderState} from "../type/Type.ts";

/**
 * 저장된 HeaderState(순서/visible/width)를 기존 Header[]에 반영해 새 Header[]를 만든다.
 * - state에 없는 컬럼은 기존 순서를 유지하며 뒤에 붙는다.
 * - label은 state의 label을 우선 적용한다.
 */
export function applyHeaderStateToHeader(args: {
    header: Header[];
    state: HeaderState[];
}): Header[] {
    const { header, state } = args;
    const byKey = new Map(header.map((h) => [h.key, h] as const));
    const used = new Set<string>();

    const next: Header[] = [];
    for (const s of state) {
        const h = byKey.get(s.key);
        if (!h) continue;
        used.add(s.key);
        next.push({
            ...h,
            label: s.label ?? h.label,
            width: s.width ?? h.width,
        });
    }

    // state에 없는 신규/미저장 컬럼은 뒤에 유지
    for (const h of header) {
        if (used.has(h.key)) continue;
        next.push(h);
    }

    return next;
}

