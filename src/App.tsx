import { JsExcelGrid } from "./app/index.ts";
import type {
    ExcelGridData,
    GridCellEditorArgs,
    Header,
} from "./app/index.ts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JsExcelGridHandle } from "./app/index.ts";
import { SAMPLE_DATA } from "./testData.ts";

/** 텍스트 셀 편집기 — Enter 또는 blur 시 값 적용. */
function TextCellEditor(args: GridCellEditorArgs) {
    const initial = args.value == null ? "" : String(args.value);
    const [draft, setDraft] = useState(initial);
    const ref = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.focus();
        el.select();
    }, []);

    const commit = useCallback(
        (close: boolean) => {
            if (draft !== initial) args.onChange(draft, { close });
            else if (close) args.onClose();
        },
        [draft, initial, args],
    );

    return (
        <input
            ref={ref}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
                args.stopRowClick(e);
                if (e.key === "Enter") {
                    e.preventDefault();
                    commit(true);
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    args.onClose();
                }
            }}
            onBlur={() => commit(true)}
            onPointerDown={args.stopRowClick}
            style={{
                width: "100%",
                height: "100%",
                minWidth: 0,
                boxSizing: "border-box",
                border: "none",
                outline: "none",
                background: "transparent",
                font: "inherit",
                padding: 0,
                margin: 0,
            }}
        />
    );
}

/** 셀렉트 셀 편집기 — 옵션 선택 즉시 값 적용 & 편집기 닫기. */
function SelectCellEditor(props: GridCellEditorArgs & { options: readonly string[] }) {
    const { options, ...args } = props;
    const initial = args.value == null ? "" : String(args.value);
    return (
        <select
            autoFocus
            defaultValue={initial}
            onChange={(e) => args.onChange(e.target.value, { close: true })}
            onKeyDown={(e) => {
                args.stopRowClick(e);
                if (e.key === "Escape") args.onClose();
            }}
            onBlur={() => args.onClose()}
            onPointerDown={args.stopRowClick}
            style={{
                width: "100%",
                height: "100%",
                minWidth: 0,
                boxSizing: "border-box",
                border: "none",
                outline: "none",
                background: "transparent",
                font: "inherit",
            }}
        >
            <option value="">(선택 없음)</option>
            {options.map((o) => (
                <option key={o} value={o}>
                    {o}
                </option>
            ))}
        </select>
    );
}

const SLA_OPTIONS = ["1등급", "2등급", "3등급"] as const;

/** 시트별로 일부 컬럼에 편집기를 주입한 사본을 반환한다. */
function withDemoEditors(data: ExcelGridData): ExcelGridData {
    const next: ExcelGridData = {};
    for (const [sheetName, body] of Object.entries(data)) {
        const headers: Header[] = body.headers.map((h) => {
            if (h.key === "assetName") {
                return { ...h, editor: (args) => <TextCellEditor {...args} />, filterable: true };
            }
            if (h.key === "slaGroup") {
                return {
                    ...h,
                    filterable: true,
                    editor: (args) => (
                        <SelectCellEditor {...args} options={SLA_OPTIONS} />
                    ),
                };
            }
            if (h.key === "task" || h.key === "department" || h.key === "location") {
                return { ...h, filterable: true };
            }
            return h;
        });
        next[sheetName] = { ...body, headers };
    }
    return next;
}

const App = () => {
    const [data] = useState<ExcelGridData>(SAMPLE_DATA);
    const gridRef = useRef<JsExcelGridHandle | null>(null);
    const dataWithEditors = useMemo(() => withDemoEditors(data), [data]);

    const isAdmin = true;

    return (
        <div>

            <div onClick={() => console.log(gridRef.current?.getData())}>버튼</div>
            <div
                style={{
                    width: "1200px",
                    height: "640px",
                    display: "flex",
                    flexDirection: "column",
                    background: "red",
                }}
            >
                <JsExcelGrid
                    // fullmode={true}
                    onClose={()=>console.log(gridRef.current?.getData())}
                    ref={gridRef}
                    data={dataWithEditors}
                    editable={isAdmin}
                    resizable={true}
                    onCellChange={(v)=>console.log(v)}
                />
            </div>
        </div>
    );
};

export default App;
