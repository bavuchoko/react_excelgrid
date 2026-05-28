import { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnFilterOption } from "./columnFilter.ts";

type Props = {
    open: boolean;
    pos: { top: number; left: number } | null;
    columnLabel: string;
    options: ColumnFilterOption[];
    /** 현재 적용 중인 토큰 집합. null이면 "모두 표시"(필터 없음). */
    selected: ReadonlySet<string> | null;
    onApply: (next: ReadonlySet<string> | null) => void;
    onClose: () => void;
};

export default function ColumnFilterMenu(props: Props) {
    const rootRef = useRef<HTMLDivElement>(null);
    const [search, setSearch] = useState("");
    const [draft, setDraft] = useState<Set<string>>(() => new Set());

    useEffect(() => {
        if (!props.open) return;
        setSearch("");
        if (props.selected == null) {
            setDraft(new Set(props.options.map((o) => o.token)));
        } else {
            setDraft(new Set(props.selected));
        }
    }, [props.open, props.selected, props.options]);

    useEffect(() => {
        if (!props.open) return;
        const onDown = (e: MouseEvent) => {
            const target = e.target as Node | null;
            if (!target) return;
            if (rootRef.current?.contains(target)) return;
            const anchor = document.querySelector(
                `[data-jsgrid-filter-trigger="1"][data-active="1"]`,
            );
            if (anchor && anchor.contains(target)) return;
            props.onClose();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") props.onClose();
        };
        window.addEventListener("mousedown", onDown);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("mousedown", onDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [props.open, props]);

    const filteredOptions = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return props.options;
        return props.options.filter((o) => o.label.toLowerCase().includes(q));
    }, [props.options, search]);

    const allSelected =
        filteredOptions.length > 0 && filteredOptions.every((o) => draft.has(o.token));
    const someSelected =
        !allSelected && filteredOptions.some((o) => draft.has(o.token));

    if (!props.open || !props.pos) return null;

    const toggleOne = (token: string) => {
        setDraft((prev) => {
            const next = new Set(prev);
            if (next.has(token)) next.delete(token);
            else next.add(token);
            return next;
        });
    };

    const toggleAllVisible = () => {
        setDraft((prev) => {
            const next = new Set(prev);
            if (allSelected) {
                for (const o of filteredOptions) next.delete(o.token);
            } else {
                for (const o of filteredOptions) next.add(o.token);
            }
            return next;
        });
    };

    const handleApply = () => {
        if (draft.size === 0) {
            props.onApply(new Set());
        } else if (draft.size === props.options.length) {
            props.onApply(null);
        } else {
            props.onApply(new Set(draft));
        }
    };

    const handleClear = () => {
        props.onApply(null);
    };

    return (
        <div
            ref={rootRef}
            data-jsgrid-filter-menu="1"
            style={{
                position: "fixed",
                top: props.pos.top,
                left: props.pos.left,
                width: 240,
                backgroundColor: "#ffffff",
                border: "1px solid #bdc2c9",
                boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
                zIndex: 10000,
                padding: 8,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 12,
                color: "#111827",
            }}
        >
            <div
                style={{
                    fontSize: 11,
                    color: "#6b7280",
                    padding: "0 2px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
                title={props.columnLabel}
            >
                {props.columnLabel} 필터
            </div>

            <input
                type="text"
                placeholder="검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                    border: "1px solid #d1d5db",
                    borderRadius: 4,
                    padding: "5px 8px",
                    fontSize: 12,
                    outline: "none",
                    width: "100%",
                    boxSizing: "border-box",
                }}
            />

            <label
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 4px",
                    borderBottom: "1px solid #e5e7eb",
                    cursor: filteredOptions.length === 0 ? "default" : "pointer",
                    userSelect: "none",
                    color: filteredOptions.length === 0 ? "#9ca3af" : undefined,
                }}
            >
                <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                    }}
                    disabled={filteredOptions.length === 0}
                    onChange={toggleAllVisible}
                />
                <span>전체 선택</span>
            </label>

            <div
                style={{
                    maxHeight: 240,
                    overflow: "auto",
                    border: "1px solid #e5e7eb",
                    borderRadius: 4,
                    padding: 4,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    backgroundColor: "#fafafa",
                }}
            >
                {filteredOptions.length === 0 ? (
                    <div style={{ padding: "10px 6px", color: "#9ca3af", textAlign: "center" }}>
                        결과 없음
                    </div>
                ) : (
                    filteredOptions.map((o) => (
                        <label
                            key={o.token}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "4px 6px",
                                cursor: "pointer",
                                borderRadius: 3,
                                userSelect: "none",
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={draft.has(o.token)}
                                onChange={() => toggleOne(o.token)}
                            />
                            <span
                                style={{
                                    flex: 1,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                                title={o.label}
                            >
                                {o.label}
                            </span>
                            <span style={{ color: "#9ca3af", fontSize: 11 }}>{o.count}</span>
                        </label>
                    ))
                )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, paddingTop: 2 }}>
                <button
                    type="button"
                    onClick={handleClear}
                    style={{
                        fontSize: 12,
                        padding: "4px 10px",
                        border: "1px solid #bdc2c9",
                        backgroundColor: "#f8f8f8",
                        borderRadius: 4,
                        cursor: "pointer",
                    }}
                >
                    초기화
                </button>
                <button
                    type="button"
                    onClick={handleApply}
                    disabled={draft.size === 0}
                    title={draft.size === 0 ? "표시할 값을 1개 이상 선택하세요" : undefined}
                    style={{
                        fontSize: 12,
                        padding: "4px 10px",
                        border: "1px solid #1d4ed8",
                        backgroundColor: draft.size === 0 ? "#94a3b8" : "#1d4ed8",
                        borderColor: draft.size === 0 ? "#94a3b8" : "#1d4ed8",
                        color: "#ffffff",
                        borderRadius: 4,
                        cursor: draft.size === 0 ? "not-allowed" : "pointer",
                        opacity: draft.size === 0 ? 0.7 : 1,
                    }}
                >
                    적용
                </button>
            </div>
        </div>
    );
}
