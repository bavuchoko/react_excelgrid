import type {CSSProperties, ReactNode} from "react";

export type Content = Record<string, unknown>;

export type Sheet = {
    /** 시트를 식별하는 고유 값(서버 저장/복원 키) */
    id: string;
    /** 탭에 표시될 이름 (없으면 `Sheet 1` 같은 기본값 사용) */
    name?: string;
    header: Header[];
    content: Content[];
};

export type ExcelGridData = {
    sheets: Sheet[];
};

export type SheetHeaderSavePayload = {
    sheetId: string;
    sheetName?: string;
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
    /** 전달 시 행 왼쪽에 체크박스·툴바 휴지통이 표시되고, 선택된 행의 "데이터 객체" 배열로 호출된다(1건이어도 배열). */
    onDeleteClick?: (rows: unknown[]) => void
    /** false면 전체화면(pseudo fullscreen) 토글 UI/동작을 비활성화한다. (기본값: true) */
    enablePseudoFullscreen?: boolean
    style?: CSSProperties
}

export type HeaderState = {
    key: string;
    label: string;
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

/** `JsGridTable` 컬럼 배열(행번호·체크박스 열 포함). `Header`와 동일한 `GridCellRenderArgs`를 사용한다. */
export type JsGridTableColumn = {
    key: string;
    label: string;
    render?: ReactNode | ((args: GridCellRenderArgs) => ReactNode);
    __rownum__?: boolean;
    __checkbox__?: boolean;
};

export type Header ={
    key:string;
    label:string;
    type: DataType;
    /** 사용자/서버 저장 너비(px). 있으면 해당 컬럼에 적용, 없으면 자동 너비. */
    width?: number;
    /**
     * 셀 커스텀 렌더링.
     * - 함수면 `(args) => ReactNode` 형태로 호출된다.
     * - JSX/ReactNode면 element일 경우 `row`, `value`, `columnKey` props를 주입하여 렌더링한다.
     */
    render?: ReactNode | ((args: GridCellRenderArgs) => ReactNode);
}

export type DataType = 'string' | 'number' | 'state' | 'date' | 'score';

export type IconType ={
    style?:CSSProperties
    className?:string
    onClick?: () => void
}