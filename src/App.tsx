import { JsExcelGrid, applyHeaderStateToExcelGridData } from "./app/index.ts";
import type {
    ExcelGridData,
    GridCellEditorArgs,
    Header,
    SheetHeaderSavePayload,
} from "./app/index.ts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
                return { ...h, editor: (args) => <TextCellEditor {...args} /> };
            }
            if (h.key === "slaGroup") {
                return {
                    ...h,
                    editor: (args) => (
                        <SelectCellEditor {...args} options={SLA_OPTIONS} />
                    ),
                };
            }
            return h;
        });
        next[sheetName] = { ...body, headers };
    }
    return next;
}

const App = () => {
    const [data, setData] = useState<ExcelGridData>(SAMPLE_DATA);
    const dataWithEditors = useMemo(() => withDemoEditors(data), [data]);

    const headerApi = useCallback(async (payload: SheetHeaderSavePayload) => {
        console.log("header 저장 요청", payload.sheetName, payload.headers.length, "건");
        await new Promise((r) => setTimeout(r, 300));
    }, []);

    const onHeaderSave = useCallback(
        async (payload: SheetHeaderSavePayload) => {
            await headerApi(payload);
            setData((prev) => applyHeaderStateToExcelGridData({ data: prev, payload }));
        },
        [headerApi],
    );

    const onHeaderReset = useCallback(async () => {
        console.log("reset clicked");
        await new Promise((r) => setTimeout(r, 300));
    }, []);

    const isAdmin = true;

    return (
        <div>
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
                    data={dataWithEditors}
                    onHeaderSave={isAdmin ? onHeaderSave : undefined}
                    onHeaderReset={onHeaderReset}
                    editable={isAdmin}
                    onCellChange={(v)=>console.log(v)}
                />
            </div>
        </div>
    );
};

export default App;
