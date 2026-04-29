import { useVirtualizer } from "@tanstack/react-virtual";
import { getValue } from "../hook/CommonMethod.ts";
import {
    CELL_MAX_WIDTH_PX,
    COL_RESIZE_MAX_PX,
    COL_RESIZE_MIN_PX,
    DEFAULT_DATA_COL_WIDTH_PX,
    GRID_BORDER,
} from "./gridStyles.ts";
import type {
    CSSProperties,
    Dispatch,
    MutableRefObject,
    ReactElement,
    ReactNode,
    SetStateAction,
} from "react";
import React, { isValidElement, useCallback, useLayoutEffect, useRef, useState } from "react";
import type { JsGridTableColumn } from "../type/Type.ts";
import ASC from "../resources/icon/ASC.tsx";
import DESC from "../resources/icon/DESC.tsx";

export type { JsGridTableColumn } from "../type/Type.ts";

const SORT_ICON_PX = 14;
/** tbody 행 높이(기존 `h-[30px]`과 동일) — 가변 행이면 후에 `measureElement`로 확장 */
const ROW_HEIGHT_PX = 30;

/** DOM에서 잰 너비가 같은지 비교(불필요한 setState 방지) */
function widthsNearlyEqual(a: readonly number[], b: readonly number[]): boolean {
    if (a.length !== b.length || b.length === 0) return false;
    return a.every((x, i) => Math.abs(x - (b[i] ?? 0)) < 0.5);
}

function sumWidths(widths: readonly number[]): number {
    let s = 0;
    for (let i = 0; i < widths.length; i++) s += widths[i];
    return s;
}

type TruncatingDivProps = React.HTMLAttributes<HTMLDivElement> & { children: ReactNode };

function TruncatingDiv({ children, style, ...rest }: TruncatingDivProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [title, setTitle] = useState<string | undefined>(undefined);

    const measure = useCallback(() => {
        const el = ref.current;
        if (!el) {
            setTitle(undefined);
            return;
        }
        const truncated = el.scrollWidth > el.clientWidth + 1;
        if (truncated) {
            const raw = el.innerText.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
            setTitle(raw.length > 0 ? raw : undefined);
        } else {
            setTitle(undefined);
        }
    }, []);

    useLayoutEffect(() => {
        measure();
        const el = ref.current;
        if (!el) return undefined;
        const ro = new ResizeObserver(() => {
            measure();
        });
        ro.observe(el);
        return () => {
            ro.disconnect();
        };
    }, [measure, children]);

    return (
        <div role="presentation" ref={ref} {...rest} style={style} title={title}>
            {children}
        </div>
    );
}

function HeaderColumnResizeHandle({
    minPx,
    maxPx,
    onResize,
}: {
    minPx: number;
    maxPx: number;
    onResize: (widthPx: number) => void;
}) {
    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const th = (e.currentTarget as HTMLDivElement).closest("th");
        const startX = e.clientX;
        const startW = th?.getBoundingClientRect().width ?? minPx;
        const move = (ev: PointerEvent) => {
            const raw = startW + (ev.clientX - startX);
            onResize(Math.round(Math.max(minPx, Math.min(maxPx, raw))));
        };
        const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
    };
    return (
        <div
            data-jsgrid-col-resize="1"
            role="separator"
            aria-orientation="vertical"
            aria-label="컬럼 너비 조절"
            onPointerDown={onPointerDown}
            style={{
                position: "absolute",
                right: 0,
                top: 0,
                bottom: 0,
                width: 6,
                cursor: "col-resize",
                zIndex: 8,
                touchAction: "none",
                marginRight: -1,
            }}
        />
    );
}

type RowSelectionProps = {
    pageRowIds: number[];
    selectedIds: ReadonlySet<number>;
    /** 현재 페이지 행이 모두 선택된 경우에만 true (일부만 선택이면 false) */
    headerChecked: boolean;
    onToggleAll: () => void;
    onToggleRow: (id: number) => void;
};

type Props = {
    columns: readonly JsGridTableColumn[];
    data: unknown[];
    sortKey: string | null;
    /** 미지정·ASC는 ASC 아이콘, DESC만 DESC 아이콘 */
    sortDir?: "ASC" | "DESC";
    headerCellRefs: MutableRefObject<Array<HTMLTableCellElement | null>>;
    colWidthByKey: Record<string, number>;
    setFreezeUntilIndex: Dispatch<SetStateAction<number | null>>;
    getStickyStyle: (args: { colIndex: number; isHeader: boolean }) => CSSProperties | undefined;
    onSortChange: (next: { key: string; direction: "ASC" | "DESC" }) => void;
    rowSelection?: RowSelectionProps;
    onRowClick?: (row: unknown) => void;
    onColumnWidthChange?: (columnKey: string, widthPx: number) => void;
};

export default function JsGridTable(props: Props) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const headTableRef = useRef<HTMLTableElement>(null);
    /** 헤더 `th`와 동일 픽셀 너비로 본문 열 정렬 — 테이블 자동 레이아웃이 단일 근본값 */
    const [measuredColWidths, setMeasuredColWidths] = useState<number[]>([]);

    const syncColumnWidthsFromHeader = useCallback(() => {
        const n = props.columns.length;
        const cells = props.headerCellRefs.current;
        if (!cells.length || cells.length < n) return;
        const table = headTableRef.current;
        const next: number[] = new Array<number>(n);
        for (let i = 0; i < n; i++) {
            const el = cells[i];
            if (!el?.isConnected) {
                next[i] = 0;
                continue;
            }
            /** `offsetWidth` 정수 — `getBoundingClientRect` 소수 라운딩으로 헤더/본문 불일치 방지 */
            const ow = typeof el.offsetWidth === "number" ? el.offsetWidth : 0;
            next[i] = ow > 0 ? ow : Math.round(el.getBoundingClientRect().width);
        }
        if (next.some((w) => w <= 0)) return;
        /** 합계와 테이블 전체 픽셀 차(최대 2~3px)를 마지막 열에 흡수 — 세로 줄 1px 어긋남 완화 */
        if (table && n >= 1) {
            const tw = table.offsetWidth;
            const sum = sumWidths(next);
            const diff = tw - sum;
            if (diff !== 0 && Math.abs(diff) <= 4) {
                next[n - 1] = Math.max(COL_RESIZE_MIN_PX, next[n - 1] + diff);
            }
        }
        setMeasuredColWidths((prev) => (widthsNearlyEqual(prev, next) ? prev : next));
    }, [props.columns.length]);

    useLayoutEffect(() => {
        syncColumnWidthsFromHeader();
    }, [syncColumnWidthsFromHeader, props.colWidthByKey, props.sortKey, props.sortDir, props.columns.length]);

    useLayoutEffect(() => {
        const table = headTableRef.current;
        if (!table) return;
        let raf = 0;
        const run = () => {
            syncColumnWidthsFromHeader();
            raf = requestAnimationFrame(() => {
                syncColumnWidthsFromHeader();
            });
        };
        run();
        const ro = new ResizeObserver(() => run());
        ro.observe(table);
        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
        };
    }, [syncColumnWidthsFromHeader]);

    /** TanStack Virtual: 스크롤 위치 함수가 메모 불가하다고 보는 React Compiler 규칙만 예외 처리 */
    // eslint-disable-next-line react-hooks/incompatible-library
    const rowVirtualizer = useVirtualizer({
        count: props.data.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => ROW_HEIGHT_PX,
        overscan: 10,
    });

    const colsLen = props.columns.length;
    const colWidthsReady =
        measuredColWidths.length === colsLen && measuredColWidths.every((w) => w > 0);
    const totalGridWidth = colWidthsReady ? sumWidths(measuredColWidths) : 0;

    return (
        <div ref={scrollRef} style={{ overflow: "auto", flex: 1, minHeight: 0 }}>
            {/** thead만 있는 table과 가상 행 영역이 형제라, 세로 헤더 고정은 table을 sticky 래퍼로 두는 편이 안정적 */}
            <div
                style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                    width: "max-content",
                    minWidth: "100%",
                    backgroundColor: "#f8f8f8",
                }}
            >
                <table
                    ref={headTableRef}
                    style={{
                        width: "max-content",
                        /** min-width보다 명시 width를 안정적으로 쓰도록 */
                        tableLayout: "fixed",
                        borderCollapse: "separate",
                        borderSpacing: 0,
                    }}
                >
                    <thead style={{ backgroundColor: "#f8f8f8" }}>
                    <tr>
                        {props.columns.map((column, cdex) => {
                            const isRowNum = Boolean(column.__rownum__);
                            const isCheckbox = Boolean(column.__checkbox__);
                            const colKey = String(column.key ?? cdex);
                            const savedFromKey = props.colWidthByKey[colKey];
                            const savedWApplied = typeof savedFromKey === "number" && savedFromKey > 0;
                            /** 저장·리사이즈 값은 최소 너비 미만일 때 바닥까지 올림 */
                            const effectiveSavedWpx = savedWApplied
                                ? Math.max(DEFAULT_DATA_COL_WIDTH_PX, Math.round(savedFromKey))
                                : undefined;
                            const isDataCol = !isCheckbox && !isRowNum;
                            /** 사용자 width 없음 → 라벨+기본 레이아웃만 */
                            const intrinsicLabelCol = isDataCol && !savedWApplied;
                            return (
                                <th
                                    key={colKey}
                                    ref={(el) => {
                                        props.headerCellRefs.current[cdex] = el;
                                    }}
                                    onClick={(e) => {
                                        if ((e.target as HTMLElement).closest('[data-jsgrid-col-resize="1"]')) return;
                                        if (e.altKey) {
                                            props.setFreezeUntilIndex((prev) => (prev === cdex ? null : cdex));
                                            return;
                                        }
                                        if (isCheckbox) {
                                            props.rowSelection?.onToggleAll();
                                            return;
                                        }
                                        if (isRowNum) return;
                                        const same = props.sortKey === column.key;
                                        const nextDir: "ASC" | "DESC" = same
                                            ? props.sortDir === "DESC"
                                                ? "ASC"
                                                : "DESC"
                                            : "ASC";
                                        props.onSortChange({ key: column.key, direction: nextDir });
                                    }}
                                    style={{
                                        position: "sticky",
                                        top: 0,
                                        zIndex: 4,
                                        backgroundColor: "#f8f8f8",
                                        borderBottom: `1px solid ${GRID_BORDER}`,
                                        borderRight: `1px solid ${GRID_BORDER}`,
                                        boxSizing: "border-box",
                                        cursor: isCheckbox ? "pointer" : isRowNum ? "default" : "pointer",
                                        userSelect: "none",
                                        textAlign: "center",
                                        paddingRight: isRowNum ? 10 : undefined,
                                        ...(intrinsicLabelCol
                                            ? {
                                                  /** 테이블 auto에서 min만으로는 줄어들 수 있어 width 명시 */
                                                  width: `max(${DEFAULT_DATA_COL_WIDTH_PX}px, max-content)` as CSSProperties["width"],
                                                  minWidth: `${DEFAULT_DATA_COL_WIDTH_PX}px`,
                                                  maxWidth: "none",
                                                  overflow: "visible",
                                                  textOverflow: "clip",
                                                  whiteSpace: "nowrap",
                                              }
                                            : {
                                                  minWidth: isCheckbox
                                                      ? "40px"
                                                      : isRowNum
                                                        ? "56px"
                                                        : `${DEFAULT_DATA_COL_WIDTH_PX}px`,
                                                  maxWidth:
                                                      isCheckbox || isRowNum
                                                          ? undefined
                                                          : savedWApplied && effectiveSavedWpx != null
                                                            ? effectiveSavedWpx
                                                            : CELL_MAX_WIDTH_PX,
                                                  width:
                                                      savedWApplied && effectiveSavedWpx != null
                                                          ? `${effectiveSavedWpx}px`
                                                          : undefined,
                                                  overflow: isCheckbox || isRowNum ? undefined : "hidden",
                                                  textOverflow: isCheckbox || isRowNum ? undefined : "ellipsis",
                                                  whiteSpace: isCheckbox || isRowNum ? undefined : "nowrap",
                                              }),
                                        ...props.getStickyStyle({ colIndex: cdex, isHeader: true }),
                                    }}
                                >
                                    {isCheckbox && props.rowSelection ? (
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "center",
                                                alignItems: "center",
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={props.rowSelection.headerChecked}
                                                disabled={props.rowSelection.pageRowIds.length === 0}
                                                readOnly
                                                style={{ pointerEvents: "none" }}
                                            />
                                        </div>
                                    ) : (
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                paddingLeft: 6,
                                                paddingRight: 6,
                                                gap: 2,
                                            }}
                                        >
                                            {!isRowNum && (
                                                <span
                                                    style={{
                                                        display: "inline-block",
                                                        flexShrink: 0,
                                                        width: SORT_ICON_PX,
                                                        minWidth: SORT_ICON_PX,
                                                        height: SORT_ICON_PX,
                                                    }}
                                                    aria-hidden
                                                />
                                            )}
                                            <span
                                                style={
                                                    intrinsicLabelCol
                                                        ? {
                                                              whiteSpace: "nowrap",
                                                              flex: "0 0 auto",
                                                              flexShrink: 0,
                                                              minWidth: "max-content",
                                                              width: "max-content",
                                                              overflow: "visible",
                                                          }
                                                        : {
                                                              overflow: "hidden",
                                                              textOverflow: "ellipsis",
                                                              whiteSpace: "nowrap",
                                                              minWidth: 0,
                                                          }
                                                }
                                            >
                                                {column.label}
                                            </span>
                                            {!isRowNum && (
                                                <span
                                                    style={{
                                                        display: "inline-flex",
                                                        flexShrink: 0,
                                                        width: SORT_ICON_PX,
                                                        minWidth: SORT_ICON_PX,
                                                        height: SORT_ICON_PX,
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                    }}
                                                    aria-hidden={props.sortKey !== column.key}
                                                >
                                                    {props.sortKey === column.key &&
                                                        (props.sortDir === "DESC" ? (
                                                            <span
                                                                style={{ display: "inline-flex", flex: "0 0 auto" }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    props.onSortChange({
                                                                        key: column.key,
                                                                        direction: "ASC",
                                                                    });
                                                                }}
                                                            >
                                                                <DESC
                                                                    style={{
                                                                        width: SORT_ICON_PX,
                                                                        height: SORT_ICON_PX,
                                                                        cursor: "pointer",
                                                                        color: "#111827",
                                                                    }}
                                                                />
                                                            </span>
                                                        ) : (
                                                            <span
                                                                style={{ display: "inline-flex", flex: "0 0 auto" }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    props.onSortChange({
                                                                        key: column.key,
                                                                        direction: "DESC",
                                                                    });
                                                                }}
                                                            >
                                                                <ASC
                                                                    style={{
                                                                        width: SORT_ICON_PX,
                                                                        height: SORT_ICON_PX,
                                                                        cursor: "pointer",
                                                                        color: "#111827",
                                                                    }}
                                                                />
                                                            </span>
                                                        ))}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {!isCheckbox && !isRowNum && props.onColumnWidthChange ? (
                                        <HeaderColumnResizeHandle
                                            minPx={DEFAULT_DATA_COL_WIDTH_PX}
                                            maxPx={COL_RESIZE_MAX_PX}
                                            onResize={(w) => props.onColumnWidthChange?.(column.key, w)}
                                        />
                                    ) : null}
                                </th>
                            );
                        })}
                        </tr>
                    </thead>
                </table>
            </div>

            <div
                role="rowgroup"
                style={{
                    position: "relative",
                    zIndex: 0,
                    width: totalGridWidth > 0 ? totalGridWidth : undefined,
                    minWidth: "max-content",
                    height: `${rowVirtualizer.getTotalSize()}px`,
                }}
            >
                {rowVirtualizer.getVirtualItems().map((vr) => {
                    const rdex = vr.index;
                    const row = props.data[rdex];
                    return (
                        <div
                            key={vr.key}
                            role="row"
                            aria-rowindex={rdex + 2}
                            className="border"
                            onClick={() => props.onRowClick?.(row)}
                            style={{
                                position: "absolute",
                                top: vr.start,
                                left: 0,
                                width: totalGridWidth > 0 ? totalGridWidth : "100%",
                                minWidth: "max-content",
                                height: `${vr.size}px`,
                                display: "flex",
                                flexDirection: "row",
                                flexWrap: "nowrap",
                                alignItems: "stretch",
                                boxSizing: "border-box",
                                cursor: props.onRowClick ? "pointer" : undefined,
                            }}
                        >
                            {props.columns.map((column, cdex) => {
                                const isRowNum = Boolean(column.__rownum__);
                                const isCheckbox = Boolean(column.__checkbox__);
                                const colKey = String(column.key ?? cdex);
                                const savedFromKey = props.colWidthByKey[colKey];
                                const savedWApplied = typeof savedFromKey === "number" && savedFromKey > 0;
                                const effectiveSavedWpx = savedWApplied
                                    ? Math.max(DEFAULT_DATA_COL_WIDTH_PX, Math.round(savedFromKey))
                                    : undefined;
                                const isDataCol = !isCheckbox && !isRowNum;
                                const intrinsicDataCol = isDataCol && !savedWApplied;
                                const value = isCheckbox
                                    ? null
                                    : column.__rownum__
                                      ? rdex + 1
                                      : getValue(row, column.key);

                                const rendered =
                                    !isCheckbox && !isRowNum && column.render
                                        ? typeof column.render === "function"
                                            ? column.render({
                                                  row,
                                                  value,
                                                  columnKey: column.key,
                                                  rowIndex: rdex,
                                                  stopRowClick: (e: unknown) => {
                                                      if (e && typeof e === "object" && "stopPropagation" in e) {
                                                          (e as React.SyntheticEvent).stopPropagation();
                                                      }
                                                  },
                                              })
                                            : isValidElement(column.render)
                                              ? React.cloneElement(column.render as ReactElement<Record<string, unknown>>, {
                                                    row,
                                                    value,
                                                    columnKey: column.key,
                                                    rowIndex: rdex,
                                                    stopRowClick: (e: unknown) => {
                                                        if (e && typeof e === "object" && "stopPropagation" in e) {
                                                            (e as React.SyntheticEvent).stopPropagation();
                                                        }
                                                    },
                                                })
                                              : column.render
                                        : null;

                                const lockedPx = colWidthsReady ? measuredColWidths[cdex] : undefined;
                                const tdStyle: CSSProperties = {
                                    borderBottom: `1px solid ${GRID_BORDER}`,
                                    borderRight: `1px solid ${GRID_BORDER}`,
                                    ...(lockedPx != null && lockedPx > 0
                                        ? {
                                              width: lockedPx,
                                              minWidth: lockedPx,
                                              maxWidth: lockedPx,
                                          }
                                        : {
                                              width:
                                                  intrinsicDataCol
                                                      ? (`max(${DEFAULT_DATA_COL_WIDTH_PX}px, max-content)` as CSSProperties["width"])
                                                      : savedWApplied && effectiveSavedWpx != null
                                                        ? `${effectiveSavedWpx}px`
                                                        : undefined,
                                              minWidth: isCheckbox
                                                  ? "40px"
                                                  : isRowNum
                                                    ? "56px"
                                                    : `${DEFAULT_DATA_COL_WIDTH_PX}px`,
                                              maxWidth:
                                                  isCheckbox || isRowNum
                                                      ? undefined
                                                      : intrinsicDataCol
                                                        ? CELL_MAX_WIDTH_PX
                                                        : savedWApplied && effectiveSavedWpx != null
                                                          ? effectiveSavedWpx
                                                          : CELL_MAX_WIDTH_PX,
                                          }),
                                    boxSizing: "border-box",
                                    whiteSpace: "nowrap",
                                    /** 헤더 측으로 열 폭이 잠기면 데이터가 길어도 칸 안에 말줄임(넘김 금지) */
                                    overflow:
                                        isCheckbox || isRowNum
                                            ? undefined
                                            : intrinsicDataCol &&
                                                !(lockedPx != null && lockedPx > 0)
                                              ? "visible"
                                              : "hidden",
                                    textOverflow:
                                        isCheckbox || isRowNum
                                            ? undefined
                                            : intrinsicDataCol &&
                                                !(lockedPx != null && lockedPx > 0)
                                              ? "clip"
                                              : "ellipsis",
                                    textAlign: isCheckbox ? "center" : isRowNum ? "right" : undefined,
                                    paddingRight: isCheckbox ? undefined : 10,
                                    paddingLeft: isCheckbox ? undefined : isRowNum ? undefined : 10,
                                    cursor: isCheckbox && props.rowSelection ? "pointer" : undefined,
                                    flexShrink: 0,
                                    ...props.getStickyStyle({ colIndex: cdex, isHeader: false }),
                                };

                                const onCellClick = (e: React.MouseEvent<HTMLDivElement>) => {
                                    if (isCheckbox) {
                                        e.stopPropagation();
                                        if (!props.rowSelection) return;
                                        props.rowSelection.onToggleRow(rdex);
                                        return;
                                    }
                                    if (column.render) {
                                        e.stopPropagation();
                                    }
                                };

                                const tdChildren =
                                    isCheckbox && props.rowSelection ? (
                                        <input
                                            type="checkbox"
                                            checked={props.rowSelection.selectedIds.has(rdex)}
                                            readOnly
                                            style={{ pointerEvents: "none" }}
                                        />
                                    ) : (
                                        (rendered ?? (value as unknown as ReactNode))
                                    );

                                if (isCheckbox || isRowNum) {
                                    return (
                                        <div
                                            key={colKey}
                                            role="presentation"
                                            className="border h-[30px]"
                                            onClick={onCellClick}
                                            style={tdStyle}
                                        >
                                            {tdChildren}
                                        </div>
                                    );
                                }
                                return (
                                    <TruncatingDiv
                                        key={colKey}
                                        className="border h-[30px]"
                                        onClick={onCellClick}
                                        style={tdStyle}
                                    >
                                        {tdChildren}
                                    </TruncatingDiv>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
            {props.data.length === 0 && colsLen > 0 ? (
                <div
                    role="status"
                    aria-live="polite"
                    style={{
                        boxSizing: "border-box",
                        width: totalGridWidth > 0 ? totalGridWidth : "100%",
                        minWidth: "max-content",
                        minHeight: 120,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#64748b",
                        fontSize: 13,
                    }}
                >
                    데이터가 없습니다.
                </div>
            ) : null}
        </div>
    );
}
