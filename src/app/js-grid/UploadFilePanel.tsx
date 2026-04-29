import { type CSSProperties, type DragEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { isAllowedExcelUpload } from "./excelUploadConstraints.ts";

const EXCEL_ONLY_MSG = "Excel 파일(.xlsx, .xls, .xlsm)만 업로드할 수 있습니다.";

/** 패널(회색 박스) 테두리 */
const PANEL_BORDER = "#bdc2c9";

/** 인풋(흰색 줄) 테두리 — 배경 대비 필요 */
const INPUT_ROW_BORDER = "#cbd5e1";

/** 아이콘 구역 구분선 */
const DIVIDER_LINE = "#d1d5db";

type Props = {
    open: boolean;
    /** `position:fixed` 배치용 (아이콘 기준) */
    pos: { top: number; right: number } | null;
    accept?: string;
    multiple?: boolean;
    /** 업로드 버튼 클릭 시에만 호출. 서버 완료(또는 reject)까지 Promise가 유지된다. */
    onUploadConfirm: (files: File[]) => void | Promise<void>;
    onClose: () => void;
    /** 업로드 요청 처리 중 true — 바깥 닫기·Esc 등 차단용 */
    onBusyChange?: (busy: boolean) => void;
};

const hiddenInputStyle = {
    position: "fixed" as const,
    width: 0,
    height: 0,
    opacity: 0,
    pointerEvents: "none" as const,
    overflow: "hidden",
    clipPath: "inset(50%)",
};

function keyOfFile(f: File): string {
    return `${f.name}\u0000${f.size}\u0000${f.lastModified}`;
}

function IconDivider() {
    return <div aria-hidden={true} style={{ width: 1, alignSelf: "stretch", margin: "4px 0", backgroundColor: DIVIDER_LINE }} />;
}

/** 파일 선택(종이 클립) */
function IconAttachFile(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
            aria-hidden
        >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
    );
}

function IconTrash(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
            aria-hidden
        >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
    );
}

export default function UploadFilePanel(props: Props) {
    const {
        open,
        pos,
        accept,
        multiple = false,
        onUploadConfirm,
        onClose,
        onBusyChange,
    } = props;
    const panelId = useId();
    const spinClass = useId().replace(/:/g, "");

    const inputRef = useRef<HTMLInputElement | null>(null);
    const [draftFiles, setDraftFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);

    const draftOne = draftFiles[0];

    const resetAll = useCallback(() => {
        setDraftFiles([]);
        setErrorMsg(null);
        const el = inputRef.current;
        if (el) el.value = "";
    }, []);

    const mergeDroppedDedupe = useCallback((incoming: File[]) => {
        setDraftFiles((prev) => {
            const m = new Map<string, File>();
            for (const f of prev) m.set(keyOfFile(f), f);
            for (const f of incoming) m.set(keyOfFile(f), f);
            return [...m.values()];
        });
        if (inputRef.current) inputRef.current.value = "";
    }, []);

    const normalizeExcelStaging = useCallback(
        (raw: ArrayLike<File>): File[] | null => {
            let picked = Array.from(raw);
            if (!multiple) picked = picked.slice(0, 1);
            if (picked.length === 0) return [];
            const bad = picked.some((f) => !isAllowedExcelUpload(f));
            if (bad) {
                setErrorMsg(EXCEL_ONLY_MSG);
                if (inputRef.current) inputRef.current.value = "";
                return null;
            }
            setErrorMsg(null);
            return picked;
        },
        [multiple],
    );

    const stageFromPicker = useCallback(
        (list: FileList | null | undefined) => {
            if (!list?.length) return;
            const next = normalizeExcelStaging(list);
            if (next === null) return;
            setDraftFiles(multiple ? next : next.slice(0, 1));
            if (inputRef.current) inputRef.current.value = "";
        },
        [multiple, normalizeExcelStaging],
    );

    const onDropPane = useCallback(
        (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
            if (isUploading) return;

            const next = normalizeExcelStaging(e.dataTransfer.files);

            if (next === null) return;

            if (next.length === 0) return;

            if (!multiple) {
                setDraftFiles(next.slice(0, 1));
                if (inputRef.current) inputRef.current.value = "";
                return;
            }

            mergeDroppedDedupe(next);
        },
        [isUploading, mergeDroppedDedupe, multiple, normalizeExcelStaging],
    );

    const handleUploadSubmit = useCallback(async () => {
        if (draftFiles.length === 0 || isUploading) return;
        const filesPayload = [...draftFiles];

        setErrorMsg(null);

        setIsUploading(true);
        onBusyChange?.(true);
        try {
            await Promise.resolve(onUploadConfirm(filesPayload));
            resetAll();
            onClose();
        } catch (e: unknown) {
            setErrorMsg(e instanceof Error ? e.message : "업로드에 실패했습니다.");
        } finally {
            setIsUploading(false);
            onBusyChange?.(false);
        }
    }, [draftFiles, isUploading, onBusyChange, onClose, onUploadConfirm, resetAll]);

    useEffect(() => {
        if (!open) {
            resetAll();
            setIsUploading(false);
            setDragOver(false);
            onBusyChange?.(false);
        }
    }, [open, resetAll, onBusyChange]);

    useEffect(() => {
        if (!open) return;

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !isUploading) onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, isUploading, onClose]);

    const iconBtnSx = useCallback((disabled?: boolean): CSSProperties => ({
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 5px",
        margin: 0,
        border: "none",
        background: "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : 1,
        borderRadius: 0,
        color: "#64748b",
        lineHeight: 0,
        flexShrink: 0,
        transition: "background-color 0.15s ease, color 0.15s ease",
    }), []);

    const showPanel = Boolean(open && pos);

    return (
        <>
            <style>{`
                @keyframes jsgrid-spin-${spinClass} {
                    to { transform: rotate(360deg); }
                }
                .jsgrid-spin-circle-${spinClass} {
                    animation: jsgrid-spin-${spinClass} 0.75s linear infinite;
                }

            `}</style>

            <input
                aria-hidden={true}
                ref={inputRef}
                type="file"
                accept={accept}
                multiple={multiple}
                disabled={showPanel && isUploading}

                tabIndex={-1}
                style={hiddenInputStyle}
                data-jsgrid-upload-input=""
                onChange={(e) => stageFromPicker(e.target.files)}
            />

            {showPanel ? (
                <div id={panelId}>
                    <div
                        data-jsgrid-upload-panel="1"
                        role="dialog"
                        aria-busy={isUploading}

                        aria-label="Excel 파일 첨부"

                        style={{
                            position: "fixed",
                            top: pos!.top,
                            right: pos!.right,
                            width: "min(296px, calc(100vw - 24px))",
                            maxWidth: "100%",
                            zIndex: 10000,
                            padding: 6,
                            margin: 0,
                            boxSizing: "border-box",
                            backgroundColor: "rgb(248, 248, 248)",
                            border: `1px solid ${PANEL_BORDER}`,
                            boxShadow: "0 1px 6px rgba(15,23,42,0.12)",
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "stretch",
                                    flexDirection: "row",
                                    borderRadius: 0,
                                    border: `1px solid ${dragOver ? "#3b82f6" : INPUT_ROW_BORDER}`,
                                    backgroundColor: "#ffffff",
                                    outline: dragOver ? "1px solid #bfdbfe" : "none",
                                    outlineOffset: 0,
                                    overflow: "hidden",
                                    minHeight: 30,
                                    transition: "border-color 0.15s, background-color 0.15s, outline 0.15s",
                                    position: "relative",

                                }}
                                onDragEnter={(e) => {
                                    e.preventDefault();
                                    if (!isUploading) setDragOver(true);
                                }}
                                onDragLeave={(e) => {
                                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
                                }}
                                onDragOver={(e) => {
                                    if (isUploading) return;

                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.dataTransfer.dropEffect = "copy";
                                }}
                                onDrop={onDropPane}
                            >
                                {/* 왼쪽: 플레이스홀더 / 파일명 */}
                                <button
                                    type="button"
                                    disabled={isUploading}
                                    onClick={() => !isUploading && inputRef.current?.click()}
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        textAlign: "left",
                                        padding: "6px 8px",
                                        border: "none",
                                        background: "#ffffff",
                                        cursor: isUploading ? "default" : "pointer",
                                        fontSize: 12,
                                        fontFamily: "inherit",
                                        color: draftOne ? "#1e293b" : "#64748b",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                    }}
                                >
                                    {isUploading ? (
                                        <span style={{ color: "#475569" }}>업로드 중…</span>
                                    ) : draftOne ? (
                                        draftOne.name
                                    ) : (
                                        "Excel 파일을 선택하세요…"
                                    )}
                                </button>

                                {/* 오른쪽: 액션 아이콘 */}
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "row",
                                        alignItems: "center",

                                        paddingRight: 2,

                                        flexShrink: 0,

                                    }}
                                >
                                    {!isUploading ? (
                                        <>
                                            <button
                                                type="button"


                                                aria-label="업로드"

                                                disabled={!draftOne || isUploading}
                                                onClick={(ev) => {
                                                    ev.stopPropagation();

                                                    void handleUploadSubmit();
                                                }}
                                                style={{
                                                    margin: "0 2px 0 0",
                                                    padding: "5px 10px",
                                                    whiteSpace: "nowrap",
                                                    fontFamily: "inherit",

                                                    fontSize: 11,

                                                    fontWeight: 700,

                                                    border: "none",
                                                    borderRadius: 0,
                                                    cursor: draftOne && !isUploading ? "pointer" : "not-allowed",

                                                    ...(draftOne
                                                        ? ({ backgroundColor: "#2563eb", color: "#ffffff" })

                                                        : { backgroundColor: "#e2e8f0", color: "#94a3b8" }),
                                                    flexShrink: 0,

                                                    transition: "background-color 0.15s",
                                                }}

                                                onMouseEnter={(e) => {
                                                    if (!draftOne) return;

                                                    e.currentTarget.style.backgroundColor = "#1d4ed8";
                                                }}
                                                onMouseLeave={(e) => {


                                                    if (!draftOne) return;

                                                    e.currentTarget.style.backgroundColor = "#2563eb";

                                                }}
                                            >

                                                업로드



                                            </button>
                                            <IconDivider />
                                            <button
                                                type="button"
                                                aria-label="파일 찾아보기"
                                                title="파일 선택"

                                                disabled={isUploading}
                                                onClick={(ev) => {
                                                    ev.stopPropagation();
                                                    inputRef.current?.click();
                                                }}
                                                onMouseEnter={(e) => {

                                                    const t = e.currentTarget;
                                                    t.style.backgroundColor = "#f1f5f9";
                                                    t.style.color = "#2563eb";
                                                }}
                                                onMouseLeave={(e) => {

                                                    const t = e.currentTarget;
                                                    t.style.backgroundColor = "transparent";
                                                    t.style.color = "#64748b";

                                                }}

                                                style={iconBtnSx(isUploading)}
                                            >
                                                <IconAttachFile />
                                            </button>
                                            <IconDivider />
                                            <button
                                                type="button"
                                                aria-label="첨부 취소"
                                                title="삭제"

                                                disabled={!draftOne || isUploading}
                                                onClick={(ev) => {
                                                    ev.stopPropagation();

                                                    resetAll();
                                                }}

                                                onMouseEnter={(e) => {
                                                    const t = e.currentTarget;

                                                    t.style.backgroundColor = "#fef2f2";

                                                    t.style.color = "#dc2626";
                                                }}
                                                onMouseLeave={(e) => {
                                                    const t = e.currentTarget;
                                                    t.style.backgroundColor = "transparent";
                                                    t.style.color = "#64748b";

                                                }}

                                                style={iconBtnSx(!draftOne || isUploading)}
                                            >
                                                <IconTrash />
                                            </button>
                                        </>
                                    ) : null}
                                </div>

                                {/* 로딩 시 살짝 덮는 반투명 레이어 (클릭 차단) */}
                                {isUploading ? (
                                    <div
                                        aria-live="polite"
                                        aria-busy={true}

                                        aria-label="업로드 중"
                                        style={{
                                            position: "absolute",

                                            inset: 0,
                                            borderRadius: 0,
                                            backgroundColor: "rgba(255,255,255,0.75)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",

                                            gap: 10,
                                            pointerEvents: "all",
                                        }}

                                    >
                                        <div
                                            className={`jsgrid-spin-circle-${spinClass}`}
                                            style={{
                                                width: 18,
                                                height: 18,
                                                borderRadius: "50%",
                                                border: "2.5px solid #e5e7eb",

                                                borderTopColor: "#2563eb",
                                                flexShrink: 0,

                                            }}
                                        />

                                    </div>


                                ) : null}
                            </div>

                            {/* 오류 및 힌트 */}
                            <div style={{ paddingTop: 6, paddingLeft: 0, paddingRight: 0 }}>
                                {errorMsg ? (
                                    <div style={{ fontSize: 11, color: "#b91c1c", lineHeight: 1.45 }}>
                                        {errorMsg}

                                    </div>
                                ) : (
                                    <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.35 }}>
                                        파일을 고른 뒤 파란색「업로드」를 누르면 전송합니다. 비 Excel은 거절됩니다.
                                    </div>
                                )}

                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}

