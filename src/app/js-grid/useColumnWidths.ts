import {useCallback, useLayoutEffect, useRef, useState} from "react";
import type {JsGridTableColumn} from "../type/Type.ts";
import {COL_RESIZE_MAX_PX, DEFAULT_DATA_COL_WIDTH_PX} from "./gridStyles.ts";

function shallowEqualNumberMap(a: Record<string, number>, b: Record<string, number>): boolean {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
        if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
    }
    return true;
}

function sameMeasuredForColumns(
    prev: Record<string, number>,
    next: Record<string, number>,
    columns: readonly JsGridTableColumn[],
): boolean {
    for (let i = 0; i < columns.length; i++) {
        const k = String(columns[i]?.key ?? i);
        if ((prev[k] ?? 0) !== (next[k] ?? 0)) return false;
    }
    // prev에 남아있는 과거 키는 무시(시트 전환 시)
    return true;
}

export function useColumnWidths(
    columns: readonly JsGridTableColumn[],
    persistedWidthByKey: Record<string, number>,
    /** `header`의 키·width 조합이 바뀌면 저장 너비를 다시 적용한다. */
    headerWidthSig: string,
) {
    const headerCellRefs = useRef<Array<HTMLTableCellElement | null>>([]);
    /** 실제 레이아웃(스티키 계산)에 쓰는 측정값. */
    const [measuredWidthByKey, setMeasuredWidthByKey] = useState<Record<string, number>>({});
    /** 저장된 width / 사용자가 드래그로 조정한 width만 들어가는 override 값. */
    const [overrideWidthByKey, setOverrideWidthByKey] = useState<Record<string, number>>({});
    const prevSigRef = useRef<string | null>(null);

    const normalizeSavedWidthPx = useCallback((v: number): number =>
        Math.round(
            Math.min(COL_RESIZE_MAX_PX, Math.max(DEFAULT_DATA_COL_WIDTH_PX, v)),
        ), []);

    const setColumnWidth = useCallback(
        (columnKey: string, widthPx: number) => {
            const w = normalizeSavedWidthPx(widthPx);
            setOverrideWidthByKey((prev) => ({ ...prev, [columnKey]: w }));
        },
        [normalizeSavedWidthPx],
    );

    useLayoutEffect(() => {
        const id = requestAnimationFrame(() => {
            const sigChanged = prevSigRef.current !== headerWidthSig;
            prevSigRef.current = headerWidthSig;

            // 1) override(저장값) 재적용: headerWidthSig가 바뀌면 persisted 기반으로 리셋
            if (sigChanged) {
                const next: Record<string, number> = {};
                for (const [k, v] of Object.entries(persistedWidthByKey)) {
                    if (v > 0) next[k] = normalizeSavedWidthPx(v);
                }
                setOverrideWidthByKey((prev) => (shallowEqualNumberMap(prev, next) ? prev : next));
            } else {
                // persisted가 새로 생긴 경우만 보강 (사용자 드래그 값은 유지)
                setOverrideWidthByKey((prev) => {
                    let changed = false;
                    const nextMap = { ...prev };
                    for (const [k, v] of Object.entries(persistedWidthByKey)) {
                        if (!(k in nextMap) && v > 0) {
                            nextMap[k] = normalizeSavedWidthPx(v);
                            changed = true;
                        }
                    }
                    return changed ? nextMap : prev;
                });
            }

            // 2) 측정값 갱신: 렌더된 실제 폭을 측정해 스티키 계산에 사용
            setMeasuredWidthByKey((prev) => {
                const next: Record<string, number> = {};
                const keysInCols = new Set<string>();
                columns.forEach((col, idx) => {
                    const key = String(col.key ?? idx);
                    keysInCols.add(key);
                    const el = headerCellRefs.current[idx];
                    const measured =
                        el?.getBoundingClientRect().width
                        ?? el?.offsetWidth
                        ?? 0;
                    if (measured > 0) next[key] = Math.round(measured);
                });
                // 모든 컬럼의 측정이 안 잡혔으면 갱신하지 않는다.
                if (columns.length > 0 && Object.keys(next).length < keysInCols.size) return prev;
                return sameMeasuredForColumns(prev, next, columns) ? prev : next;
            });
        });
        return () => cancelAnimationFrame(id);
    }, [columns, headerWidthSig, persistedWidthByKey, normalizeSavedWidthPx]);

    return {
        headerCellRefs,
        /** 스타일 width 적용은 override만 */
        colWidthByKey: overrideWidthByKey,
        /** 스티키 left 계산은 측정값 기반 */
        measuredWidthByKey,
        setColumnWidth,
    };
}

