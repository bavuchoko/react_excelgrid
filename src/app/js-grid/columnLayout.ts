import type { MutableRefObject } from "react";
import type { JsGridTableColumn } from "../type/Type.ts";
import { DEFAULT_DATA_COL_WIDTH_PX } from "./gridStyles.ts";

const CHECKBOX_COL_MIN_PX = 40;
const ROWNUM_COL_MIN_PX = 56;

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

/** 틀 고정 직전 헤더 셀의 실제 렌더 너비(border-box). */
export function readHeaderCellWidths(
    columns: readonly JsGridTableColumn[],
    headerCellRefs: MutableRefObject<Array<HTMLTableCellElement | null>>,
): Record<string, number> {
    const next: Record<string, number> = {};
    columns.forEach((col, idx) => {
        const key = String(col.key ?? idx);
        const el = headerCellRefs.current[idx];
        if (!el) return;
        const measured = Math.max(el.offsetWidth, Math.ceil(el.getBoundingClientRect().width));
        if (measured > 0) next[key] = measured;
    });
    return next;
}

export function captureColumnLayoutWidths(
    columns: readonly JsGridTableColumn[],
    headerCellRefs: MutableRefObject<Array<HTMLTableCellElement | null>>,
): Record<string, number> {
    return readHeaderCellWidths(columns, headerCellRefs);
}

function defaultColumnMinPx(col: JsGridTableColumn): number {
    if (col.__checkbox__) return CHECKBOX_COL_MIN_PX;
    if (col.__rownum__) return ROWNUM_COL_MIN_PX;
    return DEFAULT_DATA_COL_WIDTH_PX;
}

/** 스티키 `left` 합산용 열 너비 맵. */
export function buildColumnLayoutWidths(
    columns: readonly JsGridTableColumn[],
    measuredByKey: Record<string, number>,
    overrideByKey: Record<string, number>,
): Record<string, number> {
    const out: Record<string, number> = {};
    for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const key = String(col.key ?? i);
        const o = overrideByKey[key];
        const m = measuredByKey[key];
        const w =
            o != null && o > 0
                ? o
                : m != null && m > 0
                  ? m
                  : defaultColumnMinPx(col);
        if (w > 0) out[key] = w;
    }
    return out;
}

export function computeLeftOffsets(
    columns: readonly JsGridTableColumn[],
    widthByKey: Record<string, number>,
) {
    const offsets: number[] = [];
    let acc = 0;
    for (let i = 0; i < columns.length; i++) {
        offsets[i] = acc;
        const key = String(columns[i].key ?? i);
        acc += widthByKey[key] ?? 0;
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
        borderRight: isLastFrozen ? "none" : `1px solid ${HIGHLIGHT_BG}`,
        ...(isLastFrozen ? { boxShadow: "inset -2px 0 0 #1d4ed8" } : {}),
    };
}

