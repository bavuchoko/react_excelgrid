export type {
    Content,
    DataType,
    ExcelGridData,
    GridCellChangeEvent,
    GridCellEditEvent,
    GridCellEditor,
    GridCellEditorArgs,
    GridCellPasteBatch,
    GridCellPasteItem,
    GridCellRenderArgs,
    GridType,
    Header,
    HeaderState,
    JsGridTableHandle,
    JsGridToolbarSlot,
    Sheet,
    SheetBody,
    SheetCellChangeEvent,
    SheetCellPasteBatch,
    SheetCellPasteItem,
    SheetErrorFocusTarget,
    SheetHeaderSavePayload,
} from "./type/Type.ts";

/** `JsExcelGrid`에 넘기는 props — `GridType`과 동일 */
export type { GridType as JsExcelGridProps } from "./type/Type.ts";

export type { JsGridToolbarApi, ToolbarBodyOverlay } from "./js-grid/jsGridToolbarApi.ts";
export type { JsGridRowSelectionApi } from "./js-grid/JsGridRowSelectionContext.tsx";
export type { ToolbarDataTransferContext } from "./js-grid/ToolbarDataTransfer.tsx";

export { default as JsExcelGrid } from "./JsExcelGrid.tsx";
export { default as ToolbarAsyncAction } from "./js-grid/ToolbarAsyncAction.tsx";
export { default as ToolbarDataTransfer } from "./js-grid/ToolbarDataTransfer.tsx";
export {
    parseSheetErrors,
    hasSheetErrors,
    formatSheetErrorRowList,
    buildSheetCellErrorLookup,
    mergeSheetErrorCellStyles,
    getSheetErrorBadgeStyles,
    type SheetErrorBreakdown,
    type SheetErrorCategory,
    type SheetErrorCategoryKey,
    type SheetErrorColumnEntry,
    type SheetCellErrorLookup,
    type SheetErrorBadgeStyles,
} from "./js-grid/sheetErrors.ts";
export { useJsGridToolbar } from "./js-grid/JsGridToolbarContext.tsx";
export { useJsGridRowSelection } from "./js-grid/JsGridRowSelectionContext.tsx";

export { MODIFIED_CELL_BG, areCellValuesEqual, isCellModifiedFromBaseline } from "./js-grid/cellModified.ts";

export {
    applyHeaderStateToHeader,
    applyHeaderStateToExcelGridData,
} from "./utils/applyHeaderState.ts";
export {
    removeRowsFromExcelGridData,
    removeRowsByIdsFromExcelGridData,
    type RemoveRowsByIdsFromExcelGridDataArgs,
    type RemoveRowsFromExcelGridDataArgs,
} from "./utils/removeRowsFromExcelGridData.ts";
export { applySheetCellEdit, applySheetCellsPaste } from "./utils/applySheetCellEdits.ts";
