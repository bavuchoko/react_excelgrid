import type {CSSProperties, MouseEvent, RefObject} from "react";
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
    onUploadClick?: () => void;
    /** 선택된 행 삭제(콜백은 부모에서 `onDelete`와 연결) */
    onTrashClick?: () => void;
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
    onUploadClick,
    onTrashClick,
    trashDisabled,
    style,
}: Props) {
    const showPseudoFullscreen = enablePseudoFullscreen !== false;

    return (
        <div style={{backgroundColor:'#f8f8f8', padding: '6px 12px', borderBottom: `1px solid #bdc2c9`, ...style}}>
            <div style={{display: 'flex', alignItems:'center', justifyContent:'space-between'}}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ToolbarHint text="틀 고정 : alt + 헤더 클릭">
                        <ColumnLock style={{ width: '18px', cursor: 'default', opacity: 0.75 }} />
                    </ToolbarHint>
                </div>

                <div style={{display: 'flex', alignItems:'center', gap:'16px', justifyContent:'end'}}>

                {(onUploadClick || onDownLoadClick) && (
                    <>
                        {onUploadClick && (
                            <ToolbarHint text="업로드">
                                <Upload
                                    style={{width: '18px', cursor: 'pointer'}}
                                    onClick={() => onUploadClick()}
                                />
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
                        <ToolbarHint text={trashDisabled ? "삭제할 행을 선택하세요" : "선택 항목 삭제"}>
                            <Trash
                                style={{
                                    width: '18px',
                                    cursor: trashDisabled ? 'not-allowed' : 'pointer',
                                    opacity: trashDisabled ? 0.45 : 1,
                                }}
                                onClick={() => {
                                    if (trashDisabled) return;
                                    onTrashClick();
                                }}
                            />
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

