/**
 * 그리드 행 삭제/선택용. `row.id`가 유한한 number이거나, 숫자로 안전히 변환 가능한
 * 문자열(예: `"177"`)일 때 number로 정규화해서 반환한다.
 */
export const gridRowNumericId = (row: unknown): number | null => {
    const v = (row as { id?: unknown })?.id;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
        const trimmed = v.trim();
        if (trimmed === '') return null;
        const n = Number(trimmed);
        if (Number.isFinite(n)) return n;
    }
    return null;
};

export const getValue = (obj: any, key: string) => {
    if (!obj || !key) return undefined;

    return  key.split(".").reduce((acc, k) => acc?.[k], obj);
};

