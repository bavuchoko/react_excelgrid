/** 열 순서·구성 변경 감지(너비 맵 초기화용). */
export function columnsWidthSignature(columns: readonly { key?: string | number }[]): string {
    return columns.map((c, i) => String(c.key ?? i)).join("\0");
}

export function widthByKeyMapsNearlyEqual(
    a: Record<string, number>,
    b: Record<string, number>,
): boolean {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every((k) => Math.abs((a[k] ?? 0) - (b[k] ?? 0)) < 0.5);
}

/** `JsGridTable` 에서 잰 열 너비 배열 → `computeLeftOffsets` 용 맵. */
export function columnWidthsToKeyMap(
    columns: readonly { key?: string | number }[],
    widths: readonly number[],
): Record<string, number> {
    const map: Record<string, number> = {};
    for (let i = 0; i < columns.length; i++) {
        const w = widths[i];
        if (w == null || w <= 0) continue;
        const key = String(columns[i]?.key ?? i);
        map[key] = w;
    }
    return map;
}

export function computeLeftOffsets(columns: readonly unknown[], colWidthByKey: Record<string, number>) {
    const offsets: number[] = [];
    let acc = 0;
    for (let i = 0; i < columns.length; i++) {
        offsets[i] = acc;
        const key = String((columns[i] as any).key ?? i);
        acc += colWidthByKey[key] ?? 0;
    }
    return offsets;
}

export function getColumnFreezeStickyStyle(args: {
    colIndex: number;
    isHeader: boolean;
    freezeUntilIndex: number | null;
    leftOffsets: number[];
}) {
    const { colIndex, isHeader, freezeUntilIndex, leftOffsets } = args;
    if (freezeUntilIndex == null || colIndex > freezeUntilIndex) return undefined;
    const isLastFrozen = colIndex === freezeUntilIndex;
    const HIGHLIGHT_BG = 'rgb(219, 234, 254)';
    return {
        position: 'sticky' as const,
        left: leftOffsets[colIndex] ?? 0,
        top: isHeader ? 0 : undefined,
        zIndex: isHeader ? 5 : 3,
        // 반투명 배경이면 스크롤 시 뒤 내용이 비쳐 보일 수 있어 불투명으로 고정한다.
        backgroundColor: HIGHLIGHT_BG,
        backgroundClip: 'padding-box' as const,
        // 고정 하이라이트 영역의 세로 경계선을 배경과 동일 색으로 채워 비침을 막는다.
        borderRight: isLastFrozen ? '3px solid #1d4ed8' : `1px solid ${HIGHLIGHT_BG}`,
    };
}

