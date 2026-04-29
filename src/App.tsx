import {
    JsExcelGrid,
    applyHeaderStateToExcelGridData,
    removeRowsByIdsFromExcelGridData
} from "./app/index.ts";
import type { ExcelGridData, Header, SheetHeaderSavePayload } from "./app/index.ts";
import { useCallback, useMemo, useState } from "react";

const PAGE_SIZE = 15;
/** 더미: 시트별 행 수(스크롤/가상화 확인용) */
const SHEET3_DUMMY_ROW_COUNT = 50;
const SHEET4_DUMMY_ROW_COUNT = 1500;

const SHEET_COUNT = 12;
const SHEET_ROW_ID_MULTIPLIER = 1_000_000;

const MyCell = (props: { value?: unknown; rowIndex?: number }) => (
  <span onClick={() => console.log(props.value)}>
    {props.rowIndex}: {String(props.value ?? "")}
  </span>
);

const App = () => {
  const pageNumber = 0;
  const header: Header[] = useMemo(
    () => [
      { key: "creator.name", label: "등록자", type: "string" },
      { key: "state", label: "진행상태", type: "state" },
      { key: "title", label: "제목", type: "string" },
      { key: "number", label: "티켓번호", type: "string" },
      { key: "createdAt", label: "등록일", type: "date" },
      { key: "requester.name", label: "요청자", type: "string" },
      { key: "score", label: "만족도", type: "score", render: <MyCell /> },
      { key: "deadLine.endBy", label: "만료일", type: "date" },
      { key: "category.name", label: "카테고리", type: "string" },
      { key: "updatedAt", label: "수정일", type: "date" },
      { key: "transTo.title", label: "이관", type: "string" },
    ],
    [],
  );

  const allRows = useMemo(
    () =>
      Array.from({ length: PAGE_SIZE }, (_, i) => ({
        id: pageNumber * PAGE_SIZE + i + 1,
        creator: { name: "등록자" },
        state: "접수중",
        title: "제목1234123123123123 어 글쎄",
        number: "203123-123",
        createdAt: "2026-01-02",
        requester: { name: "관리자" },
        score: "35",
        deadLine: { endBy: "2026-04-23" },
        category: { name: "네트워크" },
        updatedAt: "2026-01-02",
        transTo: { title: "이관정보" },
      })),
    [pageNumber],
  );

  const initialData = useMemo<ExcelGridData>(() => {
    return {
      sheets: Array.from({ length: SHEET_COUNT }, (_, i) => {
        const sheetNum = i + 1;
        const id = `sheet-${sheetNum}`;

        const rowCount =
          sheetNum === 2
            ? 0
            : sheetNum === 3
              ? SHEET3_DUMMY_ROW_COUNT
              : sheetNum === 4
                ? SHEET4_DUMMY_ROW_COUNT
                : PAGE_SIZE;
        const numPad = Math.max(3, String(rowCount).length);
        const nextContent =
          rowCount === 0
            ? []
            : Array.from({ length: rowCount }, (_, rowIdx) => {
                const r = allRows[rowIdx % allRows.length];
                return {
                  ...r,
                  id: sheetNum * SHEET_ROW_ID_MULTIPLIER + rowIdx + 1,
                  title: `Sheet ${sheetNum} · 행 ${rowIdx + 1}`,
                  number: `${100 + sheetNum}-${String(rowIdx + 1).padStart(numPad, "0")}`,
                  creator: {
                    /** 정렬 테스트용: 등록자명 앞에 행 번호 */
                    name:
                      sheetNum === 1
                        ? `${rowIdx + 1} 등록자`
                        : `${rowIdx + 1} 등록자(시트${sheetNum})`,
                  },
                  category: {
                    name: ["네트워크", "서버", "보안", "앱"][sheetNum % 4],
                  },
                };
              });

        return {
          id,
          name: `Sheet ${sheetNum}`,
          header,
          content: nextContent,
        };
      }),
    };
  }, [allRows, header]);

  const [data, setData] = useState<ExcelGridData>(initialData);

  // api요청 테스트용 헤더 저장 메서드
  const headerApi = useCallback(async (payload: SheetHeaderSavePayload) => {
    console.log("header 저장 요청", payload.sheetId, payload.headers.length, "건");
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
      const ids = rows
          .map((r) => (r as { id?: unknown }).id)
          .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
      if (ids.length === 0) return;
      await deleteApi(ids);

      setData((prev) => removeRowsByIdsFromExcelGridData({ data: prev, ids }));

      }, []);
  const onRowClick = useCallback((row: unknown) => console.log("rowClick", row), []);

  return (
    <div>
      <div style={{ width: "700px", height: "600px", display: "flex", flexDirection: "column", background: "red" }}>
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
