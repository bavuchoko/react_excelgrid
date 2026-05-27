import { isValidElement, useId, useState, type CSSProperties, type ReactNode } from "react";
import { ToolbarHint } from "@bavuchoko/js-tooltip";
import { useJsGridToolbar } from "./JsGridToolbarContext.tsx";
import { useJsGridRowSelection } from "./JsGridRowSelectionContext.tsx";

function yieldToPaint(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => resolve());
    });
}

function joinClassNames(...parts: (string | undefined | false)[]): string | undefined {
    const s = parts.filter(Boolean).join(" ");
    return s || undefined;
}

/** 아이콘용 `lineHeight: 0`은 텍스트 버튼 높이를 무너뜨림 */
function isToolbarTextControl(child: ReactNode): boolean {
    if (!isValidElement(child)) return false;
    const type = child.type;
    if (typeof type === "string") {
        return type === "button" || type === "a";
    }
    return false;
}

export type ToolbarDataTransferContext = {
    selectedCount: number;
    selectedRows: unknown[];
    disabled: boolean;
    busy: boolean;
    /** `onTransfer` 실행 후 성공 시 선택 해제 */
    transferSelected: () => void | Promise<void>;
};

type Props = {
    /** 선택된 행 데이터 배열(1건이어도 배열)로 호출 */
    onTransfer: (rows: unknown[]) => void | Promise<void>;
    hint?: string;
    busyHint?: string;
    overlayLabel?: string;
    accentColor?: string;
    disabled?: boolean;
    /** 기본 렌더(아이콘 래퍼) 루트에 항상 적용 */
    className?: string;
    /** 선택 없음 등으로 클릭 불가(`cursor: not-allowed`)일 때 추가 */
    disabledClassName?: string;
    /** `onTransfer` 처리 중(`cursor: wait`)일 때 추가 */
    busyClassName?: string;
    children: ReactNode | ((ctx: ToolbarDataTransferContext) => ReactNode);
    style?: CSSProperties;
};

/**
 * `enableRowSelection`이 켜진 그리드에서, 체크된 행을 `onTransfer`로 넘기는 툴바 액션.
 * `ToolbarAsyncAction`과 같이 아이콘 스피너·본문 오버레이를 지원한다.
 */
export default function ToolbarDataTransfer({
    onTransfer,
    hint,
    busyHint,
    overlayLabel,
    accentColor = "#ef4444",
    disabled: disabledProp,
    className,
    disabledClassName,
    busyClassName,
    children,
    style,
}: Props) {
    const selection = useJsGridRowSelection();
    const toolbarApi = useJsGridToolbar();
    const [busy, setBusy] = useState(false);
    const spinClass = useId().replace(/:/g, "");

    const selectedRows = selection?.selectedRows ?? [];
    const selectedCount = selection?.selectedCount ?? 0;
    const noSelection = selectedCount === 0;
    const selectionUnavailable = selection == null;
    const interactionDisabled = disabledProp || noSelection || selectionUnavailable;
    const disabled = interactionDisabled || busy;
    const cursor = busy ? "wait" : interactionDisabled ? "not-allowed" : "pointer";
    const controlClassName = joinClassNames(
        className,
        busy && busyClassName,
        !busy && interactionDisabled && disabledClassName,
    );

    const transferSelected = async () => {
        if (disabled || !selection) return;
        if (selectedRows.length === 0) return;

        setBusy(true);
        await yieldToPaint();
        const run = async () => {
            await Promise.resolve(onTransfer(selectedRows));
            selection.clearSelection();
        };
        try {
            if (overlayLabel && toolbarApi) {
                await toolbarApi.runToolbarAction(overlayLabel, run, accentColor);
            } else {
                await run();
            }
        } finally {
            setBusy(false);
        }
    };

    const ctx: ToolbarDataTransferContext = {
        selectedCount,
        selectedRows,
        disabled,
        busy,
        transferSelected,
    };

    const tooltip = busy && busyHint ? busyHint : hint;
    const customRender = typeof children === "function";
    const textControl = !customRender && isToolbarTextControl(children);

    const control = customRender ? (
        children(ctx)
    ) : (
        <div
            className={controlClassName}
            style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor,
                ...style,
            }}
            onClick={() => void transferSelected()}
            role={hint ? undefined : "button"}
            tabIndex={hint ? undefined : disabled ? -1 : 0}
            onKeyDown={
                hint
                    ? undefined
                    : (e) => {
                          if (disabled) return;
                          if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              void transferSelected();
                          }
                      }
            }
            aria-busy={busy}
            aria-disabled={disabled}
        >
            <span
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: busy || interactionDisabled ? 0.45 : 1,
                    ...(textControl ? {} : { lineHeight: 0 }),
                }}
            >
                {children}
            </span>
            {busy ? (
                <span
                    className={`jsgrid-toolbar-transfer-spin-${spinClass}`}
                    style={{
                        position: "absolute",
                        inset: 0,
                        margin: "auto",
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        border: "2px solid #e5e7eb",
                        borderTopColor: accentColor,
                        boxSizing: "border-box",
                        pointerEvents: "none",
                    }}
                    aria-hidden
                />
            ) : null}
        </div>
    );

    const wrapped = (
        <>
            <style>{`
                @keyframes jsgrid-toolbar-transfer-spin-${spinClass} {
                    to { transform: rotate(360deg); }
                }
                .jsgrid-toolbar-transfer-spin-${spinClass} {
                    animation: jsgrid-toolbar-transfer-spin-${spinClass} 0.75s linear infinite;
                }
            `}</style>
            {customRender && busy ? (
                <div
                    className={joinClassNames(className, busyClassName)}
                    style={{ position: "relative", display: "inline-flex" }}
                >
                    {control}
                    <span
                        className={`jsgrid-toolbar-transfer-spin-${spinClass}`}
                        style={{
                            position: "absolute",
                            inset: 0,
                            margin: "auto",
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            border: "2px solid #e5e7eb",
                            borderTopColor: accentColor,
                            boxSizing: "border-box",
                            pointerEvents: "none",
                        }}
                        aria-hidden
                    />
                </div>
            ) : (
                control
            )}
        </>
    );

    if (tooltip) {
        return <ToolbarHint text={tooltip}>{wrapped}</ToolbarHint>;
    }

    return wrapped;
}
