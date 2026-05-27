/** `toolbarStart` / `toolbarEnd` render prop에서 받는 API */
export type ToolbarBodyOverlay = {
    label: string;
    accent?: string;
};

export type JsGridToolbarApi = {
    /**
     * Promise가 끝날 때까지 그리드 본문 블러·오버레이를 표시한다.
     * 아이콘 스피너는 `ToolbarAsyncAction` 등에서 따로 처리한다.
     */
    runToolbarAction: (
        label: string,
        action: () => void | Promise<void>,
        accent?: string,
    ) => Promise<void>;
    /** 본문 블러·오버레이만 직접 켜기/끄기 */
    setBodyOverlay: (overlay: ToolbarBodyOverlay | null) => void;
};
