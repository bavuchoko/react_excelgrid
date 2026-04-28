import {useMemo, useRef, useState} from "react";
import Prev from "../resources/icon/Prev.tsx";
import Forward from "../resources/icon/Forward.tsx";
import type {Page} from "../type/Type.ts";

export type PaginationViewModel = {
    /** 0-based current page index */
    currentPage: number;
    totalPages: number;
    totalElements: number;
};

type Props = {
    page: PaginationViewModel;
    pageableBase: Page;
    onPageChange?: (pageable: Page) => void;
};

export default function Pagination(props: Props) {
    const totalPages = Math.max(1, props.page.totalPages || 1);
    const current0 = useMemo(() => {
        const raw = props.page.currentPage ?? 0;
        return Math.min(Math.max(0, raw), totalPages - 1);
    }, [props.page.currentPage, totalPages]);

    // number input은 브라우저/IME 조합에 따라 "앞자리 삭제" UX가 불안정할 수 있어 문자열로 편집한다.
    const [draftPage1, setDraftPage1] = useState(() => String(current0 + 1));
    const inputRef = useRef<HTMLInputElement | null>(null);
    const prevPageRef = useRef({ current0, totalPages });
    if (
        prevPageRef.current.current0 !== current0 ||
        prevPageRef.current.totalPages !== totalPages
    ) {
        prevPageRef.current = { current0, totalPages };
        setDraftPage1(String(current0 + 1));
    }

    const commitDraft = () => {
        const raw = draftPage1.trim();
        const parsed = raw === "" ? NaN : Number(raw);
        const next1 = Number.isFinite(parsed) ? parsed : (current0 + 1);
        const clamped1 = Math.min(Math.max(1, next1), totalPages);
        setDraftPage1(String(clamped1));
        const next0 = clamped1 - 1;
        const size = props.pageableBase.pageSize ?? props.pageableBase.size;
        props.onPageChange?.({
            ...props.pageableBase,
            pageNumber: next0,
            ...(size != null ? { pageSize: size, size } : {}),
        });
    };

    const selectAll = () => {
        const el = inputRef.current;
        if (!el) return;
        // controlled input + React 렌더 타이밍 때문에 select()가 먹지 않는 경우가 있어 rAF로 한 번 더 잡아준다.
        requestAnimationFrame(() => {
            try {
                el.focus();
                el.select();
            } catch {
                // ignore
            }
        });
    };

    return (
        <div
            style={{
                height: 30,
                borderTop: "1px solid rgb(189, 194, 201)",
                borderBottom: "1px solid rgb(189, 194, 201)",
                padding: 6,
                lineHeight: "20px",
                boxSizing: "border-box",
            }}
        >
            <div style={{ display: "flex", alignItems: "center" }}>
                <Prev
                    style={{ width: 18, height: 18, cursor: "pointer", color: "#111827" }}
                    onClick={() => {
                        const cur1 = Math.min(Math.max(1, Number(draftPage1) || (current0 + 1)), totalPages);
                        const next1 = Math.max(1, cur1 - 1);
                        setDraftPage1(String(next1));
                        const next0 = next1 - 1;
                        const size = props.pageableBase.pageSize ?? props.pageableBase.size;
                        props.onPageChange?.({
                            ...props.pageableBase,
                            pageNumber: next0,
                            ...(size != null ? { pageSize: size, size } : {}),
                        });
                    }}
                />

                <div style={{ display: "flex", marginLeft: 10, marginRight: 15, alignItems: "center" }}>
                    <input
                        ref={inputRef}
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        style={{
                            border: "1px solid rgb(189, 194, 201)",
                            borderRadius: 3,
                            textAlign: "right",
                            fontSize: 12,
                            marginRight: 15,
                            width: 40,
                            height: 20,
                            boxSizing: "border-box",
                        }}
                        onChange={(e) => {
                            // 편집 중엔 자유롭게(빈 값 포함). 확정은 blur/enter에서 clamp.
                            setDraftPage1(e.target.value);
                        }}
                        value={draftPage1}
                        onFocus={() => selectAll()}
                        onMouseUp={(e) => {
                            // 일부 브라우저는 mouseup이 select를 풀어버려서, 클릭 포커스에도 select를 보강
                            e.preventDefault();
                            selectAll();
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                (e.target as HTMLInputElement).blur();
                            }
                        }}
                        onBlur={commitDraft}
                    />
                    <p style={{ userSelect: "none", fontSize: 13, height: 20, margin: 0 }}>/ {totalPages}</p>
                </div>

                <Forward
                    style={{ width: 18, height: 18, cursor: "pointer", color: "#111827" }}
                    onClick={() => {
                        const cur1 = Math.min(Math.max(1, Number(draftPage1) || (current0 + 1)), totalPages);
                        const next1 = Math.min(totalPages, cur1 + 1);
                        setDraftPage1(String(next1));
                        const next0 = next1 - 1;
                        const size = props.pageableBase.pageSize ?? props.pageableBase.size;
                        props.onPageChange?.({
                            ...props.pageableBase,
                            pageNumber: next0,
                            ...(size != null ? { pageSize: size, size } : {}),
                        });
                    }}
                />

                <div
                    style={{
                        userSelect: "none",
                        display: "flex",
                        alignItems: "center",
                        fontSize: 13,
                        marginLeft: "auto",
                        marginRight: 30,
                    }}
                >
                    <p style={{ margin: 0 }}>total</p>
                    <p
                        style={{
                            margin: "0 5px",
                            borderLeft: "1px solid rgb(189, 194, 201)",
                            height: 14,
                        }}
                    />
                    <p style={{ margin: 0 }}>{props.page.totalElements}</p>
                </div>
            </div>
        </div>
    );
}

