export type {
    Content,
    ExcelGridData,
    GridType,
    Header,
    HeaderState,
    Sheet,
    SheetHeaderSavePayload,
} from "./type/Type.ts";

/** `JsExcelGrid`에 넘기는 props — `GridType`과 동일 */
export type { GridType as JsExcelGridProps } from "./type/Type.ts";

export { default as JsExcelGrid } from "./JsExcelGrid.tsx";

export { applyHeaderStateToHeader } from "./utils/applyHeaderState.ts";

