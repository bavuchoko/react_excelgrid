import type {HeaderState} from "../type/Type.ts";

export type UserColumn = { key: string; label: string; visible: boolean };

export function toHeaderState(
    userColumns: UserColumn[],
    colWidthByKey?: Record<string, number>,
): HeaderState[] {
    return userColumns.map((c) => {
        const w = colWidthByKey?.[c.key];
        return {
            key: c.key,
            name: c.label,
            visible: c.visible,
            ...(w != null && w > 0 ? { width: Math.round(w) } : {}),
        };
    });
}

