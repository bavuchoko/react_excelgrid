/**
 * 업로드 UI `<input accept>` 에 넣을 기본값 (Excel 통합 문서 위주).
 * 확장명 + MIME 함께 지정하면 OS 선택기에서 필터가 잘 적용된다.
 */
export const DEFAULT_EXCEL_UPLOAD_ACCEPT = [
    ".xlsx",
    ".xls",
    ".xlsm",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.ms-excel.sheet.macroEnabled.12",
].join(",");

/** 드래그·드롭 등에서 허용할 Excel 파일 여부(확장명 우선, MIME 보조). */
export function isAllowedExcelUpload(file: File): boolean {
    const lower = file.name.trim().toLowerCase();
    if (/\.(xlsx|xls|xlsm)$/i.test(lower)) return true;

    const t = (file.type ?? "").toLowerCase();
    if (
        t === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        t === "application/vnd.ms-excel" ||
        t === "application/vnd.ms-excel.sheet.macroenabled.12"
    ) {
        return true;
    }
    if (t.includes("spreadsheetml")) return true;

    return false;
}
