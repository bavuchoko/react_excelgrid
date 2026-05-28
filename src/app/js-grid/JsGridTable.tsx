import { useVirtualizer } from "@tanstack/react-virtual";
import { formatCellDisplayValue, getValue } from "../hook/CommonMethod.ts";
// (주의) 헤더 실측 너비를 state로 되먹이면 ResizeObserver ↔ setState 루프가 나기 쉽다.
import {
    CELL_MAX_WIDTH_PX,
    COL_RESIZE_MAX_PX,
    DEFAULT_DATA_COL_WIDTH_PX,
    GRID_BORDER,
} from "./gridStyles.ts";
import type {
    CSSProperties,
    MutableRefObject,
    ReactElement,
    ReactNode,
} from "react";
import React, {
    forwardRef,
    isValidElement,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import type {
    GridCellEditEvent,
    GridCellPasteBatch,
    GridCellPasteItem,
    JsGridTableColumn,
    JsGridTableHandle,
} from "../type/Type.ts";
import { renderGridCellEditor } from "./renderGridCellEditor.tsx";
import {
    groupPasteItemsIntoBatches,
    isCellInRange,
    normalizeCellRange,
    parseClipboardLines,
    pasteLineForRowIndex,
    resolveRowId,
    type GridCellRange,
} from "./gridCellSelection.ts";
import { MODIFIED_CELL_BG } from "./cellModified.ts";
import type { Content } from "../type/Type.ts";
import {
    mergeSheetErrorCellStyles,
    type SheetCellErrorLookup,
    type SheetErrorCategoryKey,
} from "./sheetErrors.ts";
import ASC from "../resources/icon/ASC.tsx";
import DESC from "../resources/icon/DESC.tsx";
import {
    bodyCellStateClassNames,
    bodyRowClassName,
    gridColClassNames,
} from "./gridClassNames.ts";

export type { JsGridTableColumn } from "../type/Type.ts";

type CellEditorSession = {
    rowIndex: number;
    columnKey: string;
};

type CellDragState = {
    active: boolean;
    columnKey: string;
    anchorRow: number;
    currentRow: number;
    moved: boolean;
};

const SORT_ICON_PX = 14;
/** tbody 행 높이(기존 `h-[30px]`과 동일) — 가변 행이면 후에 `measureElement`로 확장 */
const ROW_HEIGHT_PX = 30;

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
        const up = (ev: PointerEvent) => {
            try {
                (e.currentTarget as HTMLDivElement).releasePointerCapture(ev.pointerId);
            } catch {
                /* noop */
            }
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", up);
        };
        try {
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        } catch {
            /* noop */
        }
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
    };
    return (
        <div
            className="js-grid-col-resize"
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
                width: 8,
                cursor: "col-resize",
                zIndex: 8,
                touchAction: "none",
                marginRight: -2,
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
    /** Alt+헤더 클릭 시 틀 고정(인덱스 토글). */
    onFreezeColumn: (colIndex: number) => void;
    getStickyStyle: (args: { colIndex: number; isHeader: boolean }) => CSSProperties | undefined;
    onSortChange: (next: { key: string; direction: "ASC" | "DESC" }) => void;
    rowSelection?: RowSelectionProps;
    /** `true`(기본)이면 헤더 드래그로 열 너비 조절. */
    columnResizable?: boolean;
    onColumnWidthChange?: (columnKey: string, widthPx: number) => void;
    /** `true` 일 때 셀 선택·재클릭 편집·붙여넣기 동작 활성. */
    editable?: boolean;
    /** 편집기에서 값이 변경되었을 때 발행. */
    onCellChange?: (event: GridCellEditEvent) => void | Promise<void>;
    /** 같은 열 범위 + 붙여넣기(Ctrl+V) 시 발행. */
    onCellsPaste?: (batches: GridCellPasteBatch[]) => void | Promise<void>;
    /** 붙여넣기 배치에서 행 식별 필드(기본 `id`). */
    rowIdKey?: string;
    /**
     * `data[i]` 의 원본 행 인덱스(정렬 전). `data[displayRowIndex]` 와 1:1.
     * 오류 인덱스는 원본 `data` 기준이므로 셀 스타일에 필요하다.
     */
    sourceRowIndexes?: readonly number[];
    /** 시트 `errors` 기반 셀 오류 조회. */
    cellErrorLookup?: SheetCellErrorLookup | null;
    /**
     * 원본 대비 값이 바뀐 셀인지(편집·붙여넣기 추적 + baseline 비교).
     * `sourceRowIndex` 는 정렬 전 `data` 기준.
     */
    isCellModified?: (
        sourceRowIndex: number,
        columnKey: string,
        currentRow: Content,
    ) => boolean;
    /** 필터가 활성된 컬럼 key 집합 — 헤더 아이콘 강조용 */
    filteredColumnKeys?: ReadonlySet<string>;
    /** 현재 열려있는 필터 메뉴의 컬럼 key */
    openFilterColumnKey?: string | null;
    /** 헤더 필터 아이콘 클릭 시 호출(좌표 포함). 미지정이면 아이콘을 표시하지 않는다. */
    onToggleColumnFilter?: (args: { columnKey: string; top: number; left: number }) => void;
};

const JsGridTable = forwardRef<JsGridTableHandle, Props>(function JsGridTable(props, ref) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const headTableRef = useRef<HTMLTableElement>(null);

    const editingEnabled = props.editable === true;
    const rowIdKey = props.rowIdKey ?? "id";

    const [editorSession, setEditorSession] = useState<CellEditorSession | null>(null);
    const [cellRange, setCellRange] = useState<GridCellRange | null>(null);
    const dragStateRef = useRef<CellDragState | null>(null);
    const lastClickRef = useRef<{ rowIndex: number; columnKey: string } | null>(null);

    useEffect(() => {
        if (!editingEnabled) {
            setEditorSession(null);
            setCellRange(null);
            dragStateRef.current = null;
            lastClickRef.current = null;
        }
    }, [editingEnabled]);

    /**
     * 정렬 변경 시 표시 행 인덱스가 바뀌므로, 기존 선택/드래그/편집 상태를 유지하면
     * 복사·붙여넣기 범위가 엉킬 수 있다. 정렬 변경 시 즉시 취소한다.
     */
    useEffect(() => {
        setEditorSession(null);
        setCellRange(null);
        dragStateRef.current = null;
        lastClickRef.current = null;
    }, [props.sortKey, props.sortDir]);

    const closeEditor = useCallback(() => setEditorSession(null), []);

    const isBodyCellSelectable = useCallback(
        (column: JsGridTableColumn) =>
            editingEnabled && !column.__checkbox__ && !column.__rownum__,
        [editingEnabled],
    );

    const resolveCellValue = useCallback(
        (row: unknown, column: JsGridTableColumn, rdex: number): unknown => {
            if (column.__checkbox__) return null;
            if (column.__rownum__) return rdex + 1;
            return getValue(row, column.key);
        },
        [],
    );

    /** 편집기 바깥 클릭/ESC 로 닫기. */
    useEffect(() => {
        if (!editorSession) return;
        const onDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (target?.closest("[data-jsgrid-cell-editing='1']")) return;
            closeEditor();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeEditor();
        };
        window.addEventListener("mousedown", onDown);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("mousedown", onDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [editorSession, closeEditor]);

    const handleEditorChange = useCallback(
        (nextValue: unknown, options?: { close?: boolean }) => {
            if (!editorSession) return;
            const editorColumn = props.columns.find((c) => c.key === editorSession.columnKey);
            if (!editorColumn) return;
            const row = props.data[editorSession.rowIndex];
            if (row === undefined) return;
            const displayRow = editorSession.rowIndex;
            const sourceRowIndex =
                props.sourceRowIndexes?.[displayRow] ?? displayRow;
            const previousValue = resolveCellValue(row, editorColumn, displayRow);
            props.onCellChange?.({
                row,
                rowIndex: displayRow,
                sourceRowIndex,
                columnKey: editorColumn.key,
                value: nextValue,
                previousValue,
            });
            if (options?.close) closeEditor();
        },
        [
            editorSession,
            props.columns,
            props.data,
            props.onCellChange,
            props.sourceRowIndexes,
            resolveCellValue,
            closeEditor,
        ],
    );

    const openCellEditor = useCallback(
        (args: { rowIndex: number; columnKey: string }) => {
            if (!editingEnabled) return;
            const col = props.columns.find((c) => c.key === args.columnKey);
            if (!col?.editor) return;
            setEditorSession(args);
        },
        [editingEnabled, props.columns],
    );

    const finishDragClick = useCallback(
        (rowIndex: number, columnKey: string, hasEditor: boolean) => {
            const drag = dragStateRef.current;
            dragStateRef.current = null;
            if (!drag?.active) return;

            if (!drag.moved) {
                const prev = lastClickRef.current;
                if (
                    editingEnabled
                    && prev
                    && prev.rowIndex === rowIndex
                    && prev.columnKey === columnKey
                    && hasEditor
                ) {
                    lastClickRef.current = null;
                    openCellEditor({ rowIndex, columnKey });
                    return;
                }
                lastClickRef.current = { rowIndex, columnKey };
            } else {
                lastClickRef.current = null;
            }
        },
        [editingEnabled, openCellEditor],
    );

    const resolveBodyCellFromPoint = useCallback(
        (clientX: number, clientY: number): { rowIndex: number; columnKey: string } | null => {
            const el = document.elementFromPoint(clientX, clientY);
            const td = el?.closest<HTMLElement>("[data-jsgrid-body-cell='1']");
            if (!td) return null;
            const rowIndex = Number(td.dataset.jsgridRow);
            const columnKey = td.dataset.jsgridCol;
            if (!Number.isFinite(rowIndex) || !columnKey) return null;
            return { rowIndex, columnKey };
        },
        [],
    );

    useEffect(() => {
        if (!editingEnabled) return;

        const endDrag = (releaseRow: number, columnKey: string) => {
            const col = props.columns.find((c) => c.key === columnKey);
            finishDragClick(releaseRow, columnKey, Boolean(col?.editor));
        };

        const onPointerMove = (e: PointerEvent) => {
            const drag = dragStateRef.current;
            if (!drag?.active) return;
            const hit = resolveBodyCellFromPoint(e.clientX, e.clientY);
            if (!hit || hit.columnKey !== drag.columnKey) return;
            if (hit.rowIndex !== drag.currentRow) {
                drag.currentRow = hit.rowIndex;
                if (hit.rowIndex !== drag.anchorRow) drag.moved = true;
                setCellRange(
                    normalizeCellRange(drag.columnKey, drag.anchorRow, hit.rowIndex),
                );
            }
        };

        const onPointerUp = () => {
            const drag = dragStateRef.current;
            if (!drag?.active) return;
            endDrag(drag.currentRow, drag.columnKey);
        };

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);
        return () => {
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("pointercancel", onPointerUp);
        };
    }, [editingEnabled, finishDragClick, props.columns, resolveBodyCellFromPoint]);

    const buildPasteItems = useCallback(
        (range: GridCellRange, lines: string[]): GridCellPasteItem[] => {
            const column = props.columns.find((c) => c.key === range.columnKey);
            if (!column) return [];
            const items: GridCellPasteItem[] = [];
            const rowCount = range.rowEnd - range.rowStart + 1;
            for (let i = 0; i < rowCount; i++) {
                const rowIndex = range.rowStart + i;
                const row = props.data[rowIndex];
                if (row === undefined) continue;
                const line = pasteLineForRowIndex(lines, i);
                const previousValue = resolveCellValue(row, column, rowIndex);
                const sourceRowIndex = props.sourceRowIndexes?.[rowIndex] ?? rowIndex;
                items.push({
                    row,
                    rowId: resolveRowId(row, rowIdKey),
                    columnKey: range.columnKey,
                    rowIndex,
                    sourceRowIndex,
                    value: line,
                    previousValue,
                });
            }
            return items;
        },
        [props.columns, props.data, props.sourceRowIndexes, resolveCellValue, rowIdKey],
    );

    /** 복사/붙여넣기. 셀 범위가 잡혀있을 때만 동작. */
    useEffect(() => {
        if (!editingEnabled) return;
        const root = scrollRef.current;
        if (!root) return;

        const onCopy = (e: ClipboardEvent) => {
            if (!cellRange) return;
            const column = props.columns.find((c) => c.key === cellRange.columnKey);
            if (!column) return;
            const lines: string[] = [];
            for (let r = cellRange.rowStart; r <= cellRange.rowEnd; r++) {
                const row = props.data[r];
                if (row === undefined) continue;
                const value = resolveCellValue(row, column, r);
                lines.push(formatCellDisplayValue(value));
            }
            if (lines.length === 0) return;
            e.preventDefault();
            e.clipboardData?.setData("text/plain", lines.join("\n"));
        };

        const onPaste = (e: ClipboardEvent) => {
            if (!cellRange || !props.onCellsPaste) return;
            const column = props.columns.find((c) => c.key === cellRange.columnKey);
            if (!column || column.__checkbox__ || column.__rownum__) return;
            if (!root.contains(document.activeElement) && document.activeElement !== document.body) {
                const sel = document.getSelection();
                if (sel && sel.anchorNode && !root.contains(sel.anchorNode)) return;
            }
            e.preventDefault();
            const text = e.clipboardData?.getData("text/plain") ?? "";
            const lines = parseClipboardLines(text);
            const items = buildPasteItems(cellRange, lines);
            const batches = groupPasteItemsIntoBatches(items);
            if (batches.length > 0) void Promise.resolve(props.onCellsPaste(batches));
        };

        root.addEventListener("copy", onCopy);
        root.addEventListener("paste", onPaste);
        return () => {
            root.removeEventListener("copy", onCopy);
            root.removeEventListener("paste", onPaste);
        };
    }, [
        editingEnabled,
        cellRange,
        props.columns,
        props.data,
        props.onCellsPaste,
        resolveCellValue,
        buildPasteItems,
    ]);

    /** 그리드 바깥 클릭 시 범위 해제. */
    useEffect(() => {
        if (!editingEnabled) return;
        const onDown = (e: MouseEvent) => {
            const root = scrollRef.current;
            if (!root?.contains(e.target as Node)) {
                setCellRange(null);
                lastClickRef.current = null;
            }
        };
        window.addEventListener("mousedown", onDown);
        return () => window.removeEventListener("mousedown", onDown);
    }, [editingEnabled]);

    // (중요) 헤더 실측값을 state로 갱신하면서 그 값을 다시 colgroup/width로 적용하면
    // ResizeObserver/레이아웃 변화가 서로를 트리거해서 "Maximum update depth"가 난다.
    // 여기서는 실측 기반 자동 너비 동기화를 하지 않는다(드래그/저장 너비만 반영).

    const colsLen = props.columns.length;
    const columnResizable = props.columnResizable !== false && Boolean(props.onColumnWidthChange);

    /** 사용자 리사이즈(`colWidthByKey`)만 즉시 반영. */
    const effectiveColWidths = useMemo(() => {
        const out = new Array<number>(colsLen);
        for (let i = 0; i < colsLen; i++) {
            const colKey = String(props.columns[i]?.key ?? i);
            const overridden = props.colWidthByKey[colKey];
            if (typeof overridden === "number" && overridden > 0) {
                out[i] = Math.max(DEFAULT_DATA_COL_WIDTH_PX, Math.round(overridden));
                continue;
            }
            // 저장/드래그 값이 없으면 기본 시작 폭으로 둔다.
            out[i] = DEFAULT_DATA_COL_WIDTH_PX;
        }
        return out;
    }, [colsLen, props.columns, props.colWidthByKey]);

    const colWidthsReady =
        effectiveColWidths.length === colsLen && effectiveColWidths.every((w) => w > 0);
    const totalGridWidth = colWidthsReady ? sumWidths(effectiveColWidths) : 0;

    // ResizeObserver 기반 너비 sync 제거(무한 업데이트 루프 방지)

    /** TanStack Virtual: 스크롤 위치 함수가 메모 불가하다고 보는 React Compiler 규칙만 예외 처리 */
    // eslint-disable-next-line react-hooks/incompatible-library
    const rowVirtualizer = useVirtualizer({
        count: props.data.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => ROW_HEIGHT_PX,
        overscan: 10,
    });

    /**
     * 헤더 셀의 가로 위치를 사용해 본문 가로 스크롤을 보정.
     * - 본문은 가상화되어 있어 임의 행의 td 를 찾기 어렵지만, 헤더 셀은 항상 마운트되어 있다.
     * - sticky 컬럼(체크박스/행번호/freeze) 의 가림 폭만큼 보정한 뒤, 셀이 보이지 않으면 가운데로 이동.
     */
    const scrollColumnIntoView = useCallback((colIndex: number) => {
        const scroller = scrollRef.current;
        const headerCell = props.headerCellRefs.current[colIndex];
        if (!scroller || !headerCell) return;
        const cellLeft = headerCell.offsetLeft;
        const cellWidth = headerCell.offsetWidth;
        const cellRight = cellLeft + cellWidth;
        const viewLeft = scroller.scrollLeft;
        const viewRight = viewLeft + scroller.clientWidth;
        if (cellLeft >= viewLeft && cellRight <= viewRight) return;
        const center = Math.max(0, cellLeft - Math.max(0, (scroller.clientWidth - cellWidth) / 2));
        scroller.scrollLeft = center;
    }, [props.headerCellRefs]);

    useImperativeHandle(
        ref,
        (): JsGridTableHandle => ({
            focusCell: ({ rowIndex, columnKey }) => {
                if (!Number.isFinite(rowIndex) || rowIndex < 0 || rowIndex >= props.data.length) return;

                const scrollRowIntoView = () => {
                    rowVirtualizer.scrollToIndex(rowIndex, { align: "center" });
                };
                scrollRowIntoView();

                const colIndex = columnKey
                    ? props.columns.findIndex((c) => c.key === columnKey)
                    : -1;

                const applyFocus = () => {
                    scrollRowIntoView();
                    if (colIndex >= 0) scrollColumnIntoView(colIndex);
                    if (columnKey && editingEnabled) {
                        setCellRange({ columnKey, rowStart: rowIndex, rowEnd: rowIndex });
                    }
                    scrollRef.current?.focus({ preventScroll: true });
                };

                /** 가상 행 마운트 후 스크롤·선택(프레임 1회만으로는 무시되는 경우 대비). */
                requestAnimationFrame(() => {
                    requestAnimationFrame(applyFocus);
                });
                window.setTimeout(applyFocus, 0);
            },
        }),
        [props.columns, props.data.length, rowVirtualizer, scrollColumnIntoView, editingEnabled],
    );

    const lockedColumnStyle = (lockedPx: number | undefined): CSSProperties | undefined =>
        lockedPx != null && lockedPx > 0
            ? {
                  width: lockedPx,
                  minWidth: lockedPx,
                  maxWidth: lockedPx,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
              }
            : undefined;

    return (
        <div
            ref={scrollRef}
            className="js-grid-table-scroll"
            style={{ overflow: "auto", flex: 1, minHeight: 0, outline: "none" }}
            tabIndex={-1}
        >
            {/** thead만 있는 table과 가상 행 영역이 형제라, 세로 헤더 고정은 table을 sticky 래퍼로 두는 편이 안정적 */}
            <div
                style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                    width: totalGridWidth > 0 ? totalGridWidth : "max-content",
                    minWidth: "100%",
                }}
            >
                <table
                    ref={headTableRef}
                    className="js-grid-table"
                    style={{
                        width: totalGridWidth > 0 ? totalGridWidth : "max-content",
                        tableLayout: "fixed",
                        borderCollapse: "separate",
                        borderSpacing: 0,
                    }}
                >
                    {colWidthsReady ? (
                        <colgroup>
                            {effectiveColWidths.map((w, i) => (
                                <col key={i} style={{ width: w }} />
                            ))}
                        </colgroup>
                    ) : null}
                    <thead style={{ backgroundColor: "#f8f8f8" }}>
                    <tr className="js-grid-head-row">
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
                            const headerLockedPx = colWidthsReady ? effectiveColWidths[cdex] : undefined;
                            const headerLocked = lockedColumnStyle(headerLockedPx);
                            return (
                                <th
                                    key={colKey}
                                    className={gridColClassNames(cdex, column, "th")}
                                    ref={(el) => {
                                        props.headerCellRefs.current[cdex] = el;
                                    }}
                                    onClick={(e) => {
                                        if ((e.target as HTMLElement).closest('[data-jsgrid-col-resize="1"]')) return;
                                        if (e.altKey) {
                                            props.onFreezeColumn(cdex);
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
                                        paddingRight: isRowNum ? 10 : isDataCol ? 10 : undefined,
                                        paddingLeft: isDataCol ? 10 : undefined,
                                        ...(headerLocked
                                            ? headerLocked
                                            : intrinsicLabelCol
                                              ? {
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
                                                className="js-grid-chk-box"
                                                checked={props.rowSelection.headerChecked}
                                                disabled={props.rowSelection.pageRowIds.length === 0}
                                                readOnly
                                                style={{ pointerEvents: "none" }}
                                            />
                                        </div>
                                    ) : (
                                        <div
                                            className="js-grid-cell-inner"
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
                                            {column.filterable && props.onToggleColumnFilter
                                                ? (() => {
                                                      const isOpen =
                                                          props.openFilterColumnKey === column.key;
                                                      const isActive =
                                                          props.filteredColumnKeys?.has(column.key) ===
                                                          true;
                                                      return (
                                                          <span
                                                              role="button"
                                                              tabIndex={0}
                                                              aria-label={`${column.label} 필터`}
                                                              data-jsgrid-filter-trigger="1"
                                                              data-active={isOpen ? "1" : "0"}
                                                              onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  const rect = (
                                                                      e.currentTarget as HTMLElement
                                                                  ).getBoundingClientRect();
                                                                  props.onToggleColumnFilter?.({
                                                                      columnKey: column.key,
                                                                      top: rect.bottom + 4,
                                                                      left: rect.left,
                                                                  });
                                                              }}
                                                              style={{
                                                                  display: "inline-flex",
                                                                  alignItems: "center",
                                                                  justifyContent: "center",
                                                                  flexShrink: 0,
                                                                  width: SORT_ICON_PX,
                                                                  minWidth: SORT_ICON_PX,
                                                                  height: SORT_ICON_PX,
                                                                  cursor: "pointer",
                                                                  borderRadius: 2,
                                                                  color: isActive ? "#1d4ed8" : "#9ca3af",
                                                                  backgroundColor: isOpen
                                                                      ? "rgba(29,78,216,0.12)"
                                                                      : undefined,
                                                              }}
                                                          >
                                                              <svg
                                                                  viewBox="0 0 16 16"
                                                                  width={SORT_ICON_PX - 2}
                                                                  height={SORT_ICON_PX - 2}
                                                                  aria-hidden
                                                                  focusable="false"
                                                              >
                                                                  <path
                                                                      d="M2 3h12l-4.5 5.5V13l-3 1V8.5L2 3z"
                                                                      fill={
                                                                          isActive ? "#1d4ed8" : "none"
                                                                      }
                                                                      stroke="currentColor"
                                                                      strokeWidth="1.2"
                                                                      strokeLinejoin="round"
                                                                  />
                                                              </svg>
                                                          </span>
                                                      );
                                                  })()
                                                : null}
                                        </div>
                                    )}
                                    {columnResizable && isDataCol ? (
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
                className="js-grid-body"
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
                    const rowId = resolveRowId(row, rowIdKey);
                    const rowIdForClass =
                        rowId === null || rowId === undefined ? undefined : rowId;
                    const gridTemplateColumns = colWidthsReady
                        ? effectiveColWidths.map((w) => `${w}px`).join(" ")
                        : undefined;
                    const usingGridLayout = Boolean(gridTemplateColumns);
                    return (
                        <div
                            key={vr.key}
                            role="row"
                            aria-rowindex={rdex + 2}
                            className={bodyRowClassName(rdex, rowIdForClass)}
                            style={{
                                position: "absolute",
                                top: vr.start,
                                left: 0,
                                width: totalGridWidth > 0 ? totalGridWidth : "100%",
                                minWidth: totalGridWidth > 0 ? totalGridWidth : "max-content",
                                height: `${vr.size}px`,
                                /**
                                 * `flex` → `grid`: sticky는 flex 직계 자식에서 무시된다(CSS 사양).
                                 * grid에서는 자식이 `position: sticky`를 가질 수 있다.
                                 * colWidthsReady 이전에는 flex 유지(너비 불확정 상태).
                                 */
                                display: gridTemplateColumns ? "grid" : "flex",
                                ...(gridTemplateColumns
                                    ? { gridTemplateColumns }
                                    : { flexDirection: "row", flexWrap: "nowrap" }),
                                alignItems: "stretch",
                                boxSizing: "border-box",
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
                                    : isRowNum
                                      ? rdex + 1
                                      : getValue(row, column.key);

                                const selectable = isBodyCellSelectable(column);
                                const hasEditor =
                                    editingEnabled && selectable && Boolean(column.editor);
                                const isSelected = isCellInRange(cellRange, rdex, column.key);
                                const isEditing =
                                    editorSession?.rowIndex === rdex
                                    && editorSession?.columnKey === column.key
                                    && hasEditor;

                                const stopRowClick = (e: unknown) => {
                                    if (e && typeof e === "object" && "stopPropagation" in e) {
                                        (e as React.SyntheticEvent).stopPropagation();
                                    }
                                };

                                const rendered =
                                    !isCheckbox && !isRowNum && column.render
                                        ? typeof column.render === "function"
                                            ? column.render({
                                                  row,
                                                  value,
                                                  columnKey: column.key,
                                                  rowIndex: rdex,
                                                  stopRowClick,
                                              })
                                            : isValidElement(column.render)
                                              ? React.cloneElement(column.render as ReactElement<Record<string, unknown>>, {
                                                    row,
                                                    value,
                                                    columnKey: column.key,
                                                    rowIndex: rdex,
                                                    stopRowClick,
                                                })
                                              : column.render
                                        : null;

                                const lockedPx = colWidthsReady ? effectiveColWidths[cdex] : undefined;
                                const bodyLocked = lockedColumnStyle(lockedPx);
                                const tdStyle: CSSProperties = {
                                    height: ROW_HEIGHT_PX,
                                    boxSizing: "border-box",
                                    borderBottom: `1px solid ${GRID_BORDER}`,
                                    borderRight: `1px solid ${GRID_BORDER}`,
                                    ...(bodyLocked
                                        ? bodyLocked
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
                                    whiteSpace: "nowrap",
                                    // 셀(데이터 영역) 내부 컨텐츠를 세로 중앙 정렬
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: isCheckbox ? "center" : isRowNum ? "flex-end" : undefined,
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
                                    cursor: isCheckbox && props.rowSelection
                                        ? "pointer"
                                        : selectable
                                          ? "cell"
                                          : undefined,
                                    flexShrink: 0,
                                    ...props.getStickyStyle({ colIndex: cdex, isHeader: false }),
                                };

                                /**
                                 * 본문 행을 grid로 렌더링하는 경우, 셀 너비는 track이 결정한다.
                                 * 기존 `width: max(..., max-content)` 등은 track을 무시하고 넘쳐나
                                 * 편집기/선택 박스가 옆 칸을 덮는 현상이 생긴다.
                                 */
                                if (usingGridLayout && !bodyLocked) {
                                    tdStyle.width = "100%";
                                    tdStyle.minWidth = 0;
                                    tdStyle.maxWidth = undefined;
                                }

                                let errorCats: readonly SheetErrorCategoryKey[] = [];
                                const sourceRow = props.sourceRowIndexes?.[rdex];
                                if (
                                    isDataCol
                                    && props.cellErrorLookup
                                    && sourceRow != null
                                    && sourceRow >= 0
                                ) {
                                    const columnName = String(column.label ?? "");
                                    errorCats = props.cellErrorLookup.getCategories(
                                        sourceRow,
                                        columnName,
                                    );
                                    if (errorCats.length > 0) {
                                        Object.assign(
                                            tdStyle,
                                            mergeSheetErrorCellStyles(errorCats),
                                        );
                                    }
                                }

                                if (
                                    isDataCol
                                    && props.isCellModified
                                    && sourceRow != null
                                    && sourceRow >= 0
                                    && props.isCellModified(sourceRow, column.key, row as Content)
                                ) {
                                    tdStyle.backgroundColor = MODIFIED_CELL_BG;
                                }

                                if (isSelected) {
                                    tdStyle.backgroundColor = "#dbeafe";
                                }
                                if (isEditing) {
                                    tdStyle.outline = "1px solid #2563eb";
                                    tdStyle.outlineOffset = -1;
                                    tdStyle.overflow = "visible";
                                    tdStyle.textOverflow = "clip";
                                    tdStyle.zIndex = 2;
                                    tdStyle.position = "relative";
                                }

                                const onCellPointerDown = (
                                    e: React.PointerEvent<HTMLDivElement>,
                                ) => {
                                    if (isCheckbox) {
                                        e.stopPropagation();
                                        if (!props.rowSelection) return;
                                        props.rowSelection.onToggleRow(rdex);
                                        return;
                                    }
                                    if (!selectable) return;
                                    if (isEditing) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (
                                        editorSession
                                        && (editorSession.rowIndex !== rdex
                                            || editorSession.columnKey !== column.key)
                                    ) {
                                        closeEditor();
                                    }
                                    dragStateRef.current = {
                                        active: true,
                                        columnKey: column.key,
                                        anchorRow: rdex,
                                        currentRow: rdex,
                                        moved: false,
                                    };
                                    setCellRange(normalizeCellRange(column.key, rdex, rdex));
                                    scrollRef.current?.focus({ preventScroll: true });
                                    try {
                                        e.currentTarget.setPointerCapture(e.pointerId);
                                    } catch {
                                        // 일부 환경(보드 헬퍼 등)에서 캡처 실패해도 드래그는 window 이벤트로 처리되므로 무시
                                    }
                                };

                                const onCellClick = (e: React.MouseEvent<HTMLDivElement>) => {
                                    if (isCheckbox) {
                                        e.stopPropagation();
                                        if (!props.rowSelection) return;
                                        props.rowSelection.onToggleRow(rdex);
                                        return;
                                    }
                                    if (selectable || column.render) {
                                        e.stopPropagation();
                                    }
                                };

                                const tdChildren =
                                    isCheckbox && props.rowSelection ? (
                                        <input
                                            type="checkbox"
                                            className="js-grid-chk-box"
                                            checked={props.rowSelection.selectedIds.has(rdex)}
                                            readOnly
                                            style={{ pointerEvents: "none" }}
                                        />
                                    ) : isEditing && column.editor ? (
                                        <div
                                            className="js-grid-cell-inner js-grid-cell-inner--editing"
                                            data-jsgrid-cell-editing="1"
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                display: "flex",
                                                alignItems: "center",
                                                overflow: "visible",
                                            }}
                                        >
                                            {renderGridCellEditor(column.editor, {
                                                row,
                                                value,
                                                columnKey: column.key,
                                                rowIndex: rdex,
                                                onChange: handleEditorChange,
                                                onClose: closeEditor,
                                                stopRowClick,
                                            })}
                                        </div>
                                    ) : (
                                        rendered ?? (formatCellDisplayValue(value) as ReactNode)
                                    );

                                const bodyCellDataAttrs = selectable
                                    ? {
                                          "data-jsgrid-body-cell": "1" as const,
                                          "data-jsgrid-row": String(rdex),
                                          "data-jsgrid-col": column.key,
                                      }
                                    : undefined;

                                const bodyCellClassName = [
                                    gridColClassNames(cdex, column, "td"),
                                    bodyCellStateClassNames({
                                        selectable,
                                        hasEditor,
                                        isSelected,
                                        isEditing,
                                    }),
                                ]
                                    .filter(Boolean)
                                    .join(" ");

                                if (isCheckbox || isRowNum) {
                                    return (
                                        <div
                                            key={colKey}
                                            role="presentation"
                                            className={bodyCellClassName}
                                            onClick={onCellClick}
                                            onPointerDown={onCellPointerDown}
                                            style={tdStyle}
                                        >
                                            {tdChildren}
                                        </div>
                                    );
                                }
                                /** 편집/선택 상태에서는 ResizeObserver 기반 말줄임 측정을 우회한다. */
                                if (isEditing || isSelected) {
                                    return (
                                        <div
                                            key={colKey}
                                            role="presentation"
                                            className={bodyCellClassName}
                                            onClick={onCellClick}
                                            onPointerDown={onCellPointerDown}
                                            style={tdStyle}
                                            {...bodyCellDataAttrs}
                                        >
                                            {tdChildren}
                                        </div>
                                    );
                                }
                                return (
                                    <TruncatingDiv
                                        key={colKey}
                                        className={bodyCellClassName}
                                        onClick={onCellClick}
                                        onPointerDown={onCellPointerDown}
                                        style={tdStyle}
                                        {...bodyCellDataAttrs}
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
                    className="js-grid-empty"
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
                    <span className="js-grid-empty-message">데이터가 없습니다.</span>
                </div>
            ) : null}
        </div>
    );
});

export default JsGridTable;
