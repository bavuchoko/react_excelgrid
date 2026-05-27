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

/** 점(`.`) 표기 경로(`a.b.c`)로 깊은 값 추출. 없으면 `undefined`. */
export const getValue = (obj: unknown, key: string): unknown => {
    if (!obj || !key) return undefined;
    return key.split(".").reduce<unknown>((acc, k) => {
        if (acc == null || typeof acc !== "object") return undefined;
        return (acc as Record<string, unknown>)[k];
    }, obj);
};

/**
 * `render`가 없을 때 셀에 넣을 문자열.
 * 배열·객체(예: 유저 목록)는 React 자식으로 직접 넣을 수 없어 여기서 평문으로 만든다.
 */
export function formatCellDisplayValue(value: unknown): string {
    if (value == null) return "";
    const t = typeof value;
    if (t === "string" || t === "number" || t === "boolean") return String(value);
    if (t === "bigint") return String(value);
    if (Array.isArray(value)) {
        if (value.length === 0) return "";
        return value
            .map((v) => formatCellDisplayValue(v))
            .filter((s) => s.length > 0)
            .join(", ");
    }
    if (t === "object") {
        const o = value as Record<string, unknown>;
        if (typeof o.name === "string" && o.name.trim()) return o.name;
        if (typeof o.label === "string" && o.label.trim()) return o.label;
        if (typeof o.title === "string" && o.title.trim()) return o.title;
        try {
            const s = JSON.stringify(value);
            return s.length > 130 ? `${s.slice(0, 117)}...` : s;
        } catch {
            return "";
        }
    }
    return String(value);
}
