import {useId} from "react";
import type {CSSProperties, MouseEvent, ReactNode, RefObject} from "react";
import Fields from "../resources/icon/Fields.tsx";
import Expand from "../resources/icon/Expand.tsx";
import Shrink from "../resources/icon/Shrink.tsx";
import {ToolbarHint} from "@bavuchoko/js-tooltip";
import ColumnLock from "../resources/icon/ColumnLock.tsx";

type Props = {
    fieldsBtnRef: RefObject<HTMLDivElement | null>;
    onToggleFieldsMenu: (e: MouseEvent) => void;
    onEnterPseudoFullscreen: () => void;
    /** 축소 버튼 — `onClose`가 있으면 그리드는 `onExitPseudoFullscreen`에서 처리한다. */
    onExitPseudoFullscreen: () => void;
    isPseudoFullscreen: boolean;
    enablePseudoFullscreen?: boolean;
    /** `onClose` 전달 시 축소 버튼 툴팁(기본: "전체 화면 종료"). */
    exitPseudoFullscreenHint?: string;
    /** 컬럼(필드) 메뉴 버튼 표시 여부(기본 `true`). */
    showColumnFieldsMenu?: boolean;
    /** 컬럼 저장·초기화 API 처리 중일 때 필드 아이콘 로딩 표시 */
    fieldsBusy?: boolean;
    fieldsBusyLabel?: string;
    toolbarStart?: ReactNode;
    toolbarEnd?: ReactNode;
    style?: CSSProperties;
};

export default function JsGridToolbar({
    fieldsBtnRef,
    onToggleFieldsMenu,
    onEnterPseudoFullscreen,
    onExitPseudoFullscreen,
    isPseudoFullscreen,
    enablePseudoFullscreen,
    exitPseudoFullscreenHint = "전체 화면 종료",
    showColumnFieldsMenu = true,
    fieldsBusy,
    fieldsBusyLabel,
    toolbarStart,
    toolbarEnd,
    style,
}: Props) {
    const showPseudoFullscreen = enablePseudoFullscreen !== false;
    const fieldsSpinClass = useId().replace(/:/g, "");

    return (
        <div
            className="js-grid-toolbar"
            style={{
                backgroundColor: '#f8f8f8',
                padding: '6px 12px',
                borderBottom: '1px solid #bdc2c9',
                userSelect: "none",
                cursor: "default",
                flexShrink: 0,
                ...style,
            }}
        >
            <style>{`
                @keyframes jsgrid-toolbar-spin-${fieldsSpinClass} {
                    to { transform: rotate(360deg); }
                }
                .jsgrid-toolbar-spin-dot-${fieldsSpinClass} {
                    animation: jsgrid-toolbar-spin-${fieldsSpinClass} 0.75s linear infinite;
                }
            `}</style>
            <div
                className="js-grid-toolbar-inner"
                style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}
            >
                <div
                    className="js-grid-toolbar-start"
                    style={{display: 'flex', alignItems: 'center', gap: 10}}
                >
                    <ToolbarHint text="틀 고정 : alt + 헤더 클릭">
                        <ColumnLock style={{width: '18px', cursor: 'default', opacity: 0.75}}/>
                    </ToolbarHint>
                    {toolbarStart ? (
                        <div className="js-grid-toolbar-custom js-grid-toolbar-custom-start">
                            {toolbarStart}
                        </div>
                    ) : null}
                </div>

                <div
                    className="js-grid-toolbar-actions"
                    style={{display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'end'}}
                >
                    {toolbarEnd ? (
                        <div className="js-grid-toolbar-custom js-grid-toolbar-custom-end">
                            {toolbarEnd}
                        </div>
                    ) : null}

                    {showColumnFieldsMenu ? (
                        <>
                            <div
                                className="js-grid-toolbar-divider"
                                aria-hidden
                                style={{
                                    borderLeft: "1px solid #bdc2c9",
                                    height: 16,
                                    margin: "0 2px",
                                    flexShrink: 0,
                                    alignSelf: "center",
                                }}
                            />
                            <div
                                ref={fieldsBtnRef}
                                style={{display: "inline-flex", alignItems: "center"}}
                            >
                                <ToolbarHint
                                    text={
                                        fieldsBusy && fieldsBusyLabel
                                            ? fieldsBusyLabel
                                            : "컬럼 보이기/숨기기 및 순서 변경"
                                    }
                                >
                                    <div
                                        style={{
                                            position: "relative",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            width: 18,
                                            height: 18,
                                            cursor: fieldsBusy ? "wait" : "pointer",
                                        }}
                                        onClick={(e) => {
                                            if (fieldsBusy) {
                                                e.stopPropagation();
                                                return;
                                            }
                                            onToggleFieldsMenu(e);
                                        }}
                                    >
                                        <Fields
                                            style={{
                                                width: "18px",
                                                cursor: fieldsBusy ? "wait" : "pointer",
                                                opacity: fieldsBusy ? 0.35 : 1,
                                                flexShrink: 0,
                                            }}
                                            aria-busy={fieldsBusy ?? false}
                                            aria-live={fieldsBusy ? "polite" : undefined}
                                        />
                                        {fieldsBusy ? (
                                            <span
                                                className={`jsgrid-toolbar-spin-dot-${fieldsSpinClass}`}
                                                style={{
                                                    position: "absolute",
                                                    inset: 0,
                                                    margin: "auto",
                                                    width: 14,
                                                    height: 14,
                                                    borderRadius: "50%",
                                                    border: "2px solid #e5e7eb",
                                                    borderTopColor: "#2563eb",
                                                    boxSizing: "border-box",
                                                    pointerEvents: "none",
                                                }}
                                                aria-hidden
                                            />
                                        ) : null}
                                    </div>
                                </ToolbarHint>
                            </div>
                        </>
                    ) : null}

                    {showPseudoFullscreen && (
                        isPseudoFullscreen ? (
                            <ToolbarHint text={exitPseudoFullscreenHint}>
                                <Shrink
                                    style={{width: '18px', cursor: 'pointer'}}
                                    onClick={onExitPseudoFullscreen}
                                />
                            </ToolbarHint>
                        ) : (
                            <ToolbarHint text="전체 화면">
                                <Expand
                                    style={{width: '18px', cursor: 'pointer'}}
                                    onClick={onEnterPseudoFullscreen}
                                />
                            </ToolbarHint>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
