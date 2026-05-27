import { createContext, useContext, type ReactNode } from "react";
import type { JsGridToolbarApi } from "./jsGridToolbarApi.ts";

const JsGridToolbarContext = createContext<JsGridToolbarApi | null>(null);

export function JsGridToolbarProvider({
    value,
    children,
}: {
    value: JsGridToolbarApi;
    children: ReactNode;
}) {
    return (
        <JsGridToolbarContext.Provider value={value}>{children}</JsGridToolbarContext.Provider>
    );
}

/** `JsExcelGrid` 내부 `toolbarStart` / `toolbarEnd` render prop 또는 자식에서 사용 */
export function useJsGridToolbar(): JsGridToolbarApi | null {
    return useContext(JsGridToolbarContext);
}
