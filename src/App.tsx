import { JsExcelGrid, applyHeaderStateToHeader } from "./app/index.ts";
import type { ExcelGridData, Header, SheetHeaderSavePayload } from "./app/index.ts";
import { useCallback, useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 15;

const MyCell = (props: any) => (
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

  const [data, setData] = useState<ExcelGridData>(() => ({
    sheets: Array.from({ length: 12 }, (_, i) => ({
      id: `sheet-${i + 1}`,
      name: `Sheet ${i + 1}`,
      header: [] as Header[],
      content: [] as any[],
    })),
  }));

  // 서버는 성공 여부만 내려준다고 가정
  const saveHeaderApi = useCallback(async (_payload: SheetHeaderSavePayload) => {
    await new Promise((r) => setTimeout(r, 150));
    return true as const;
  }, []);

  const onHeaderSave = useCallback(async (payload: SheetHeaderSavePayload) => {
    const ok = await saveHeaderApi(payload);
    if (!ok) return;

    setData((prev) => ({
      ...prev,
      sheets: prev.sheets.map((s) => {
        if (s.id !== payload.sheetId) return s;
        return {
          ...s,
          header: applyHeaderStateToHeader({ header: s.header, state: payload.headers }),
        };
      }),
    }));
  }, [saveHeaderApi]);

  const onUploadClick = useCallback(() => console.log("upload clicked"), []);
  const onHeaderReset = useCallback(() => console.log("reset clicked"), []);
  const onDownloadClick = useCallback(() => console.log("download Clicked"), []);
  const onDeleteClick = useCallback((rows: unknown) => console.log("delete", rows), []);
  const onRowClick = useCallback((rows: unknown) => console.log("rowClick", rows), []);

  // 더미 데이터는 기존처럼 바뀌더라도, 헤더는 setData로 유지되도록 content만 갱신한다.
  // (실제 서비스에선 content는 서버에서 내려오고, header설정은 별도 저장/복원)
  useEffect(() => {
    setData((prev) => ({
      ...prev,
      sheets: prev.sheets.map((s) => {
        const m = /^sheet-(\d+)$/.exec(s.id);
        const sheetNum = m ? Number(m[1]) : 1;
        /** 시트마다 같은 `allRows` 베이스를 쓰되, 행 id·표시 문자열은 시트 번호별로 구분 */
        const nextContent = allRows.map((r, rowIdx) => ({
          ...r,
          id: sheetNum * PAGE_SIZE + rowIdx + 1,
          title:
            sheetNum === 2
              ? `두번째 시트 · ${String((r as { title?: string }).title ?? "")}`
              : `Sheet ${sheetNum} · 행 ${rowIdx + 1}`,
          number: `${100 + sheetNum}-${String(rowIdx + 1).padStart(3, "0")}`,
          creator: {
            name: sheetNum === 1 ? "등록자" : `등록자(시트${sheetNum})`,
          },
          category: {
            name: ["네트워크", "서버", "보안", "앱"][sheetNum % 4],
          },
        }));

        const nextHeader = s.header.length === 0 ? header : s.header;
        return { ...s, header: nextHeader, content: nextContent };
      }),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, header]);

  return (
    <div>
      <div style={{ width: "700px", height: "600px", display: "flex", flexDirection: "column", background:'red' }}>
        <JsExcelGrid
          data={data}
          onHeaderSave={onHeaderSave}
          onUploadClick={onUploadClick}
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
