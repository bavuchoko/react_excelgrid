import {useCallback, useLayoutEffect, useRef, useState} from "react";
import type {JsGridTableColumn} from "../type/Type.ts";
import {COL_RESIZE_MAX_PX, COL_RESIZE_MIN_PX} from "./gridStyles.ts";

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

    const setColumnWidth = useCallback((columnKey: string, widthPx: number) => {
        const w = Math.round(Math.max(COL_RESIZE_MIN_PX, Math.min(COL_RESIZE_MAX_PX, widthPx)));
        setOverrideWidthByKey((prev) => ({ ...prev, [columnKey]: w }));
    }, []);

    useLayoutEffect(() => {
        const id = requestAnimationFrame(() => {
            const sigChanged = prevSigRef.current !== headerWidthSig;
            prevSigRef.current = headerWidthSig;

            // 1) override(저장값) 재적용: headerWidthSig가 바뀌면 persisted 기반으로 리셋
            if (sigChanged) {
                setOverrideWidthByKey(() => ({ ...persistedWidthByKey }));
            } else {
                // persisted가 새로 생긴 경우만 보강 (사용자 드래그 값은 유지)
                setOverrideWidthByKey((prev) => {
                    const next = { ...prev };
                    for (const [k, v] of Object.entries(persistedWidthByKey)) {
                        if (!(k in next) && v > 0) next[k] = v;
                    }
                    return next;
                });
            }

            // 2) 측정값 갱신: 렌더된 실제 폭을 측정해 스티키 계산에 사용
            setMeasuredWidthByKey((prev) => {
                const next: Record<string, number> = { ...prev };
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
                for (const k of Object.keys(next)) {
                    if (!keysInCols.has(k)) delete next[k];
                }
                return next;
            });
        });
        return () => cancelAnimationFrame(id);
    }, [columns, headerWidthSig, persistedWidthByKey]);

    return {
        headerCellRefs,
        /** 스타일 width 적용은 override만 */
        colWidthByKey: overrideWidthByKey,
        /** 스티키 left 계산은 측정값 기반 */
        measuredWidthByKey,
        setColumnWidth,
    };
}

