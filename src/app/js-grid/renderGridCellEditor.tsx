import React, { isValidElement, type ReactNode } from "react";
import type { GridCellEditor, GridCellEditorArgs } from "../type/Type.ts";

/**
 * `Header.editor` / `JsGridTableColumn.editor` 를 렌더링한다.
 * - 함수형이면 그대로 호출.
 * - JSX/ReactNode 이면 `row`, `value`, `columnKey`, `rowIndex`, `onChange`, `onClose`,
 *   `stopRowClick` props 를 주입해 cloneElement.
 */
export function renderGridCellEditor(
    editor: GridCellEditor,
    args: GridCellEditorArgs,
): ReactNode {
    if (typeof editor === "function") {
        return editor(args);
    }
    if (isValidElement(editor)) {
        return React.cloneElement(
            editor as React.ReactElement<Record<string, unknown>>,
            {
                row: args.row,
                value: args.value,
                columnKey: args.columnKey,
                rowIndex: args.rowIndex,
                onChange: args.onChange,
                onClose: args.onClose,
                stopRowClick: args.stopRowClick,
            },
        );
    }
    return editor;
}
