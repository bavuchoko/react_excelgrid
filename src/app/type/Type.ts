import type {CSSProperties, ReactNode} from "react";

export type Content = Record<string, unknown>;

/**
 * 그리드 데이터 타입.
 *
 * 서버에서 내려주는 응답 구조와 동일하게, 시트 이름(예: `"미들웨어"`, `"서버(물리)"`)을
 * 키로 갖는 객체이다. 각 값(`SheetBody`)은 그 시트의 헤더/데이터/오류 정보를 담는다.
 *
 * 예시:
 * ```ts
 * const data: ExcelGridData = {
 *   "미들웨어": { headers: [...], data: [...], errors: null },
 *   "서버(물리)": { headers: [...], data: [...], errors: null },
 * }
 * ```
 */
export type ExcelGridData = Record<string, SheetBody>;

/** 단일 시트의 본문(헤더·데이터·오류). 서버 응답의 시트 값과 동일한 모양이다. */
export type SheetBody = {
    headers: Header[];
    data: Content[];
    errors?: unknown;
};

/**
 * 그리드 내부에서 다루는 정규화된 시트.
 * `ExcelGridData` 의 객체 키(시트 이름)를 `name` 으로 풀어 배열로 만든 형태.
 */
export type Sheet = SheetBody & {
    /** 시트 이름(객체 키와 동일). 시트 식별자·탭 표시에 사용된다. */
    name: string;
};

export type SheetHeaderSavePayload = {
    /** 대상 시트 이름(= `ExcelGridData` 의 객체 키). */
    sheetName: string;
    headers: HeaderState[];
};

export type GridType ={
    data?: ExcelGridData
    /** 패키지는 API를 호출하지 않고, 사용처가 저장 후 data를 갱신해 다시 내려준다. */
    onHeaderSave?: (payload: SheetHeaderSavePayload) => void | Promise<void>
    /** 컬럼 설정 메뉴에서 "초기화" 클릭 시 호출된다. */
    onHeaderReset?: () => void
    onDownloadClick?: () => void
    /** 전달 시 툴바에 업로드 아이콘이 표시된다. 패널에서 목록 확인 후 업로드 버튼 클릭 시 한 번 호출된다. resolve 시 패널이 닫힌다. 오류 처리를 위해 거부(reject) 시 패널에 오류 텍스트를 보여 줄 수 있다. */
    onUploadFiles?: (files: File[]) => void | Promise<void>
    /** 업로드에 쓸 `<input type="file">` 의 `accept`. 생략 시 Excel(.xlsx·.xls·.xlsm 등) 허용 기본 문자열 사용. */
    uploadAccept?: string
    /** `true` 일 때 파일 여러 건 선택/병합(기본 `false`: 한 번에 하나). */
    uploadMultiple?: boolean
    /** 체크박스를 제외한 행 클릭 시 호출된다. */
    onRowClick?: (row: unknown) => void
    /**
     * 전달 시 행 왼쪽에 체크박스·툴바 휴지통이 표시되고, 선택된 행의 "데이터 객체" 배열로 호출된다(1건이어도 배열).
     * API 삭제 성공 후 `removeRowsFromExcelGridData({ data, sheetName, removedRows })`로 `data`를 갱신하면 된다.
     * 비동기 삭제 시 `Promise`를 반환하면 응답까지 삭제 로딩 UI가 유지된다.
     */
    onDeleteClick?: (rows: unknown[]) => void | Promise<void>
    /** false면 전체화면(pseudo fullscreen) 토글 UI/동작을 비활성화한다. (기본값: true) */
    enablePseudoFullscreen?: boolean
    style?: CSSProperties
}

export type HeaderState = {
    key: string;
    /** 사용자에게 보이는 컬럼명(= `Header.name`). */
    name: string;
    visible: boolean;
    /** 저장된 컬럼 너비(px). 없으면 기본 레이아웃·측정에 따름. */
    width?: number;
}

/** `Header.render` 함수형과 테이블 컬럼 `render`가 동일한 인자 타입을 쓰도록 공유한다. */
export type GridCellRenderArgs = {
    row: unknown;
    value: unknown;
    columnKey: string;
    rowIndex: number;
    stopRowClick: (e: unknown) => void;
};

/**
 * `JsGridTable` 컬럼 배열(행번호·체크박스 열 포함).
 *
 * 내부 표시용 모델이므로 `label` 을 사용한다(헤더의 `name` 과 별개).
 */
export type JsGridTableColumn = {
    key: string;
    label: string;
    render?: ReactNode | ((args: GridCellRenderArgs) => ReactNode);
    __rownum__?: boolean;
    __checkbox__?: boolean;
};

/**
 * 시트 헤더 정의. 서버 응답의 `headers[i]` 와 동일한 모양에 그리드 전용 필드(`width`·`render`)만 추가됐다.
 */
export type Header = {
    key: string;
    /** 사용자에게 표시할 컬럼명. */
    name: string;
    /**
     * 셀 데이터 분류. 정렬/렌더 기준이 된다.
     * 서버 응답이 `null` 인 경우(분류 없음)도 허용한다.
     */
    type: DataType | null;
    /**
     * 서버 측 타입 명칭(예: `Code`, `Department`, `UserAccount`, `CustomCode`, `AssetField` …).
     * 그리드 동작에 직접 영향은 없지만, 저장/원복 시 값 보존을 위해 함께 보관한다.
     */
    typeName?: string | null;
    /** 서버 응답의 `subClass`(예: `customCode`, `code`, `field`). 의미 보존용. */
    subClass?: string | null;
    /** 서버 응답의 `subValue`(예: `value`). 의미 보존용. */
    subValue?: string | null;
    /** 서버 응답의 `targetClass`(예: `AssetCustomCode`, `AssetCustomString`, `AssetField`). 의미 보존용. */
    targetClass?: string | null;
    /** 사용자/서버 저장 너비(px). 있으면 해당 컬럼에 적용, 없으면 자동 너비. */
    width?: number;
    /**
     * 셀 커스텀 렌더링.
     * - 함수면 `(args) => ReactNode` 형태로 호출된다.
     * - JSX/ReactNode면 element일 경우 `row`, `value`, `columnKey` props를 주입하여 렌더링한다.
     */
    render?: ReactNode | ((args: GridCellRenderArgs) => ReactNode);
}

/**
 * 셀 분류 타입.
 *
 * - `string` / `number` / `state` / `date` / `score`: 기존 그리드 전용 타입.
 * - `code` / `array`: 서버 응답에서 전달되는 타입. 현재는 문자열로 정렬·표시한다.
 */
export type DataType = 'string' | 'number' | 'state' | 'date' | 'score' | 'code' | 'array';

export type IconType ={
    style?:CSSProperties
    className?:string
    onClick?: () => void
}
