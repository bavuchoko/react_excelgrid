import type { CSSProperties } from "react";

/** `SheetErrorBar` 카테고리 배지와 동일한 아이콘 칸(18×18, 라운드 사각 + 글자). */
export const SHEET_ERROR_BADGE_ICON_PX = 18;

export type SheetErrorBadgeIconProps = {
    letter?: string;
    color?: string;
    bg?: string;
    size?: number;
    style?: CSSProperties;
};

const DEFAULT_META = {
    letter: "!",
    color: "#dc2626",
    bg: "#fee2e2",
} as const;

export default function SheetErrorBadgeIcon({
    letter = DEFAULT_META.letter,
    color = DEFAULT_META.color,
    bg = DEFAULT_META.bg,
    size = SHEET_ERROR_BADGE_ICON_PX,
    style,
}: SheetErrorBadgeIconProps) {
    return (
        <span
            aria-hidden
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: size,
                height: size,
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                color,
                backgroundColor: bg,
                border: `1px solid ${color}55`,
                flexShrink: 0,
                lineHeight: 1,
                boxSizing: "border-box",
                ...style,
            }}
        >
            {letter}
        </span>
    );
}
