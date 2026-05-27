import { createContext, useContext, type ReactNode } from "react";

/** `enableRowSelection` + `toolbarEnd`의 `ToolbarDataTransfer` 등에서 사용 */
export type JsGridRowSelectionApi = {
    selectedCount: number;
    selectedRows: unknown[];
    /** 선택 행이 없을 때 true */
    disabled: boolean;
    clearSelection: () => void;
};

const JsGridRowSelectionContext = createContext<JsGridRowSelectionApi | null>(null);

export function JsGridRowSelectionProvider({
    value,
    children,
}: {
    value: JsGridRowSelectionApi | null;
    children: ReactNode;
}) {
    return (
        <JsGridRowSelectionContext.Provider value={value}>
            {children}
        </JsGridRowSelectionContext.Provider>
    );
}

/** `enableRowSelection`이 켜진 `JsExcelGrid` 내부(툴바 슬롯 등)에서만 유효 */
export function useJsGridRowSelection(): JsGridRowSelectionApi | null {
    return useContext(JsGridRowSelectionContext);
}
