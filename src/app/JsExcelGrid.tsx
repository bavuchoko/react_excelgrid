import type {DataType, GridType, Header, HeaderState, JsGridTableColumn, Sheet} from "./type/Type.ts";
import {useCallback, useEffect, useId, useMemo, useRef, useState} from "react";
import ColumnFieldsMenu from "./js-grid/ColumnFieldsMenu.tsx";
import {toHeaderState, type UserColumn} from "./js-grid/columnFieldsMenuModel.ts";
import {computeLeftOffsets, getColumnFreezeStickyStyle} from "./js-grid/columnLayout.ts";
import {GRID_BORDER} from "./js-grid/gridStyles.ts";
import JsGridTable from "./js-grid/JsGridTable.tsx";
import JsGridToolbar from "./js-grid/JsGridToolbar.tsx";
import { DEFAULT_EXCEL_UPLOAD_ACCEPT } from "./js-grid/excelUploadConstraints.ts";
import UploadFilePanel from "./js-grid/UploadFilePanel.tsx";
import {useColumnWidths} from "./js-grid/useColumnWidths.ts";
import {useFreezeColumns} from "./js-grid/useFreezeColumns.ts";
import SheetTabs from "./js-grid/SheetTabs.tsx";
import { sortRowsByHeader } from "./js-grid/sortSheetContent.ts";

export default function JsExcelGrid(props: GridType) {
    const sheets = props.data?.sheets ?? [];
    const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
    const [sheetColumnState, setSheetColumnState] = useState<Record<string, {
        userColumns: UserColumn[];
        colWidths: Record<string, number>;
    }>>({});

    // sheets 변경 시 기본 active sheet를 첫번째로 보정
    useEffect(() => {
        if (sheets.length === 0) {
            if (activeSheetId !== null) setActiveSheetId(null);
            return;
        }
        const exists = activeSheetId != null && sheets.some((s) => s.id === activeSheetId);
        if (!exists) setActiveSheetId(sheets[0]!.id);
    }, [sheets, activeSheetId]);

    const safeActiveIndex = useMemo(() => {
        if (sheets.length === 0) return 0;
        if (activeSheetId == null) return 0;
        const idx = sheets.findIndex((s) => s.id === activeSheetId);
        return idx >= 0 ? idx : 0;
    }, [sheets, activeSheetId]);

    const activeSheet: Sheet | null = sheets.length > 0 ? (sheets[safeActiveIndex] ?? sheets[0] ?? null) : null;
    const data = activeSheet?.content ?? [];
    const headerList: Header[] = activeSheet?.header ?? [];
    const activeId = activeSheet?.id ?? null;

    const headerTypeByKey = useMemo(() => {
        const m = new Map<string, DataType>();
        for (const h of headerList) {
            m.set(h.key, h.type);
        }
        return m;
    }, [headerList]);

    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');

    const sortedData = useMemo(
        () => sortRowsByHeader(data, sortKey, sortDir, headerTypeByKey),
        [data, sortKey, sortDir, headerTypeByKey],
    );

    const enablePseudoFullscreen = props.enablePseudoFullscreen !== false;
    const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    const [userColumns, setUserColumns] = useState<UserColumn[]>([]);

    const keysSig = useMemo(
        () => headerList.map((h) => h.key).join('\u0001'),
        [headerList],
    );
    // 시트/헤더가 바뀌면, 해당 시트의 저장된 컬럼 설정이 있으면 복원하고 없으면 기본값(모두 visible)로 만든다.
    useEffect(() => {
        if (!activeId) return;
        const saved = sheetColumnState[activeId];
        if (saved?.userColumns?.length) {
            // 현재 headerList에 존재하는 key만 유지 + 신규 key는 visible true로 추가
            const savedByKey = new Map(saved.userColumns.map((c) => [c.key, c] as const));
            const next: UserColumn[] = headerList.map((h) => {
                const k = h.key;
                const s = savedByKey.get(k);
                return {
                    key: k,
                    label: String(h.label ?? k),
                    visible: s?.visible ?? true,
                };
            });
            setUserColumns(next);
        } else {
            setUserColumns(
                headerList.map((h) => ({
                    key: h.key,
                    label: String(h.label ?? h.key),
                    visible: true,
                })),
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeId, keysSig]);

    useEffect(() => {
        if (!enablePseudoFullscreen) return;
        if (!isPseudoFullscreen) return;

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsPseudoFullscreen(false);
        };
        window.addEventListener('keydown', onKeyDown);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = prevOverflow;
        };
    }, [enablePseudoFullscreen, isPseudoFullscreen]);

    const showDelete = Boolean(props.onDeleteClick);

    const headerWidthSig = useMemo(
        () => headerList.map((h) => `${h.key}:${h.width ?? ""}`).join("\u0001"),
        [headerList],
    );
    const persistedColWidths = useMemo(() => {
        const saved = activeId ? sheetColumnState[activeId] : undefined;
        if (saved?.colWidths && Object.keys(saved.colWidths).length > 0) {
            return saved.colWidths;
        }
        const m: Record<string, number> = {};
        for (const h of headerList) {
            if (typeof h.width === "number" && h.width > 0) m[h.key] = Math.round(h.width);
        }
        return m;
    }, [headerWidthSig, activeId, sheetColumnState]);

    const columns = useMemo((): readonly JsGridTableColumn[] => {
        const list = headerList;
        const headerByKey = new Map(list.map((h) => [h.key, h] as const));
        const visible = userColumns
            .filter((c) => c.visible)
            .map((c) => {
                const h = headerByKey.get(c.key);
                return { key: c.key, label: c.label, render: h?.render };
            });
        const rowNum = { key: "__rownum__", label: "#", __rownum__: true as const };
        const cb = { key: "__checkbox__", label: "", __checkbox__: true as const };
        return showDelete ? [cb, rowNum, ...visible] : [rowNum, ...visible];
    }, [userColumns, showDelete, headerList]);

    const [isFieldsMenuOpen, setIsFieldsMenuOpen] = useState(false);
    const [fieldsMenuPos, setFieldsMenuPos] = useState<{ top: number; right: number } | null>(null);
    const fieldsBtnRef = useRef<HTMLDivElement | null>(null);
    const uploadBtnRef = useRef<HTMLDivElement | null>(null);
    const dragKeyRef = useRef<string | null>(null);

    const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(false);
    const [uploadPanelPos, setUploadPanelPos] = useState<{ top: number; right: number } | null>(null);
    const [uploadPanelBusy, setUploadPanelBusy] = useState(false);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const deleteSpinClass = useId().replace(/:/g, "");

    const toggleUploadPanel = useCallback((e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        if (uploadPanelBusy || deleteBusy) return;
        setIsFieldsMenuOpen(false);
        const rect = uploadBtnRef.current?.getBoundingClientRect();
        if (rect) {
            setUploadPanelPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
        }
        setIsUploadPanelOpen((v) => !v);
    }, [uploadPanelBusy, deleteBusy]);

    const handleUploadConfirm = useCallback(
        (files: File[]) => Promise.resolve(props.onUploadFiles?.(files)),
        [props.onUploadFiles],
    );

    useEffect(() => {
        if (!isFieldsMenuOpen) return;
        const onDown = (e: MouseEvent) => {
            const target = e.target as Node | null;
            if (!target) return;
            if (fieldsBtnRef.current?.contains(target)) return;
            const menuEl = document.querySelector('[data-jsgrid-fields-menu="1"]');
            if (menuEl && menuEl.contains(target)) return;
            setIsFieldsMenuOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsFieldsMenuOpen(false);
        };
        window.addEventListener('mousedown', onDown);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('mousedown', onDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [isFieldsMenuOpen]);

    useEffect(() => {
        if (!isUploadPanelOpen) return;
        const onDown = (e: MouseEvent) => {
            if (uploadPanelBusy) return;

            const target = e.target as Node | null;
            if (!target) return;

            if (uploadBtnRef.current?.contains(target)) return;
            const panelEl = document.querySelector('[data-jsgrid-upload-panel="1"]');
            if (panelEl && panelEl.contains(target)) return;
            setIsUploadPanelOpen(false);
        };

        const onKey = (e: KeyboardEvent) => {
            if (uploadPanelBusy) return;
            if (e.key === "Escape") setIsUploadPanelOpen(false);
        };

        window.addEventListener("mousedown", onDown);
        window.addEventListener("keydown", onKey);

        return () => {
            window.removeEventListener("mousedown", onDown);
            window.removeEventListener("keydown", onKey);
        };

    }, [isUploadPanelOpen, uploadPanelBusy]);

    const { freezeUntilIndex, setFreezeUntilIndex } = useFreezeColumns(columns.length);
    const { headerCellRefs, colWidthByKey, measuredWidthByKey, setColumnWidth } = useColumnWidths(
        columns,
        persistedColWidths,
        headerWidthSig,
    );

    const leftOffsets = useMemo(() => computeLeftOffsets(columns, measuredWidthByKey), [columns, measuredWidthByKey]);

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
        show: Boolean(props.onDeleteClick),
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

    const pageRowIds = useMemo(() => {
        // 선택은 `row.id`가 없어도 동작해야 하므로, 현재 페이지의 행 인덱스를 키로 사용한다.
        return sortedData.map((_, idx) => idx);
    }, [sortedData]);

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

    if (selectionAnchor.show !== showDelete) {
        setSelectionAnchor({ show: showDelete });
        setSelectedRowIndexes(new Set());
    }

    // 시트 전환 시 정렬/선택을 초기화 (기본 요구사항: content 전환)
    const prevSheetIndexRef = useRef<number | null>(null);
    if (prevSheetIndexRef.current !== safeActiveIndex) {
        prevSheetIndexRef.current = safeActiveIndex;
        setSelectedRowIndexes(new Set());
        setSortKey(null);
        setSortDir('ASC');
    }

    const rowSelection = useMemo(() => {
        if (!showDelete || deleteBusy) return undefined;
        return {
            pageRowIds,
            selectedIds: selectedRowIndexes,
            headerChecked,
            onToggleAll: toggleSelectAll,
            onToggleRow: toggleSelectRow,
        };
    }, [showDelete, deleteBusy, pageRowIds, selectedRowIndexes, headerChecked, toggleSelectAll, toggleSelectRow]);

    const handleDeleteClick = useCallback(async () => {
        if (!props.onDeleteClick || deleteBusy) return;
        const selectedRows = Array.from(selectedRowIndexes)
            .sort((a, b) => a - b)
            .map((i) => sortedData[i])
            .filter((v) => v !== undefined);
        if (selectedRows.length === 0) return;
        setDeleteBusy(true);
        setIsFieldsMenuOpen(false);
        setIsUploadPanelOpen(false);
        try {
            await Promise.resolve(props.onDeleteClick(selectedRows));
        } finally {
            setDeleteBusy(false);
        }
    }, [props.onDeleteClick, deleteBusy, selectedRowIndexes, sortedData]);

    return (
            <div
                ref={rootRef}
                style={{
                    border: `1px solid ${GRID_BORDER}`,
                    width: '100%',
                    // 부모가 고정 height를 가질 때는 maxHeight:100%로 "부모 안"에 맞추고,
                    // 내부 테이블 영역(JsGridTable wrapper)이 flex:1 + overflow:auto로 스크롤을 담당한다.
                    // flex 레이아웃(부모가 display:flex)에서도 부모 높이를 따라가도록 한다.
                    flex: '1 1 auto',
                    alignSelf: 'stretch',
                    maxHeight: '100%',
                    overflow: 'hidden',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
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
                <JsGridToolbar
                    fieldsBtnRef={fieldsBtnRef}
                    isPseudoFullscreen={isPseudoFullscreen}
                    enablePseudoFullscreen={enablePseudoFullscreen}
                    onDownLoadClick={props.onDownloadClick}
                    uploadBtnRef={props.onUploadFiles ? uploadBtnRef : undefined}
                    onToggleUploadPanel={props.onUploadFiles ? toggleUploadPanel : undefined}
                    uploadBusy={props.onUploadFiles ? uploadPanelBusy : undefined}
                    deleteBusy={props.onDeleteClick ? deleteBusy : undefined}
                    onTrashClick={props.onDeleteClick ? handleDeleteClick : undefined}
                    trashDisabled={selectedRowIndexes.size === 0 || deleteBusy}
                    onToggleFieldsMenu={(e) => {
                        e.stopPropagation();
                        if (uploadPanelBusy || deleteBusy) return;
                        setIsUploadPanelOpen(false);
                        const rect = fieldsBtnRef.current?.getBoundingClientRect();
                        if (rect) {
                            setFieldsMenuPos({
                                top: rect.bottom + 8,
                                right: window.innerWidth - rect.right,
                            });
                        }
                        setIsFieldsMenuOpen(v => !v);
                    }}
                    onTogglePseudoFullscreen={() => setIsPseudoFullscreen(v => !v)}
                />

                {props.onUploadFiles ? (
                    <UploadFilePanel
                        open={isUploadPanelOpen}
                        pos={uploadPanelPos}
                        accept={props.uploadAccept ?? DEFAULT_EXCEL_UPLOAD_ACCEPT}
                        multiple={props.uploadMultiple ?? false}
                        onBusyChange={setUploadPanelBusy}
                        onUploadConfirm={handleUploadConfirm}
                        onClose={() => setIsUploadPanelOpen(false)}
                    />
                ) : null}

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
                        if (uploadPanelBusy || deleteBusy) return;
                        const nextSheet = sheets[idx];
                        if (!nextSheet) return;
                        setIsUploadPanelOpen(false);

                        // 시트 전환 전에 현재 시트의 "진행중 설정"을 저장
                        if (activeId) {
                            setSheetColumnState((prev) => ({
                                ...prev,
                                [activeId]: {
                                    userColumns,
                                    colWidths: colWidthByKey,
                                },
                            }));
                        }
                        setActiveSheetId(nextSheet.id);
                    }}
                />

                <ColumnFieldsMenu
                    open={isFieldsMenuOpen}
                    pos={fieldsMenuPos}
                    userColumns={userColumns}
                    dragKeyRef={dragKeyRef}
                    onReorder={(fromKey, toKey) => {
                        setUserColumns((prev) => {
                            const fromIdx = prev.findIndex(x => x.key === fromKey);
                            const toIdx = prev.findIndex(x => x.key === toKey);
                            if (fromIdx < 0 || toIdx < 0) return prev;
                            const next = [...prev];
                            const [moved] = next.splice(fromIdx, 1);
                            next.splice(toIdx, 0, moved);
                            return next;
                        });
                    }}
                    onToggleVisible={(key, visible) => {
                        setUserColumns((prev) => prev.map(x => x.key === key ? { ...x, visible } : x));
                    }}
                    onReset={() => {
                        // 현재 시트 설정만 초기화
                        if (activeId) {
                            setSheetColumnState((prev) => {
                                const next = { ...prev };
                                delete next[activeId];
                                return next;
                            });
                        }
                        setUserColumns(
                            headerList.map((c) => ({
                                key: c.key,
                                label: String(c.label ?? c.key),
                                visible: true,
                            })),
                        );
                        props.onHeaderReset?.();
                    }}
                    onSave={() => {
                        const payload: HeaderState[] = toHeaderState(userColumns, colWidthByKey);
                        if (activeId) {
                            setSheetColumnState((prev) => ({
                                ...prev,
                                [activeId]: {
                                    userColumns,
                                    colWidths: colWidthByKey,
                                },
                            }));
                            // 패키지는 API를 호출하지 않는다. 사용처가 저장 후 data를 갱신해 내려주면 된다.
                            Promise
                                .resolve(props.onHeaderSave?.({
                                    sheetId: activeId,
                                    sheetName: activeSheet?.name,
                                    headers: payload,
                                }))
                                .catch(() => {
                                    // 사용처에서 실패 처리(UI)를 할 수 있게 여기선 무시
                                });
                        }
                        setIsFieldsMenuOpen(false);
                    }}
                />

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
                        columns={columns}
                        data={sortedData}
                        sortKey={sortKey}
                        sortDir={sortDir}
                        headerCellRefs={headerCellRefs}
                        colWidthByKey={colWidthByKey}
                        onColumnWidthChange={setColumnWidth}
                        setFreezeUntilIndex={setFreezeUntilIndex}
                        getStickyStyle={getStickyStyle}
                        rowSelection={rowSelection}
                        onRowClick={props.onRowClick}
                        onSortChange={(next) => {
                            setSortKey(next.key);
                            setSortDir(next.direction);
                        }}
                    />
                )}

                {deleteBusy ? (
                    <div
                        role="status"
                        aria-live="polite"
                        aria-busy
                        aria-label="삭제 중"
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
                                className={`jsgrid-delete-spin-dot-${deleteSpinClass}`}
                                style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: "50%",
                                    border: "2px solid #e5e7eb",
                                    borderTopColor: "#ef4444",
                                    boxSizing: "border-box",
                                }}
                                aria-hidden
                            />
                            삭제 중...

                            <style>{`
                                @keyframes jsgrid-delete-spin-${deleteSpinClass} {
                                    to { transform: rotate(360deg); }
                                }
                                .jsgrid-delete-spin-dot-${deleteSpinClass} {
                                    animation: jsgrid-delete-spin-${deleteSpinClass} 0.75s linear infinite;
                                }
                            `}</style>
                        </div>
                    </div>
                ) : null}
                </div>
            </div>
    );
}
