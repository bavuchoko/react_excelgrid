import type {CSSProperties} from "react";
import type {Sheet} from "../type/Type.ts";

type Props = {
    sheets: Sheet[];
    activeIndex: number;
    onChange: (nextIndex: number) => void;
    style?: CSSProperties;
};

export default function SheetTabs({ sheets, activeIndex, onChange, style }: Props) {
    if (!sheets || sheets.length === 0) return null;

    const BAR_BG = "rgb(248, 248, 248)";
    const ACTIVE_BG = "rgb(255,255,255)"; // bar보다 조금 밝게
    const ACTIVE_ACCENT = "#1d4ed8";
    const ACTIVE_ACCENT_BG = "#dadfee";
    const INACTIVE_ACCENT = "#e5e5e5";
    const INACTIVE_ACCENT_BG = "#dcdcdc";

    return (
        <div
            style={{
                backgroundColor: BAR_BG,
                borderBottom: "1px solid #bdc2c9",
                height: 30,
                padding: "0 10px",
                display: "flex",
                alignItems: "stretch",
                overflowX: "auto",
                overflowY: "hidden",
                ...style,
            }}
        >
            {sheets.map((s, i) => {
                const active = i === activeIndex;
                const label = (s.name && String(s.name).trim()) ? String(s.name) : `Sheet ${i + 1}`;
                const count = Array.isArray(s.content) ? s.content.length : 0;
                return (
                    <div
                        key={`${label}\u0000${i}`}
                        onClick={() => onChange(i)}
                        style={{
                            fontSize: 12,
                            height: 30,
                            padding: "0 18px",
                            lineHeight: "30px",
                            borderBottom: "none",
                            borderRadius: 0,
                            appearance: "none",
                            WebkitAppearance: "none",
                            backgroundColor: active ? ACTIVE_BG : "transparent",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            outline: "none",
                            boxSizing: "border-box",
                            // 버튼처럼 보이지 않게
                            // border-bottom을 쓰면 높이가 늘 수 있어서(스크롤바 발생) inset 라인으로 표시한다
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
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <span>{label}</span>
                            <span
                                style={{
                                    height:'18px',
                                    lineHeight:'19px',
                                    padding:'0 3px',
                                    borderRadius : '5px',
                                    fontSize: 11,
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

