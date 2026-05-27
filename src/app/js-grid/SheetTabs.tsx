import type {CSSProperties, PointerEvent} from "react";
import {useCallback, useRef, useState} from "react";
import type {Sheet} from "../type/Type.ts";
import { hasSheetErrors } from "./sheetErrors.ts";
import SheetTabErrorDot from "./SheetTabErrorDot.tsx";
import "./SheetTabs.css";

/** 이 거리(px) 이상 포인터가 움직여야 좌우 드래그(패닝)로 간주한다 */
const DRAG_START_THRESHOLD_PX = 5;

type Props = {
    sheets: Sheet[];
    activeIndex: number;
    onChange: (nextIndex: number) => void;
    style?: CSSProperties;
};

/** pointerdown 시작 시 타깃 탭 인덱스 (부모에서 setPointerCapture 해도 click이 안 뜰 수 있어 pointerup으로 전환 처리) */
function tabIndexUnderTarget(target: EventTarget | null): number | null {
    const el = target instanceof Element ? target.closest("[data-sheet-index]") : null;
    if (!el) return null;
    const raw = el.getAttribute("data-sheet-index");
    if (raw == null || raw === "") return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
}

export default function SheetTabs({ sheets, activeIndex, onChange, style }: Props) {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    /** pointerdown이 탭 안에서 시작됐으면 해당 인덱스 */
    const pressedTabIndexRef = useRef<number | null>(null);
    const dragRef = useRef<{
        pointerId: number | null;
        startX: number;
        startScrollLeft: number;
        hasStartedPan: boolean;
    }>({
        pointerId: null,
        startX: 0,
        startScrollLeft: 0,
        hasStartedPan: false,
    });
    const [isPanning, setIsPanning] = useState(false);

    const onScrollTrackPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        const el = scrollRef.current;
        if (!el) return;
        pressedTabIndexRef.current = tabIndexUnderTarget(e.target);
        dragRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startScrollLeft: el.scrollLeft,
            hasStartedPan: false,
        };
        try {
            el.setPointerCapture(e.pointerId);
        } catch {
            /* noop */
        }
    }, []);

    const onScrollTrackPointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
        const el = scrollRef.current;
        if (!el || dragRef.current.pointerId !== e.pointerId) return;
        const dx = e.clientX - dragRef.current.startX;

        if (!dragRef.current.hasStartedPan) {
            if (Math.abs(dx) < DRAG_START_THRESHOLD_PX) return;
            dragRef.current.hasStartedPan = true;
            setIsPanning(true);
        }

        el.scrollLeft = dragRef.current.startScrollLeft - dx;
    }, []);

    const endScrollDrag = useCallback(
        (e: PointerEvent<HTMLDivElement>) => {
            if (dragRef.current.pointerId !== e.pointerId) return;

            const savedHasPan = dragRef.current.hasStartedPan;
            const savedPressedIndex = pressedTabIndexRef.current;

            const el = scrollRef.current;
            if (el) {
                try {
                    el.releasePointerCapture(e.pointerId);
                } catch {
                    /* noop */
                }
            }
            dragRef.current.pointerId = null;
            dragRef.current.hasStartedPan = false;
            pressedTabIndexRef.current = null;
            setIsPanning(false);

            if (!savedHasPan && savedPressedIndex !== null) {
                onChange(savedPressedIndex);
            }
        },
        [onChange],
    );

    if (!sheets || sheets.length === 0) return null;

    const BAR_BG = "rgb(248, 248, 248)";
    const ACTIVE_BG = "rgb(255,255,255)"; // bar보다 조금 밝게
    const ACTIVE_ACCENT = "#1d4ed8";
    const ACTIVE_ACCENT_BG = "#dadfee";
    const INACTIVE_ACCENT = "#e5e5e5";
    const INACTIVE_ACCENT_BG = "#dcdcdc";
    const TAB_BAR_HEIGHT = 30;
    const TAB_BAR_PAD_TOP = 6;

    return (
        <div
            ref={scrollRef}
            className="sheetTabsScroll"
            onPointerDown={onScrollTrackPointerDown}
            onPointerMove={onScrollTrackPointerMove}
            onPointerUp={endScrollDrag}
            onPointerCancel={endScrollDrag}
            style={{
                backgroundColor: BAR_BG,
                borderBottom: "1px solid #bdc2c9",
                boxSizing: "border-box",
                minHeight: TAB_BAR_HEIGHT + TAB_BAR_PAD_TOP,
                paddingTop: TAB_BAR_PAD_TOP,
                display: "flex",
                alignItems: "stretch",
                overflowX: "auto",
                overflowY: "visible",
                cursor: isPanning ? "grabbing" : "default",
                touchAction: "none",
                userSelect: "none",
                WebkitUserSelect: "none",
                ...style,
            }}
        >
            {sheets.map((s, i) => {
                const active = i === activeIndex;
                const label = (s.name && String(s.name).trim()) ? String(s.name) : `Sheet ${i + 1}`;
                const count = Array.isArray(s.data) ? s.data.length : 0;
                const sheetHasErrors = hasSheetErrors(s.errors);
                return (
                    <div
                        key={`${label}\u0000${i}`}
                        data-sheet-index={i}
                        title={sheetHasErrors ? `${label}: 검증 오류 있음` : label}
                        style={{
                            flexShrink: 0,
                            fontSize: 12,
                            height: TAB_BAR_HEIGHT,
                            padding: "0 16px",
                            display: "flex",
                            alignItems: "center",
                            borderBottom: "none",
                            borderRadius: 0,
                            appearance: "none",
                            WebkitAppearance: "none",
                            backgroundColor: active ? ACTIVE_BG : "transparent",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            outline: "none",
                            boxSizing: "border-box",
                            position: "relative",
                            overflow: "visible",
                            ...(active
                                ? {
                                    boxShadow: `inset 0 -2px 0 ${ACTIVE_ACCENT}`,
                                    fontWeight: 600,
                                    color: ACTIVE_ACCENT,
                                }
                                : {
                                    color: "#374151",
                                    boxShadow: `inset 0 -2px 0 ${INACTIVE_ACCENT}`, // 비활성 하단 회색 경계
                                }),
                        }}
                        aria-pressed={active}
                    >
                        {sheetHasErrors ? (
                            <span aria-label="검증 오류">
                                <SheetTabErrorDot />
                            </span>
                        ) : null}
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{ lineHeight: 1.25 }}>{label}</span>
                            <span
                                style={{
                                    height: 18,
                                    lineHeight: "18px",
                                    padding: "0 5px",
                                    borderRadius: 5,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: active ? ACTIVE_ACCENT : "#949494",
                                    background: active ? ACTIVE_ACCENT_BG : INACTIVE_ACCENT_BG,
                                }}
                            >
                                {count}
                            </span>
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
