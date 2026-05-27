import {useId, useState, type CSSProperties, type MutableRefObject, type ReactNode} from "react";
import Reset from "../resources/icon/Reset.tsx";
import Disk from "../resources/icon/Disk.tsx";
import type {UserColumn} from "./columnFieldsMenuModel.ts";

function FieldsMenuActionButton({
    busy,
    busyLabel,
    spinClass,
    disabled,
    onClick,
    children,
    style,
}: {
    busy: boolean;
    busyLabel: string;
    spinClass: string;
    disabled: boolean;
    onClick: () => void;
    children: ReactNode;
    style: CSSProperties;
}) {
    return (
        <button
            type="button"
            disabled={disabled && !busy}
            onClick={(e) => {
                if (busy) {
                    e.preventDefault();
                    return;
                }
                onClick();
            }}
            aria-busy={busy}
            aria-disabled={disabled || busy}
            aria-label={busy ? busyLabel : undefined}
            style={{
                ...style,
                position: "relative",
                cursor: busy || disabled ? "wait" : style.cursor,
            }}
        >
            {children}
            {busy ? (
                <span
                    aria-live="polite"
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: 6,
                        backgroundColor: "rgba(255,255,255,0.75)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        pointerEvents: "all",
                    }}
                >
                    <span
                        className={`jsgrid-fields-menu-spin-${spinClass}`}
                        style={{
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            border: "2px solid #e5e7eb",
                            borderTopColor: "#2563eb",
                            flexShrink: 0,
                        }}
                        aria-hidden
                    />
                    <span style={{ fontSize: 11, color: "#374151" }}>{busyLabel}</span>
                </span>
            ) : null}
        </button>
    );
}

type Props = {
    open: boolean;
    pos: { top: number; right: number } | null;
    userColumns: UserColumn[];
    dragKeyRef: MutableRefObject<string | null>;
    onReorder: (fromKey: string, toKey: string) => void;
    onToggleVisible: (key: string, visible: boolean) => void;
    /** `onHeaderSave`가 있을 때 초기화 버튼 표시(로컬 컬럼 복원 + 선택적 `onHeaderReset`). */
    onReset?: () => void | Promise<void>;
    onSave: () => void | Promise<void>;
    saveBusy?: boolean;
    resetBusy?: boolean;
    saveError?: string | null;
};

export default function ColumnFieldsMenu(props: Props) {
    const [resetPending, setResetPending] = useState(false);
    const resetBusy = Boolean(props.resetBusy || resetPending);
    const actionBusy = Boolean(props.saveBusy || resetBusy);
    const saveSpinClass = useId().replace(/:/g, "");
    const resetSpinClass = useId().replace(/:/g, "");

    const handleResetClick = () => {
        if (actionBusy || !props.onReset) return;
        setResetPending(true);
        void Promise.resolve(props.onReset()).finally(() => setResetPending(false));
    };

    if (!props.open || !props.pos) return null;

    return (
        <div
            data-jsgrid-fields-menu="1"
            style={{
                position: 'fixed',
                top: props.pos.top,
                right: props.pos.right,
                width: 200,
                backgroundColor: 'rgb(246,246,246)',
                border: '1px solid #bdc2c9',
                boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                zIndex: 10000,
                padding: 5,
            }}
        >
            <style>{`
                @keyframes jsgrid-fields-menu-spin-${saveSpinClass} {
                    to { transform: rotate(360deg); }
                }
                .jsgrid-fields-menu-spin-${saveSpinClass} {
                    animation: jsgrid-fields-menu-spin-${saveSpinClass} 0.75s linear infinite;
                }
                @keyframes jsgrid-fields-menu-spin-${resetSpinClass} {
                    to { transform: rotate(360deg); }
                }
                .jsgrid-fields-menu-spin-${resetSpinClass} {
                    animation: jsgrid-fields-menu-spin-${resetSpinClass} 0.75s linear infinite;
                }
            `}</style>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, padding: '4px 6px' }}>
                보이기/숨기기, 드래그로 순서 변경
            </div>
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    maxHeight: 320,
                    overflow: "auto",
                    padding: 5,
                    pointerEvents: actionBusy ? "none" : undefined,
                    opacity: actionBusy ? 0.65 : 1,
                }}
            >
                {props.userColumns.map((c) => (
                    <div
                        key={c.key}
                        draggable={!actionBusy}
                        onDragStart={() => {
                            if (actionBusy) return;
                            props.dragKeyRef.current = c.key;
                        }}
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={() => {
                            if (actionBusy) return;
                            const fromKey = props.dragKeyRef.current;
                            const toKey = c.key;
                            if (!fromKey || fromKey === toKey) return;
                            props.onReorder(fromKey, toKey);
                        }}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 8px",
                            backgroundColor: "rgb(232,232,232)",
                            borderRadius: 4,
                            cursor: actionBusy ? "default" : "grab",
                            userSelect: "none",
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={c.visible}
                            disabled={actionBusy}
                            onChange={(e) => props.onToggleVisible(c.key, e.target.checked)}
                        />
                        <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.label}
                        </div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>⋮⋮</div>
                    </div>
                ))}
            </div>

            <div style={{ padding: '8px 12px 0' }}>
                {props.saveError ? (
                    <div
                        role="alert"
                        style={{
                            marginBottom: 8,
                            fontSize: 12,
                            color: '#b91c1c',
                            lineHeight: 1.35,
                            wordBreak: 'break-word',
                        }}
                    >
                        {props.saveError}
                    </div>
                ) : null}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "8px 12px 2px" }}>
                {props.onReset ? (
                    <FieldsMenuActionButton
                        busy={resetBusy}
                        busyLabel="초기화 중…"
                        spinClass={resetSpinClass}
                        disabled={actionBusy}
                        onClick={handleResetClick}
                        style={{
                            fontSize: 12,
                            padding: "4px 10px",
                            border: "1px solid #bdc2c9",
                            backgroundColor: "#f8f8f8",
                            borderRadius: 6,
                            cursor: actionBusy ? "wait" : "pointer",
                            opacity: actionBusy && !resetBusy ? 0.6 : 1,
                            whiteSpace: "nowrap",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                            boxSizing: "border-box",
                            minWidth: 88,
                        }}
                    >
                        <Reset style={{ width: 16, height: 16, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, lineHeight: 1 }}>초기화</span>
                    </FieldsMenuActionButton>
                ) : null}

                <FieldsMenuActionButton
                    busy={Boolean(props.saveBusy)}
                    busyLabel="저장 중…"
                    spinClass={saveSpinClass}
                    disabled={actionBusy}
                    onClick={() => void props.onSave()}
                    style={{
                        fontSize: 12,
                        padding: "4px 10px",
                        border: "1px solid #1d4ed8",
                        backgroundColor: "#1d4ed8",
                        color: "#ffffff",
                        borderRadius: 6,
                        cursor: actionBusy ? "wait" : "pointer",
                        opacity: actionBusy && !props.saveBusy ? 0.85 : 1,
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        boxSizing: "border-box",
                        minWidth: 76,
                    }}
                >
                    <Disk style={{ width: 16, height: 16, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, lineHeight: 1 }}>저장</span>
                </FieldsMenuActionButton>
            </div>
        </div>
    );
}
