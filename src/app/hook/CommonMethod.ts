/** 그리드 행 삭제/선택용. `row.id`가 유한한 number일 때만 반환한다. */
export const gridRowNumericId = (row: unknown): number | null => {
    const v = (row as { id?: unknown })?.id;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

export const getValue = (obj: any, key: string) => {
    if (!obj || !key) return undefined;

    return  key.split(".").reduce((acc, k) => acc?.[k], obj);
};

