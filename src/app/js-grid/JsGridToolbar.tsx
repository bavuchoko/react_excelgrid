import type {CSSProperties, MouseEvent, RefObject} from "react";
import {useId} from "react";
import Fields from "../resources/icon/Fields.tsx";
import Expand from "../resources/icon/Expand.tsx";
import Shrink from "../resources/icon/Shrink.tsx";
import Trash from "../resources/icon/Trash.tsx";
import {ToolbarHint} from "@bavuchoko/js-tooltip";
import DownLoad from "../resources/icon/DownLoad.tsx";
import Upload from "../resources/icon/Upload.tsx";
import ColumnLock from "../resources/icon/ColumnLock.tsx";

type Props = {
    fieldsBtnRef: RefObject<HTMLDivElement | null>;
    onToggleFieldsMenu: (e: MouseEvent) => void;
    onTogglePseudoFullscreen: () => void;
    isPseudoFullscreen: boolean;
    enablePseudoFullscreen?: boolean;
    onDownLoadClick?: () => void;
    uploadBtnRef?: RefObject<HTMLDivElement | null>;
    /** 업로드 아이콘 클릭 — 부모에서 첨부 패널 표시 여부 등 처리 */
    onToggleUploadPanel?: (e: MouseEvent) => void;
    /** 패널에서 업로드 요청 처리 중일 때 툴바에 로딩 표시 */
    uploadBusy?: boolean;
    /** 삭제 API 응답 대기 중 휴지통 로딩 표시 */
    deleteBusy?: boolean;
    /** 선택된 행 삭제(콜백은 부모에서 `onDelete`와 연결) */
    onTrashClick?: () => void | Promise<void>;
    trashDisabled?: boolean;
    style?: CSSProperties;
};

export default function JsGridToolbar({
    fieldsBtnRef,
    onToggleFieldsMenu,
    onTogglePseudoFullscreen,
    isPseudoFullscreen,
    enablePseudoFullscreen,
    onDownLoadClick,
    uploadBtnRef,
    onToggleUploadPanel,
    uploadBusy,
    deleteBusy,
    onTrashClick,
    trashDisabled,
    style,
}: Props) {
    const showPseudoFullscreen = enablePseudoFullscreen !== false;
    const uploadSpinClass = useId().replace(/:/g, "");

    return (
        <div style={{backgroundColor:'#f8f8f8', padding: '6px 12px', borderBottom: `1px solid #bdc2c9`, userSelect: "none", cursor: "default", ...style}}>
            <style>{`
                @keyframes jsgrid-toolbar-spin-${uploadSpinClass} {
                    to { transform: rotate(360deg); }
                }
                .jsgrid-toolbar-spin-dot-${uploadSpinClass} {
                    animation: jsgrid-toolbar-spin-${uploadSpinClass} 0.75s linear infinite;
                }
            `}</style>
            <div style={{display: 'flex', alignItems:'center', justifyContent:'space-between'}}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ToolbarHint text="틀 고정 : alt + 헤더 클릭">
                        <ColumnLock style={{ width: '18px', cursor: 'default', opacity: 0.75 }} />
                    </ToolbarHint>
                </div>

                <div style={{display: 'flex', alignItems:'center', gap:'16px', justifyContent:'end'}}>

                {(onToggleUploadPanel || onDownLoadClick) && (
                    <>
                        {onToggleUploadPanel && uploadBtnRef && (
                            <ToolbarHint text={uploadBusy ? "업로드 중…" : "업로드"}>
                                <div
                                    ref={uploadBtnRef}
                                    style={{
                                        position: "relative",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: 18,
                                        height: 18,
                                        cursor: uploadBusy ? "wait" : "pointer",
                                    }}
                                    onClick={(e) => {
                                        if (uploadBusy) {
                                            e.stopPropagation();
                                            return;
                                        }
                                        onToggleUploadPanel(e);
                                    }}
                                >
                                    <Upload
                                        style={{
                                            width: "18px",
                                            cursor: uploadBusy ? "wait" : "pointer",
                                            opacity: uploadBusy ? 0.35 : 1,
                                            flexShrink: 0,
                                        }}
                                        aria-busy={uploadBusy ?? false}
                                        aria-live={uploadBusy ? "polite" : undefined}
                                    />
                                    {uploadBusy ? (
                                        <span
                                            className={`jsgrid-toolbar-spin-dot-${uploadSpinClass}`}
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
                        )}
                        {onDownLoadClick && (
                            <ToolbarHint text="다운로드">
                                <DownLoad
                                    style={{width: '18px', cursor: 'pointer'}}
                                    onClick={() => onDownLoadClick()}
                                />
                            </ToolbarHint>
                        )}


                    </>
                )}

                {onTrashClick && (
                    <>
                        <ToolbarHint
                            text={
                                deleteBusy
                                    ? "삭제 중…"
                                    : trashDisabled
                                      ? "삭제할 행을 선택하세요"
                                      : "선택 항목 삭제"
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
                                    cursor:
                                        deleteBusy || uploadBusy ? "wait" : trashDisabled ? "not-allowed" : "pointer",
                                }}
                                onClick={(e) => {
                                    if (trashDisabled || uploadBusy) {
                                        e.stopPropagation();
                                        return;
                                    }
                                    void Promise.resolve(onTrashClick());
                                }}
                            >
                                <Trash
                                    style={{
                                        width: "18px",
                                        cursor:
                                            deleteBusy || uploadBusy
                                                ? "wait"
                                                : trashDisabled
                                                  ? "not-allowed"
                                                  : "pointer",
                                        opacity:
                                            deleteBusy || uploadBusy ? 0.35 : trashDisabled ? 0.45 : 1,
                                    }}
                                    aria-busy={Boolean(deleteBusy)}
                                    aria-live={deleteBusy ? "polite" : undefined}
                                />
                                {deleteBusy ? (
                                    <span
                                        className={`jsgrid-toolbar-spin-dot-${uploadSpinClass}`}
                                        style={{
                                            position: "absolute",
                                            inset: 0,
                                            margin: "auto",
                                            width: 14,
                                            height: 14,
                                            borderRadius: "50%",
                                            border: "2px solid #e5e7eb",
                                            borderTopColor: "#ef4444",
                                            boxSizing: "border-box",
                                            pointerEvents: "none",
                                        }}
                                        aria-hidden
                                    />
                                ) : null}
                            </div>
                        </ToolbarHint>

                    </>
                )}
                <div style={{borderLeft:'1px solid rgb(189, 194, 201)', height:'16px', margin:'0 2px'}} />
                <div ref={fieldsBtnRef} style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <ToolbarHint text="컬럼 보이기/숨기기 및 순서 변경">
                        <div
                            style={{ display: 'inline-flex', alignItems: 'center' }}
                            onClick={onToggleFieldsMenu}
                        >
                            <Fields style={{width:'18px', cursor: 'pointer'}}/>
                        </div>
                    </ToolbarHint>
                </div>

                {showPseudoFullscreen && (
                    isPseudoFullscreen ? (
                        <ToolbarHint text="전체 화면 종료">
                            <Shrink
                                style={{width:'18px', cursor: 'pointer'}}
                                onClick={onTogglePseudoFullscreen}
                            />
                        </ToolbarHint>
                    ) : (
                        <ToolbarHint text="전체 화면">
                            <Expand
                                style={{width:'18px', cursor: 'pointer'}}
                                onClick={onTogglePseudoFullscreen}
                            />
                        </ToolbarHint>
                    )
                )}
                </div>
            </div>
        </div>
    );
}

