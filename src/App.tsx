import {
    JsExcelGrid,
    applyHeaderStateToExcelGridData,
    removeRowsByIdsFromExcelGridData,
} from "./app/index.ts";
import type { ExcelGridData, SheetHeaderSavePayload } from "./app/index.ts";
import { useCallback, useState } from "react";
import { SAMPLE_DATA } from "./testData.ts";

const App = () => {
    const [data, setData] = useState<ExcelGridData>(SAMPLE_DATA);

    // api요청 테스트용 헤더 저장 메서드
    const headerApi = useCallback(async (payload: SheetHeaderSavePayload) => {
        console.log("header 저장 요청", payload.sheetName, payload.headers.length, "건");
        await new Promise((r) => setTimeout(r, 150));
    }, []);

    //api요청 테스트용 삭제 메서드
    const deleteApi = (ids: number[]) =>
        new Promise<void>((resolve) => {
            console.log("delete 요청", ids);
            window.setTimeout(() => resolve(), 1000);
        });

    const onHeaderSave = useCallback(
        async (payload: SheetHeaderSavePayload) => {
            // 실제 연동 시 아래 headerApi 구현만 교체하면 된다.
            await headerApi(payload);

            setData((prev) => applyHeaderStateToExcelGridData({ data: prev, payload }));
        },
        [headerApi],
    );

    const onUploadFiles = useCallback(async (files: File[]) => {
        await new Promise((r) => setTimeout(r, 1500));
        console.log(
            "업로드 완료 샘플",
            files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
        );
    }, []);

    const onHeaderReset = useCallback(() => console.log("reset clicked"), []);
    const onDownloadClick = useCallback(() => console.log("download Clicked"), []);

    const onDeleteClick = useCallback(async (rows: unknown[]) => {
        // 테스트 데이터의 id 는 문자열("177") 형태이므로 number 로 변환 후 사용한다.
        const ids = rows
            .map((r) => {
                const v = (r as { id?: unknown }).id;
                if (typeof v === "number") return v;
                if (typeof v === "string") {
                    const n = Number(v);
                    return Number.isFinite(n) ? n : null;
                }
                return null;
            })
            .filter((id): id is number => id != null && Number.isFinite(id));

        if (ids.length === 0) return;
        await deleteApi(ids);

        setData((prev) => removeRowsByIdsFromExcelGridData({ data: prev, ids }));
    }, []);

    const onRowClick = useCallback((row: unknown) => console.log("rowClick", row), []);

    return (
        <div>
            <div style={{ width: "1100px", height: "640px", display: "flex", flexDirection: "column", background: "red" }}>
                <JsExcelGrid
                    data={data}
                    onHeaderSave={onHeaderSave}
                    onUploadFiles={onUploadFiles}
                    onHeaderReset={onHeaderReset}
                    onDownloadClick={onDownloadClick}
                    onDeleteClick={onDeleteClick}
                    onRowClick={onRowClick}
                />
            </div>
        </div>
    );
};

export default App;
