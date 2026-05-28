import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { ToolbarHint } from "@bavuchoko/js-tooltip";
import { useJsGridToolbar } from "./JsGridToolbarContext.tsx";

function yieldToPaint(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => resolve());
    });
}

type Props = {
    /** 클릭 시 실행. `Promise`가 resolve/reject 될 때까지 로딩 표시 */
    onClick: () => void | Promise<void>;
    /** 툴팁(대기 중이면 `busyHint` 우선) */
    hint?: string;
    busyHint?: string;
    /**
     * 지정 시 `JsExcelGrid` 본문 블러·「…」 오버레이도 함께 표시한다.
     * (`toolbarStart={(api) => ...}` 또는 `toolbarEnd` 함수형 슬롯 안에서 사용)
     */
    overlayLabel?: string;
    /** 본문 오버레이 스피너 색 (`#2563eb` 기본) */
    accentColor?: string;
    disabled?: boolean;
    children: ReactNode;
    style?: CSSProperties;
};

/**
 * 커스텀 툴바 아이콘·버튼용. `onClick`이 `Promise`를 반환하면
 * 다운로드·업로드와 같은 아이콘 위 스피너를 표시한다.
 */
export default function ToolbarAsyncAction({
    onClick,
    hint,
    busyHint,
    overlayLabel,
    accentColor = "#2563eb",
    disabled,
    children,
    style,
}: Props) {
    const toolbarApi = useJsGridToolbar();
    const [busy, setBusy] = useState(false);
    const spinClass = useId().replace(/:/g, "");

    const handleClick = async () => {
        if (disabled || busy) return;
        setBusy(true);
        await yieldToPaint();
        try {
            if (overlayLabel && toolbarApi) {
                await toolbarApi.runToolbarAction(overlayLabel, onClick, accentColor);
            } else {
                await Promise.resolve(onClick());
            }
            await Promise.resolve(toolbarApi?.refresh?.());
        } finally {
            setBusy(false);
        }
    };

    const tooltip = busy && busyHint ? busyHint : hint;

    const control = (
        <div
            style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 18,
                height: 18,
                cursor: disabled || busy ? "wait" : "pointer",
                ...style,
            }}
            onClick={() => void handleClick()}
            role={hint ? undefined : "button"}
            tabIndex={hint ? undefined : disabled || busy ? -1 : 0}
            onKeyDown={
                hint
                    ? undefined
                    : (e) => {
                          if (disabled || busy) return;
                          if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              void handleClick();
                          }
                      }
            }
            aria-busy={busy}
            aria-disabled={disabled || busy}
        >
            <style>{`
                @keyframes jsgrid-toolbar-custom-spin-${spinClass} {
                    to { transform: rotate(360deg); }
                }
                .jsgrid-toolbar-custom-spin-${spinClass} {
                    animation: jsgrid-toolbar-custom-spin-${spinClass} 0.75s linear infinite;
                }
            `}</style>
            <span
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: busy ? 0.35 : 1,
                    lineHeight: 0,
                }}
            >
                {children}
            </span>
            {busy ? (
                <span
                    className={`jsgrid-toolbar-custom-spin-${spinClass}`}
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

    if (tooltip) {
        return <ToolbarHint text={tooltip}>{control}</ToolbarHint>;
    }

    return control;
}
