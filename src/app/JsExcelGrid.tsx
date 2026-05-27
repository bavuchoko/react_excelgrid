import type {
    Content,
    DataType,
    ExcelGridData,
    GridCellEditEvent,
    GridCellPasteBatch,
    GridType,
    Header,
    HeaderState,
    JsExcelGridHandle,
    JsGridTableColumn,
    JsGridTableHandle,
    JsGridToolbarSlot,
    Sheet,
    SheetCellChangeEvent,
    SheetCellPasteBatch,
    SheetErrorFocusTarget,
} from "./type/Type.ts";
import {useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState} from "react";
import { JsGridToolbarProvider } from "./js-grid/JsGridToolbarContext.tsx";
import {
    JsGridRowSelectionProvider,
    type JsGridRowSelectionApi,
} from "./js-grid/JsGridRowSelectionContext.tsx";
import ColumnFieldsMenu from "./js-grid/ColumnFieldsMenu.tsx";
import {toHeaderState, type UserColumn} from "./js-grid/columnFieldsMenuModel.ts";
import {
    buildColumnLayoutWidths,
    captureColumnLayoutWidths,
    columnsWidthSignature,
    computeLeftOffsets,
    getColumnFreezeStickyStyle,
} from "./js-grid/columnLayout.ts";
import {GRID_BORDER} from "./js-grid/gridStyles.ts";
import JsGridTable from "./js-grid/JsGridTable.tsx";
import JsGridToolbar from "./js-grid/JsGridToolbar.tsx";
import {useColumnWidths} from "./js-grid/useColumnWidths.ts";
import {useFreezeColumns} from "./js-grid/useFreezeColumns.ts";
import SheetTabs from "./js-grid/SheetTabs.tsx";
import SheetErrorBar from "./js-grid/SheetErrorBar.tsx";
import { isCellModifiedFromBaseline } from "./js-grid/cellModified.ts";
import { buildSheetCellErrorLookup } from "./js-grid/sheetErrors.ts";
import { filterChangedPasteBatches, resolveChangeRowId } from "./js-grid/gridCellSelection.ts";
import { areCellValuesEqual } from "./js-grid/cellModified.ts";
import { sortRowsByHeaderWithSourceIndexes } from "./js-grid/sortSheetContent.ts";
import { applySheetCellEdit, applySheetCellsPaste } from "./utils/applySheetCellEdits.ts";
import { applyHeaderLayoutToHeaders } from "./utils/applyHeaderState.ts";

/**
 * 화면·필드 메뉴 모두에서 항상 숨기는 헤더 키 목록.
 * 데이터에는 남아 있어 행 식별(선택·삭제·`rowIdKey`)용으로 그대로 쓸 수 있다.
 */
const ALWAYS_HIDDEN_HEADER_KEYS: ReadonlySet<string> = new Set(["id"]);

function isHiddenHeaderKey(key: string): boolean {
    return ALWAYS_HIDDEN_HEADER_KEYS.has(key);
}

function userColumnsLayoutEqual(a: readonly UserColumn[], b: readonly UserColumn[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((c, i) => {
        const o = b[i]!;
        return c.key === o.key && c.visible === o.visible && c.label === o.label;
    });
}

function headerSaveErrorMessage(err: unknown): string {
    if (err instanceof Error && err.message.trim()) return err.message;
    const o = typeof err === "object" && err !== null ? (err as Record<string, unknown>) : null;
    if (o && "response" in o && typeof o.response === "object" && o.response !== null) {
        const rd = (o.response as Record<string, unknown>).data;
        if (typeof rd === "string" && rd.trim()) return rd;
        if (rd && typeof rd === "object") {
            const m = (rd as Record<string, unknown>).message;
            if (typeof m === "string" && m.trim()) return m;
        }
    }
    return "컬럼 저장에 실패했습니다.";
}

export default function  JsExcelGrid(props: GridType) {
    const [gridData, setGridData] = useState<ExcelGridData>(() => props.data ?? {});
    const gridDataRef = useRef(gridData);
    gridDataRef.current = gridData;
    const baselineBySheetRef = useRef<Record<string, Content[]>>({});
    const [sheetColumnState, setSheetColumnState] = useState<Record<string, {
        userColumns: UserColumn[];
        colWidths: Record<string, number>;
    }>>({});
    const sheetColumnStateRef = useRef(sheetColumnState);
    sheetColumnStateRef.current = sheetColumnState;

    const buildDataWithColumnLayout = useCallback((data: ExcelGridData): ExcelGridData => {
        const layoutBySheet = sheetColumnStateRef.current;
        let out: ExcelGridData | null = null;
        for (const [sheetName, sheet] of Object.entries(data)) {
            const saved = layoutBySheet[sheetName];
            if (!saved?.userColumns?.length) continue;
            const nextHeaders = applyHeaderLayoutToHeaders({
                headers: sheet.headers,
                layout: toHeaderState(saved.userColumns, saved.colWidths),
                pinnedHeaderKeys: ALWAYS_HIDDEN_HEADER_KEYS,
            });
            if (out === null) out = { ...data };
            out[sheetName] = { ...sheet, headers: nextHeaders };
        }
        return out ?? data;
    }, []);

    useImperativeHandle(
        props.ref,
        (): JsExcelGridHandle => ({
            getData: () => gridDataRef.current,
        }),
        [],
    );

    const commitGridData = useCallback(
        (updater: (prev: ExcelGridData) => ExcelGridData) => {
            setGridData((prev) => {
                const next = updater(prev);
                gridDataRef.current = next;
                props.onDataChange?.(buildDataWithColumnLayout(next));
                return next;
            });
        },
        [props.onDataChange, buildDataWithColumnLayout],
    );

    const syncSheetHeaderLayout = useCallback(
        (
            sheetName: string | null,
            columns: UserColumn[],
            widths: Record<string, number>,
        ) => {
            if (!sheetName || columns.length === 0) return;
            const layout = toHeaderState(columns, widths);
            commitGridData((prev) => {
                const sheet = prev[sheetName];
                if (!sheet) return prev;
                const nextHeaders = applyHeaderLayoutToHeaders({
                    headers: sheet.headers,
                    layout,
                    pinnedHeaderKeys: ALWAYS_HIDDEN_HEADER_KEYS,
                });
                const unchanged =
                    sheet.headers.length === nextHeaders.length
                    && sheet.headers.every((h, i) => {
                        const n = nextHeaders[i]!;
                        return (
                            h.key === n.key
                            && Boolean(h.visible ?? true) === Boolean(n.visible ?? true)
                            && (h.width ?? 0) === (n.width ?? 0)
                        );
                    });
                if (unchanged) return prev;
                return { ...prev, [sheetName]: { ...sheet, headers: nextHeaders } };
            });
        },
        [commitGridData],
    );

    useEffect(() => {
        const next = props.data ?? {};
        gridDataRef.current = next;
        setGridData(next);
        baselineBySheetRef.current = {};
    }, [props.data]);

    // 외부 입력은 `Record<sheetName, SheetBody>` 모양이므로, 내부 사용을 위해 배열(`Sheet[]`)로 정규화한다.
    const sheets: Sheet[] = useMemo(() => {
        const map = gridData;
        return Object.entries(map).map(([name, body]) => ({
            name,
            headers: body?.headers ?? [],
            data: body?.data ?? [],
            errors: body?.errors,
        }));
    }, [gridData]);

    const [activeSheetName, setActiveSheetName] = useState<string | null>(null);

    useEffect(() => {
        if (sheets.length === 0) {
            if (activeSheetName !== null) setActiveSheetName(null);
            return;
        }
        const exists = activeSheetName != null && sheets.some((s) => s.name === activeSheetName);
        if (!exists) setActiveSheetName(sheets[0]!.name);
    }, [sheets, activeSheetName]);

    const safeActiveIndex = useMemo(() => {
        if (sheets.length === 0) return 0;
        if (activeSheetName == null) return 0;
        const idx = sheets.findIndex((s) => s.name === activeSheetName);
        return idx >= 0 ? idx : 0;
    }, [sheets, activeSheetName]);

    const activeSheet: Sheet | null = sheets.length > 0 ? (sheets[safeActiveIndex] ?? sheets[0] ?? null) : null;
    const data = activeSheet?.data ?? [];
    const headerList: Header[] = activeSheet?.headers ?? [];
    const activeName = activeSheet?.name ?? null;

    const headerTypeByKey = useMemo(() => {
        const m = new Map<string, DataType>();
        for (const h of headerList) {
            if (h.type != null) m.set(h.key, h.type);
        }
        return m;
    }, [headerList]);

    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');

    const { rows: sortedData, sourceIndexes: sourceRowIndexes } = useMemo(
        () => sortRowsByHeaderWithSourceIndexes(data, sortKey, sortDir, headerTypeByKey),
        [data, sortKey, sortDir, headerTypeByKey],
    );

    const cellErrorLookup = useMemo(
        () => buildSheetCellErrorLookup(activeSheet?.errors),
        [activeSheet?.errors],
    );

    /** 시트별 최초 진입 시 `gridData` 스냅샷 — 편집·붙여넣기와 비교해 수정 셀을 표시. */
    const baselineData = useMemo(() => {
        if (!activeName) return undefined;
        const rows = gridData[activeName]?.data;
        if (!rows) return undefined;
        if (!baselineBySheetRef.current[activeName]) {
            baselineBySheetRef.current[activeName] = structuredClone(rows);
        }
        return baselineBySheetRef.current[activeName];
    }, [activeName, gridData]);

    const dirtyCellsRef = useRef<Set<string>>(new Set());
    const [dirtyRevision, setDirtyRevision] = useState(0);

    const dirtyCellKey = useCallback(
        (sourceRowIndex: number, columnKey: string) =>
            `${activeName ?? ""}\u0000${sourceRowIndex}\u0000${columnKey}`,
        [activeName],
    );

    const markCellDirty = useCallback(
        (sourceRowIndex: number, columnKey: string) => {
            if (!activeName || sourceRowIndex < 0) return;
            const key = dirtyCellKey(sourceRowIndex, columnKey);
            if (dirtyCellsRef.current.has(key)) return;
            dirtyCellsRef.current.add(key);
            setDirtyRevision((v) => v + 1);
        },
        [activeName, dirtyCellKey],
    );

    const isCellModified = useCallback(
        (sourceRowIndex: number, columnKey: string, currentRow: Content) => {
            void dirtyRevision;
            if (!activeName || sourceRowIndex < 0) return false;
            if (dirtyCellsRef.current.has(dirtyCellKey(sourceRowIndex, columnKey))) {
                return true;
            }
            return isCellModifiedFromBaseline(
                baselineData,
                sourceRowIndex,
                columnKey,
                currentRow,
            );
        },
        [activeName, baselineData, dirtyCellKey, dirtyRevision],
    );

    const enablePseudoFullscreen = props.enablePseudoFullscreen !== false;
    const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(
        () => enablePseudoFullscreen && props.fullmode === true,
    );
    const rootRef = useRef<HTMLDivElement | null>(null);
    const gridOverlaySpinClass = useId().replace(/:/g, "");

    const [userColumns, setUserColumns] = useState<UserColumn[]>([]);

    /** 열 구성(키 집합) 변경 시에만 필드 메뉴 state 초기화 — 순서 변경과 분리해 되돌림 방지 */
    const columnKeysSig = useMemo(() => {
        const keys = headerList
            .filter((h) => !isHiddenHeaderKey(h.key))
            .map((h) => h.key);
        return [...new Set(keys)].sort().join("\0");
    }, [headerList]);

    const buildUserColumnsForActiveSheet = useCallback((): UserColumn[] => {
        const candidates = headerList.filter((h) => !isHiddenHeaderKey(h.key));
        const saved = activeName ? sheetColumnStateRef.current[activeName] : undefined;
        if (saved?.userColumns?.length) {
            const savedByKey = new Map(saved.userColumns.map((c) => [c.key, c] as const));
            const candidateByKey = new Map(candidates.map((h) => [h.key, h] as const));
            const orderedKeys: string[] = [];
            for (const s of saved.userColumns) {
                if (candidateByKey.has(s.key)) orderedKeys.push(s.key);
            }
            for (const h of candidates) {
                if (!savedByKey.has(h.key)) orderedKeys.push(h.key);
            }
            return orderedKeys.map((k) => {
                const h = candidateByKey.get(k)!;
                const s = savedByKey.get(k);
                return {
                    key: k,
                    label: String(h.name ?? k),
                    visible: s?.visible ?? (h.visible ?? true),
                };
            });
        }
        return candidates.map((h) => ({
            key: h.key,
            label: String(h.name ?? h.key),
            visible: h.visible ?? true,
        }));
    }, [activeName, headerList]);

    useEffect(() => {
        if (!activeName) return;
        const next = buildUserColumnsForActiveSheet();
        setUserColumns((prev) =>
            userColumnsLayoutEqual(prev, next) ? prev : next,
        );
    }, [activeName, columnKeysSig, buildUserColumnsForActiveSheet]);

    const handleEnterPseudoFullscreen = useCallback(() => {
        setIsPseudoFullscreen(true);
    }, []);

    const handleExitPseudoFullscreen = useCallback(() => {
        if (props.onClose) {
            props.onClose();
            return;
        }
        setIsPseudoFullscreen(false);
    }, [props.onClose]);

    useEffect(() => {
        if (!enablePseudoFullscreen) return;
        if (!isPseudoFullscreen) return;

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleExitPseudoFullscreen();
        };
        window.addEventListener('keydown', onKeyDown);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = prevOverflow;
        };
    }, [enablePseudoFullscreen, isPseudoFullscreen, handleExitPseudoFullscreen]);

    const showRowSelection = props.enableRowSelection === true;

    const headerWidthSig = useMemo(
        () => headerList.map((h) => `${h.key}:${h.width ?? ""}`).join("\u0001"),
        [headerList],
    );
    const persistedColWidths = useMemo(() => {
        const saved = activeName ? sheetColumnState[activeName] : undefined;
        if (saved?.colWidths && Object.keys(saved.colWidths).length > 0) {
            return saved.colWidths;
        }
        const m: Record<string, number> = {};
        for (const h of headerList) {
            if (typeof h.width === "number" && h.width > 0) m[h.key] = Math.round(h.width);
        }
        return m;
    }, [headerWidthSig, activeName, sheetColumnState]);

    const columns = useMemo((): readonly JsGridTableColumn[] => {
        const list = headerList;
        const headerByKey = new Map(list.map((h) => [h.key, h] as const));
        const visible: JsGridTableColumn[] = userColumns
            .filter((c) => c.visible)
            .map((c) => {
                const h = headerByKey.get(c.key);
                return {
                    key: c.key,
                    label: c.label,
                    type: h?.type ?? null,
                    render: h?.render,
                    editor: h?.editor,
                };
            });
        const rowNum: JsGridTableColumn = { key: "__rownum__", label: "#", __rownum__: true };
        const cb: JsGridTableColumn = { key: "__checkbox__", label: "", __checkbox__: true };
        return showRowSelection ? [cb, rowNum, ...visible] : [rowNum, ...visible];
    }, [userColumns, showRowSelection, headerList]);

    const visibleDataColumnKeys = useMemo(() => {
        const keys = new Set<string>();
        for (const col of columns) {
            if (!col.__checkbox__ && !col.__rownum__) keys.add(col.key);
        }
        return keys;
    }, [columns]);

    const [isFieldsMenuOpen, setIsFieldsMenuOpen] = useState(false);
    const [fieldsSaveBusy, setFieldsSaveBusy] = useState(false);
    const [fieldsResetBusy, setFieldsResetBusy] = useState(false);
    const [fieldsSaveError, setFieldsSaveError] = useState<string | null>(null);
    const fieldsActionBusy = fieldsSaveBusy || fieldsResetBusy;
    const fieldsActionBusyRef = useRef(false);
    fieldsActionBusyRef.current = fieldsActionBusy;

    useEffect(() => {
        if (isFieldsMenuOpen) setFieldsSaveError(null);
    }, [isFieldsMenuOpen]);

    const [fieldsMenuPos, setFieldsMenuPos] = useState<{ top: number; right: number } | null>(null);
    const fieldsBtnRef = useRef<HTMLDivElement | null>(null);
    const dragKeyRef = useRef<string | null>(null);

    useEffect(() => {
        if (!isFieldsMenuOpen) return;
        const onDown = (e: MouseEvent) => {
            if (fieldsActionBusyRef.current) return;
            const target = e.target as Node | null;
            if (!target) return;
            if (fieldsBtnRef.current?.contains(target)) return;
            const menuEl = document.querySelector('[data-jsgrid-fields-menu="1"]');
            if (menuEl && menuEl.contains(target)) return;
            setIsFieldsMenuOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (fieldsActionBusyRef.current) return;
                setIsFieldsMenuOpen(false);
            }
        };
        window.addEventListener('mousedown', onDown);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('mousedown', onDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [isFieldsMenuOpen]);

    const { freezeUntilIndex, setFreezeUntilIndex } = useFreezeColumns(columns.length);
    const { headerCellRefs, colWidthByKey, measuredWidthByKey, setColumnWidth } = useColumnWidths(
        columns,
        persistedColWidths,
        headerWidthSig,
    );
    const [frozenLayoutWidths, setFrozenLayoutWidths] = useState<Record<string, number> | null>(
        null,
    );

    const handleFreezeColumn = useCallback(
        (colIndex: number) => {
            if (freezeUntilIndex === colIndex) {
                setFreezeUntilIndex(null);
                setFrozenLayoutWidths(null);
                return;
            }
            setFrozenLayoutWidths(captureColumnLayoutWidths(columns, headerCellRefs));
            setFreezeUntilIndex(colIndex);
        },
        [freezeUntilIndex, columns, headerCellRefs, setFreezeUntilIndex],
    );

    const columnsWidthSig = useMemo(() => columnsWidthSignature(columns), [columns]);
    useEffect(() => {
        setFrozenLayoutWidths(null);
    }, [columnsWidthSig]);

    const applyUserColumnsLayout = useCallback(
        (nextColumns: UserColumn[], widths: Record<string, number> = colWidthByKey) => {
            if (!activeName || nextColumns.length === 0) return;
            setSheetColumnState((prev) => ({
                ...prev,
                [activeName]: { userColumns: nextColumns, colWidths: widths },
            }));
            syncSheetHeaderLayout(activeName, nextColumns, widths);
        },
        [activeName, colWidthByKey, syncSheetHeaderLayout],
    );

    useEffect(() => {
        if (!activeName || userColumns.length === 0) return;
        applyUserColumnsLayout(userColumns, colWidthByKey);
    }, [activeName, userColumns, colWidthByKey, applyUserColumnsLayout]);

    const layoutWidths = useMemo(
        () =>
            freezeUntilIndex != null && frozenLayoutWidths
                ? frozenLayoutWidths
                : buildColumnLayoutWidths(columns, measuredWidthByKey, colWidthByKey),
        [freezeUntilIndex, frozenLayoutWidths, columns, measuredWidthByKey, colWidthByKey],
    );
    const leftOffsets = useMemo(
        () => computeLeftOffsets(columns, layoutWidths),
        [columns, layoutWidths],
    );

    const columnResizable = props.resizable !== false;

    const handleColumnWidthChange = useCallback(
        (columnKey: string, widthPx: number) => {
            setColumnWidth(columnKey, widthPx);
            if (!activeName) return;
            setSheetColumnState((prev) => {
                const sheet = prev[activeName];
                return {
                    ...prev,
                    [activeName]: {
                        userColumns: sheet?.userColumns ?? userColumns,
                        colWidths: { ...(sheet?.colWidths ?? {}), [columnKey]: widthPx },
                    },
                };
            });
        },
        [activeName, setColumnWidth, userColumns],
    );

    const getStickyStyle = useCallback((args: { colIndex: number; isHeader: boolean }) => {
        return getColumnFreezeStickyStyle({
            colIndex: args.colIndex,
            isHeader: args.isHeader,
            freezeUntilIndex,
            leftOffsets,
        });
    }, [freezeUntilIndex, leftOffsets]);

    const [selectedRowIndexes, setSelectedRowIndexes] = useState<Set<number>>(() => new Set());
    const [selectionAnchor, setSelectionAnchor] = useState(() => ({
        show: showRowSelection,
    }));

    /** 행 수가 줄거나 늘면(삭제·업로드 등) 인덱스 기준 선택은 다음 행에 밀려 잘못 유지되므로 비운다. */
    const prevSortedLenRef = useRef<number | null>(null);
    useEffect(() => {
        const len = sortedData.length;
        const prev = prevSortedLenRef.current;
        prevSortedLenRef.current = len;
        if (prev !== null && prev !== len) {
            setSelectedRowIndexes(new Set());
        }
    }, [sortedData.length]);

    const pageRowIds = useMemo(() => sortedData.map((_, idx) => idx), [sortedData]);

    const headerChecked =
        pageRowIds.length > 0 && pageRowIds.every((id) => selectedRowIndexes.has(id));

    const toggleSelectAll = useCallback(() => {
        setSelectedRowIndexes((prev) => {
            const next = new Set(prev);
            const allOn = pageRowIds.length > 0 && pageRowIds.every((id) => next.has(id));
            if (allOn) {
                for (const id of pageRowIds) next.delete(id);
            } else {
                for (const id of pageRowIds) next.add(id);
            }
            return next;
        });
    }, [pageRowIds]);

    const toggleSelectRow = useCallback((id: number) => {
        setSelectedRowIndexes((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedRowIndexes(new Set());
    }, []);

    if (selectionAnchor.show !== showRowSelection) {
        setSelectionAnchor({ show: showRowSelection });
        setSelectedRowIndexes(new Set());
    }

    // 시트 전환 시 정렬/선택을 초기화
    const prevSheetIndexRef = useRef<number | null>(null);
    if (prevSheetIndexRef.current !== safeActiveIndex) {
        prevSheetIndexRef.current = safeActiveIndex;
        setSelectedRowIndexes(new Set());
        setSortKey(null);
        setSortDir('ASC');
    }

    const selectedRows = useMemo(() => {
        const rows: unknown[] = [];
        const indexes = Array.from(selectedRowIndexes).sort((a, b) => a - b);
        for (const idx of indexes) {
            const row = sortedData[idx];
            if (row !== undefined) rows.push(row);
        }
        return rows;
    }, [selectedRowIndexes, sortedData]);

    const rowSelectionApi = useMemo((): JsGridRowSelectionApi | null => {
        if (!showRowSelection) return null;
        return {
            selectedCount: selectedRows.length,
            selectedRows,
            disabled: selectedRows.length === 0,
            clearSelection,
        };
    }, [showRowSelection, selectedRows, clearSelection]);

    const rowSelection = useMemo(() => {
        if (!showRowSelection) return undefined;
        return {
            pageRowIds,
            selectedIds: selectedRowIndexes,
            headerChecked,
            onToggleAll: toggleSelectAll,
            onToggleRow: toggleSelectRow,
        };
    }, [showRowSelection, pageRowIds, selectedRowIndexes, headerChecked, toggleSelectAll, toggleSelectRow]);

    const headerSaveEnabled = props.enableHeaderSave === true && Boolean(props.onHeaderSave);
    const fieldsBusyLabel = headerSaveEnabled
        ? fieldsSaveBusy
            ? "저장 중..."
            : fieldsResetBusy
              ? "초기화 중..."
              : undefined
        : undefined;

    const [toolbarOverlay, setToolbarOverlay] = useState<{ label: string; accent: string } | null>(null);

    const runToolbarAction = useCallback(
        async (
            label: string,
            action: () => void | Promise<void>,
            accent = "#2563eb",
        ) => {
            setToolbarOverlay({ label, accent });
            await new Promise<void>((resolve) => {
                requestAnimationFrame(() => resolve());
            });
            try {
                await Promise.resolve(action());
            } finally {
                setToolbarOverlay(null);
            }
        },
        [],
    );

    const setBodyOverlay = useCallback(
        (overlay: { label: string; accent?: string } | null) => {
            setToolbarOverlay(
                overlay ? { label: overlay.label, accent: overlay.accent ?? "#2563eb" } : null,
            );
        },
        [],
    );

    const toolbarApi = useMemo(
        () => ({ runToolbarAction, setBodyOverlay }),
        [runToolbarAction, setBodyOverlay],
    );

    const renderToolbarSlot = useCallback(
        (slot?: JsGridToolbarSlot) => {
            if (slot == null) return undefined;
            return typeof slot === "function" ? slot(toolbarApi) : slot;
        },
        [toolbarApi],
    );

    const rowIdKey = props.rowIdKey ?? "id";

    const tableCellChange = useCallback(
        (event: GridCellEditEvent) => {
            if (!activeName) return;
            if (areCellValuesEqual(event.previousValue, event.value)) return;
            if (event.sourceRowIndex >= 0) {
                markCellDirty(event.sourceRowIndex, event.columnKey);
            }
            const rowId = resolveChangeRowId(event.row, event.sourceRowIndex, rowIdKey);
            const rowIds = rowId != null ? [rowId] : [];
            commitGridData((prev) => applySheetCellEdit(prev, activeName, event));
            if (rowIds.length === 0) return;
            const sheetEvent: SheetCellChangeEvent = {
                kind: "edit",
                sheetName: activeName,
                columnKey: event.columnKey,
                value: event.value,
                rowIds,
                previousValue: event.previousValue,
            };
            void Promise.resolve(props.onCellChange?.(sheetEvent));
        },
        [props.onCellChange, activeName, markCellDirty, rowIdKey, commitGridData],
    );

    const tableCellsPaste = useCallback(
        (batches: GridCellPasteBatch[]) => {
            if (!activeName) return;
            const changedBatches = filterChangedPasteBatches(batches);
            if (changedBatches.length === 0) return;
            for (const batch of changedBatches) {
                for (const it of batch.items) {
                    if (it.sourceRowIndex >= 0) {
                        markCellDirty(it.sourceRowIndex, it.columnKey);
                    }
                }
            }
            const sheetBatches: SheetCellPasteBatch[] = changedBatches.map((b) => ({
                ...b,
                sheetName: activeName,
                items: b.items.map((it) => ({ ...it, sheetName: activeName })),
            }));
            commitGridData((prev) => applySheetCellsPaste(prev, sheetBatches));
            for (const batch of sheetBatches) {
                if (batch.rowIds.length === 0) continue;
                const pasteEvent: SheetCellChangeEvent = {
                    kind: "paste",
                    sheetName: activeName,
                    columnKey: batch.columnKey,
                    value: batch.value,
                    rowIds: batch.rowIds,
                };
                void Promise.resolve(props.onCellChange?.(pasteEvent));
            }
            void Promise.resolve(props.onCellsPaste?.(sheetBatches));
        },
        [props.onCellChange, props.onCellsPaste, activeName, markCellDirty, commitGridData],
    );

    /** 시트 에러 바에서 셀로 점프하기 위한 명령형 ref. */
    const tableRef = useRef<JsGridTableHandle | null>(null);

    /**
     * `SheetErrorBar` 가 보내는 `{columnName, rowIndex}` 를 그리드 좌표로 변환한다.
     *
     * - 컬럼: `headerList` 에서 `name` 으로 찾은 뒤 `key` 를 그리드에 전달.
     *   숨김 처리되어 보이는 컬럼이 아닐 수도 있는데, 그때는 행만 스크롤한다.
     * - 행: 서버 `errors` 의 `rowIndex` 는 정렬 전 `data` 기준(0-based).
     *   `sourceRowIndexes` 로 표시 행 번호를 찾는다.
     */
    const handleSheetErrorFocus = useCallback(
        (target: SheetErrorFocusTarget) => {
            const rawRow = target.rowIndex;
            if (!Number.isFinite(rawRow) || rawRow < 0) return;

            const resolveDisplayRow = (sourceRowIndex: number): number => {
                let displayRowIndex = sourceRowIndexes.indexOf(sourceRowIndex);
                if (displayRowIndex >= 0) return displayRowIndex;
                const sourceRow = data[sourceRowIndex];
                if (sourceRow !== undefined) {
                    displayRowIndex = sortedData.indexOf(sourceRow);
                    if (displayRowIndex >= 0) return displayRowIndex;
                }
                return -1;
            };

            let displayRowIndex = resolveDisplayRow(rawRow);
            /** 서버가 1-based 행 번호를 줄 때(표시 행과 같으면 0-based 로 재시도). */
            if (displayRowIndex < 0 && rawRow >= 1 && rawRow <= data.length) {
                displayRowIndex = resolveDisplayRow(rawRow - 1);
            }
            if (displayRowIndex < 0) return;

            const columnName = String(target.columnName ?? "").trim();
            const header =
                headerList.find((h) => h.name === target.columnName)
                ?? headerList.find((h) => String(h.name ?? "").trim() === columnName)
                ?? headerList.find((h) => h.key === target.columnName)
                ?? headerList.find((h) => String(h.key ?? "").trim() === columnName);
            const columnKey =
                header?.key && visibleDataColumnKeys.has(header.key)
                    ? header.key
                    : undefined;

            tableRef.current?.focusCell({
                rowIndex: displayRowIndex,
                columnKey,
            });
        },
        [data, sortedData, headerList, sourceRowIndexes, visibleDataColumnKeys],
    );

    const toolbarStartNode = useMemo(
        () => renderToolbarSlot(props.toolbarStart),
        [props.toolbarStart, renderToolbarSlot],
    );
    const toolbarEndNode = useMemo(
        () => renderToolbarSlot(props.toolbarEnd),
        [props.toolbarEnd, renderToolbarSlot],
    );

    const gridBodyOverlay = useMemo(() => {
        if (toolbarOverlay) return toolbarOverlay;
        if (headerSaveEnabled && fieldsSaveBusy) return { label: "저장 중...", accent: "#2563eb" };
        if (headerSaveEnabled && fieldsResetBusy) return { label: "초기화 중...", accent: "#2563eb" };
        return null;
    }, [toolbarOverlay, headerSaveEnabled, fieldsSaveBusy, fieldsResetBusy]);
    const gridBodyBusy = gridBodyOverlay != null;

    return (
        <JsGridToolbarProvider value={toolbarApi}>
            <JsGridRowSelectionProvider value={rowSelectionApi}>
                <div
                    ref={rootRef}
                    className="js-grid-container"
                    style={{
                        border: `1px solid ${GRID_BORDER}`,
                        width: '100%',
                        flex: '1 1 auto',
                        alignSelf: 'stretch',
                        maxHeight: '100%',
                        overflow: 'hidden',
                        backgroundColor: '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        boxSizing: 'border-box',
                        minHeight: 0,
                        ...(props.style ?? {}),
                        ...(isPseudoFullscreen
                            ? {
                                width: '100vw',
                                height: '100vh',
                                maxHeight: undefined,
                                position: 'fixed' as const,
                                inset: 0,
                                zIndex: 9999,
                                boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                            }
                            : null),
                    }}
                >
                    <style>{`
                        @keyframes jsgrid-body-overlay-spin-${gridOverlaySpinClass} {
                            to { transform: rotate(360deg); }
                        }
                        .jsgrid-body-overlay-spin-dot-${gridOverlaySpinClass} {
                            animation: jsgrid-body-overlay-spin-${gridOverlaySpinClass} 0.75s linear infinite;
                        }
                    `}</style>
                    <JsGridToolbar
                        fieldsBtnRef={fieldsBtnRef}
                        showColumnFieldsMenu
                        isPseudoFullscreen={isPseudoFullscreen}
                        enablePseudoFullscreen={enablePseudoFullscreen}
                        fieldsBusy={headerSaveEnabled ? fieldsActionBusy : undefined}
                        fieldsBusyLabel={fieldsBusyLabel}
                        onToggleFieldsMenu={(e) => {
                            e.stopPropagation();
                            if (headerSaveEnabled && fieldsActionBusy) return;
                            const rect = fieldsBtnRef.current?.getBoundingClientRect();
                            if (rect) {
                                setFieldsMenuPos({
                                    top: rect.bottom + 8,
                                    right: window.innerWidth - rect.right,
                                });
                            }
                            setIsFieldsMenuOpen(v => !v);
                        }}
                        onEnterPseudoFullscreen={handleEnterPseudoFullscreen}
                        onExitPseudoFullscreen={handleExitPseudoFullscreen}
                        toolbarStart={toolbarStartNode}
                        toolbarEnd={toolbarEndNode}
                    />

                    <div
                        style={{
                            flex: 1,
                            minHeight: 0,
                            display: "flex",
                            flexDirection: "column",
                            position: "relative",
                        }}
                    >
                        <SheetTabs
                            sheets={sheets}
                            activeIndex={safeActiveIndex}
                            onChange={(idx) => {
                                if (fieldsActionBusy) return;
                                const nextSheet = sheets[idx];
                                if (!nextSheet) return;

                                if (activeName) {
                                    setSheetColumnState((prev) => ({
                                        ...prev,
                                        [activeName]: {
                                            userColumns,
                                            colWidths: colWidthByKey,
                                        },
                                    }));
                                }
                                setActiveSheetName(nextSheet.name);
                            }}
                        />

                        <ColumnFieldsMenu
                            open={isFieldsMenuOpen}
                            pos={fieldsMenuPos}
                            userColumns={userColumns}
                            dragKeyRef={dragKeyRef}
                            showSaveActions={headerSaveEnabled}
                            saveBusy={fieldsSaveBusy}
                            resetBusy={fieldsResetBusy}
                            saveError={fieldsSaveError}
                            onReorder={(fromKey, toKey) => {
                                setUserColumns((prev) => {
                                    const fromIdx = prev.findIndex(x => x.key === fromKey);
                                    const toIdx = prev.findIndex(x => x.key === toKey);
                                    if (fromIdx < 0 || toIdx < 0) return prev;
                                    const next = [...prev];
                                    const [moved] = next.splice(fromIdx, 1);
                                    next.splice(toIdx, 0, moved);
                                    applyUserColumnsLayout(next);
                                    return next;
                                });
                            }}
                            onToggleVisible={(key, visible) => {
                                setUserColumns((prev) => {
                                    const next = prev.map(x => x.key === key ? { ...x, visible } : x);
                                    applyUserColumnsLayout(next);
                                    return next;
                                });
                            }}
                            onReset={
                                headerSaveEnabled
                                    ? async () => {
                                        setFieldsSaveError(null);
                                        setFieldsResetBusy(true);
                                        await new Promise<void>((resolve) => {
                                            requestAnimationFrame(() => resolve());
                                        });
                                        try {
                                            if (activeName) {
                                                setSheetColumnState((prev) => {
                                                    const next = { ...prev };
                                                    delete next[activeName];
                                                    return next;
                                                });
                                            }
                                            setUserColumns(
                                                headerList
                                                    .filter((c) => !isHiddenHeaderKey(c.key))
                                                    .map((c) => ({
                                                        key: c.key,
                                                        label: String(c.name ?? c.key),
                                                        visible: true,
                                                    })),
                                            );
                                            if (props.onHeaderReset) {
                                                await Promise.resolve(props.onHeaderReset());
                                            }
                                        } finally {
                                            setFieldsResetBusy(false);
                                        }
                                    }
                                    : undefined
                            }
                            onSave={
                                headerSaveEnabled
                                    ? async () => {
                                const payload: HeaderState[] = toHeaderState(userColumns, colWidthByKey);
                                if (!props.onHeaderSave || !activeName) {
                                    setIsFieldsMenuOpen(false);
                                    return;
                                }
                                setFieldsSaveError(null);
                                setFieldsSaveBusy(true);
                                try {
                                    setSheetColumnState((prev) => ({
                                        ...prev,
                                        [activeName]: {
                                            userColumns,
                                            colWidths: colWidthByKey,
                                        },
                                    }));
                                    await props.onHeaderSave({
                                        sheetName: activeName,
                                        headers: payload,
                                    });
                                    setIsFieldsMenuOpen(false);
                                } catch (err) {
                                    setFieldsSaveError(headerSaveErrorMessage(err));
                                } finally {
                                    setFieldsSaveBusy(false);
                                }
                            }
                                    : undefined
                            }
                        />

                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                flex: "1 1 0%",
                                minHeight: 0,
                                minWidth: 0,
                                width: "100%",
                                filter: gridBodyBusy ? "blur(2px)" : undefined,
                                pointerEvents: gridBodyBusy ? "none" : undefined,
                                transition: "filter 120ms ease",
                            }}
                        >
                            {sheets.length === 0 ? (
                                <div
                                    role="status"
                                    aria-live="polite"
                                    style={{
                                        flex: 1,
                                        minHeight: 0,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#64748b",
                                        fontSize: 13,
                                        backgroundColor: "#ffffff",
                                    }}
                                >
                                    데이터가 없습니다.
                                </div>
                            ) : (
                                <JsGridTable
                                    ref={tableRef}
                                    columns={columns}
                                    data={sortedData}
                                    sourceRowIndexes={sourceRowIndexes}
                                    cellErrorLookup={cellErrorLookup}
                                    isCellModified={isCellModified}
                                    sortKey={sortKey}
                                    sortDir={sortDir}
                                    headerCellRefs={headerCellRefs}
                                    colWidthByKey={colWidthByKey}
                                    columnResizable={columnResizable}
                                    onColumnWidthChange={
                                        columnResizable ? handleColumnWidthChange : undefined
                                    }
                                    onFreezeColumn={handleFreezeColumn}
                                    getStickyStyle={getStickyStyle}
                                    rowSelection={rowSelection}
                                    editable={props.editable === true}
                                    rowIdKey={props.rowIdKey}
                                    onCellChange={props.editable === true ? tableCellChange : undefined}
                                    onCellsPaste={props.editable === true ? tableCellsPaste : undefined}
                                    onSortChange={(next) => {
                                        setSortKey(next.key);
                                        setSortDir(next.direction);
                                    }}
                                />
                            )}
                        </div>

                        {sheets.length > 0 ? (
                            <SheetErrorBar
                                key={activeName ?? ""}
                                errors={activeSheet?.errors}
                                sheetName={activeName}
                                onFocusCell={handleSheetErrorFocus}
                            />
                        ) : null}

                        {gridBodyOverlay ? (
                            <div
                                role="status"
                                aria-live="polite"
                                aria-busy
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: "rgba(255,255,255,0.35)",
                                    zIndex: 3,
                                    pointerEvents: "none",
                                }}
                            >
                                <div
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 10,
                                        padding: "10px 14px",
                                        borderRadius: 8,
                                        background: "rgba(255,255,255,0.9)",
                                        border: "1px solid #d1d5db",
                                        color: "#111827",
                                        fontSize: 13,
                                        fontWeight: 600,
                                    }}
                                >
                                    <span
                                        className={`jsgrid-body-overlay-spin-dot-${gridOverlaySpinClass}`}
                                        style={{
                                            width: 16,
                                            height: 16,
                                            borderRadius: "50%",
                                            border: "2px solid #e5e7eb",
                                            borderTopColor: gridBodyOverlay.accent,
                                            boxSizing: "border-box",
                                        }}
                                        aria-hidden
                                    />
                                    {gridBodyOverlay.label}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            </JsGridRowSelectionProvider>
        </JsGridToolbarProvider>
    );
}
