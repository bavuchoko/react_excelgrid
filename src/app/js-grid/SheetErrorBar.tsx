import { useMemo, useState, type CSSProperties } from "react";
import type { SheetErrorFocusTarget } from "../type/Type.ts";
import SheetErrorBadgeIcon from "./SheetErrorBadgeIcon.tsx";
import {
    getSheetErrorBadgeStyles,
    parseSheetErrors,
    type SheetErrorCategory,
} from "./sheetErrors.ts";

type Props = {
    errors: unknown;
    /** 시트 전환 시 배지별 순환 인덱스 리셋용. */
    sheetName: string | null;
    /** 배지 클릭 시 해당 셀로 포커스 이동. */
    onFocusCell?: (target: SheetErrorFocusTarget) => void;
};

const BAR_BORDER = "#bdc2c9";
const BAR_HEIGHT = 30;

/** 배지 `key` 용 — 에러 목록이 바뀌면 순환 인덱스를 0부터 다시 시작. */
function categoryTargetsSignature(category: SheetErrorCategory): string {
    return category.columns
        .map((col) => `${col.columnName}=[${col.rows.slice().sort((a, b) => a - b).join(",")}]`)
        .join("|");
}

/** 카테고리 내 모든 에러 셀을 컬럼 순서 → 행 번호 오름차순으로 평탄화. */
function buildCategoryFocusTargets(category: SheetErrorCategory): SheetErrorFocusTarget[] {
    const out: SheetErrorFocusTarget[] = [];
    for (const col of category.columns) {
        const sortedRows = col.rows.slice().sort((a, b) => a - b);
        for (const rowIndex of sortedRows) {
            out.push({ columnName: col.columnName, rowIndex });
        }
    }
    return out;
}

function CategoryBadge({
    category,
    onFocusCell,
}: {
    category: SheetErrorCategory;
    onFocusCell?: (target: SheetErrorFocusTarget) => void;
}) {
    const targets = useMemo(() => buildCategoryFocusTargets(category), [category]);
    const [cycleIndex, setCycleIndex] = useState(0);

    const hasErrors = targets.length > 0;
    const clickable = Boolean(onFocusCell && hasErrors);
    const badgeStyles = getSheetErrorBadgeStyles(category.key, hasErrors);
    const safeIndex = targets.length > 0 ? cycleIndex % targets.length : 0;
    const nextTarget = targets[safeIndex];

    const tooltip = hasErrors
        ? [
              clickable && nextTarget
                  ? `클릭: ${nextTarget.columnName} ${nextTarget.rowIndex + 1}행 (${safeIndex + 1}/${targets.length})`
                  : null,
              ...category.columns.map((c) => `${c.columnName}: ${c.count}건`),
          ]
              .filter(Boolean)
              .join("\n")
        : undefined;

    const handleClick = () => {
        if (!clickable || !nextTarget) return;
        onFocusCell?.(nextTarget);
        setCycleIndex((i) => (i + 1) % targets.length);
    };

    const handleKey = (e: React.KeyboardEvent<HTMLSpanElement>) => {
        if (!clickable) return;
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
        }
    };

    return (
        <span
            className="js-grid-sheet-error-badge"
            data-category={category.key}
            tabIndex={clickable ? 0 : undefined}
            role={clickable ? "button" : undefined}
            title={tooltip}
            onClick={clickable ? handleClick : undefined}
            onKeyDown={handleKey}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "2px 8px 2px 4px",
                borderRadius: 6,
                fontSize: 12,
                lineHeight: 1,
                whiteSpace: "nowrap",
                cursor: clickable ? "pointer" : category.count > 0 ? "help" : "default",
                outline: "none",
                flexShrink: 0,
                ...badgeStyles.container,
            }}
        >
            <SheetErrorBadgeIcon
                letter={category.letter}
                color={category.color}
                bg={category.bg}
            />
            <span style={{ ...badgeStyles.text }}>{category.label}</span>
            <span style={{ ...badgeStyles.text }}>({category.count})</span>
        </span>
    );
}

function dotStyle(color: string): CSSProperties {
    return {
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: color,
        flexShrink: 0,
    };
}

function emptyBarStyle(): CSSProperties {
    return {
        flex: "0 0 auto",
        flexShrink: 0,
        height: BAR_HEIGHT,
        borderTop: `1px solid ${BAR_BORDER}`,
        backgroundColor: "#f8f8f8",
        padding: "0 12px",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 8,
        userSelect: "none",
        fontSize: 12,
        lineHeight: 1,
    };
}

/**
 * 그리드 하단 시트 오류 정보 바.
 *
 * - 카테고리별 배지 클릭 시 해당 카테고리 오류 셀을 순서대로 순환하며 포커스(`onFocusCell`).
 * - 같은 배지를 다시 누르면 다음 오류로, 마지막 다음에는 처음으로 돌아간다.
 */
export default function SheetErrorBar(props: Props) {
    const breakdown = useMemo(() => parseSheetErrors(props.errors), [props.errors]);
    const { structured, categories, totalCount, flatMessages } = breakdown;
    const hasErrors = structured ? totalCount > 0 : flatMessages.length > 0;

    if (!structured && !hasErrors) {
        return (
            <div className="js-grid-sheet-error-bar" style={emptyBarStyle()}>
                <span aria-hidden style={dotStyle("#10b981")} />
                <span style={{ color: "#6b7280", fontWeight: 600, fontSize: 12 }}>
                    오류 없음
                </span>
            </div>
        );
    }

    return (
        <div
            className="js-grid-sheet-error-bar"
            style={{
                flex: "0 0 auto",
                flexShrink: 0,
                height: BAR_HEIGHT,
                borderTop: `1px solid ${BAR_BORDER}`,
                backgroundColor: "#f8f8f8",
                padding: "0 12px",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                gap: 8,
                userSelect: "none",
                fontSize: 12,
                lineHeight: 1,
            }}
        >
            {structured ? (
                <div
                    style={{
                        flex: "1 1 auto",
                        minWidth: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        overflowX: "auto",
                        overflowY: "hidden",
                        scrollbarWidth: "thin",
                    }}
                >
                    {categories.map((c) => (
                        <CategoryBadge
                            key={`${props.sheetName ?? ""}-${c.key}-${categoryTargetsSignature(c)}`}
                            category={c}
                            onFocusCell={props.onFocusCell}
                        />
                    ))}
                </div>
            ) : (
                <>
                    <span aria-hidden style={dotStyle("#dc2626")} />
                    <span style={{ color: "#7f1d1d", fontWeight: 600, flexShrink: 0 }}>
                        오류 {flatMessages.length}건
                    </span>
                    <span
                        title={flatMessages[0]}
                        style={{
                            flex: "1 1 auto",
                            minWidth: 0,
                            color: "#7f1d1d",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            marginLeft: 4,
                        }}
                    >
                        {flatMessages[0]}
                    </span>
                </>
            )}
        </div>
    );
}
