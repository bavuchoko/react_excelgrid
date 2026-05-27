import type { CSSProperties } from "react";

const DOT_SIZE_PX = 15;

/** 시트 탭 왼쪽 위 — 빨간 원 + 흰색 ! */
export default function SheetTabErrorDot({ style }: { style?: CSSProperties }) {
    return (
        <span
            aria-hidden
            style={{
                position: "absolute",
                top: -5,
                left: 6,
                zIndex: 2,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: DOT_SIZE_PX,
                height: DOT_SIZE_PX,
                borderRadius: "50%",
                backgroundColor: "#dc2626",
                color: "#ffffff",
                fontSize: 11,
                fontWeight: 800,
                lineHeight: 1,
                boxSizing: "border-box",
                pointerEvents: "none",
                boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
                ...style,
            }}
        >
            !
        </span>
    );
}
