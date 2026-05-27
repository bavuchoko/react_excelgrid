import type {CSSProperties, ReactNode, Ref} from "react";
import type {JsGridToolbarApi} from "../js-grid/jsGridToolbarApi.ts";

export type Content = Record<string, unknown>;

/** `toolbarStart` / `toolbarEnd` — ReactNode 또는 render prop */
export type JsGridToolbarSlot = ReactNode | ((api: JsGridToolbarApi) => ReactNode);

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

export type GridType = {
    data?: ExcelGridData
    /**
     * `true`이면 컬럼 필드 메뉴에 **저장·초기화** 버튼을 표시한다(`react_grid` 헤더 저장 UI).
     * 기본값 `false` — 보이기/순서 변경은 버튼 없이 즉시 반영된다.
     */
    enableHeaderSave?: boolean
    /**
     * 컬럼 저장 콜백. `enableHeaderSave` 와 함께 넘길 때 메뉴 **저장** 버튼이 동작한다.
     * - `Promise` 를 반환하면 저장 완료까지 메뉴에 로딩이 표시된다.
     * - 패키지는 API 를 호출하지 않으며, 사용처가 저장 후 `data` 를 갱신해 다시 내려준다.
     */
    onHeaderSave?: (payload: SheetHeaderSavePayload) => void | Promise<void>
    /** `enableHeaderSave` 일 때 컬럼 메뉴 **초기화** 클릭 시 호출. `Promise` 가능. */
    onHeaderReset?: () => void | Promise<void>
    /**
     * `true`면 행 좌측에 체크박스 열이 표시되고, 선택 정보가 `JsGridRowSelectionContext` 로 노출된다.
     * 삭제·이관 등은 `toolbarEnd` 의 `ToolbarDataTransfer` 를 사용한다.
     */
    enableRowSelection?: boolean
    /**
     * 행 선택 식별 필드명(기본 `id`). `getRowSelectionId`가 있으면 우선한다.
     * 식별자가 없으면 인덱스 fallback — 시트 전환·데이터 교체 시 선택이 초기화된다.
     */
    rowSelectionIdKey?: string
    /** 행 객체에서 선택 키 추출(서버 고유 키가 `id`가 아닐 때) */
    getRowSelectionId?: (row: unknown, rowIndex: number) => string | number | null | undefined
    /**
     * `true`이면 본문 셀 편집 모드를 켠다.
     * - 클릭: 셀 선택(파란 배경, 복사 가능)
     * - 같은 셀 재클릭: `Header.editor` 가 있을 때 편집기 열림
     * - 같은 열 세로 드래그: 범위 선택 → 붙여넣기(Ctrl+V) 시 `onCellChange` 호출
     * (기본값: `false`)
     */
    editable?: boolean
    /**
     * 본문 셀 값이 **실제로 바뀐 뒤** 호출된다(알림용).
     * 표시 문자열 기준으로 이전 값과 같으면 호출되지 않는다.
     * - 편집·붙여넣기 공통: `{ sheetName, kind, columnKey, value, rowIds }`
     * - 편집(`kind: 'edit'`)은 보통 `rowIds.length === 1`, `previousValue` 포함
     * - 붙여넣기(`kind: 'paste'`)는 변경된 행만 `rowIds` 에 담김
     * 실제 `data` 갱신은 `JsExcelGrid` 내부에서 처리한다.
     */
    onCellChange?: (event: SheetCellChangeEvent) => void | Promise<void>
    /**
     * 편집·붙여넣기로 내부 `gridData` 가 바뀔 때마다 호출(전체 스냅샷).
     * 부모 state 와 동기화할 때 사용한다.
     */
    onDataChange?: (data: ExcelGridData) => void
    /**
     * @deprecated 붙여넣기는 `onCellChange` (`kind: 'paste'`) 로 전달한다.
     */
    onCellsPaste?: (batches: SheetCellPasteBatch[]) => void | Promise<void>
    /** `rowIds`·선택 식별용 행 id 필드 (기본 `id`, 없으면 `sourceRowIndex`) */
    rowIdKey?: string
    /**
     * `true`(기본)이면 데이터 열 헤더 경계를 드래그해 너비를 조절한다(`react_grid` resizable).
     * `false`면 리사이즈 핸들을 숨긴다.
     */
    resizable?: boolean
    /** false면 전체화면(pseudo fullscreen) 토글 UI/동작을 비활성화한다. (기본값: true) */
    enablePseudoFullscreen?: boolean
    /**
     * `true`이면 마운트 시 전체화면(pseudo fullscreen)으로 시작한다.
     * `enablePseudoFullscreen` 이 `false`이면 무시된다.
     */
    fullmode?: boolean
    /**
     * 전달 시 **전체화면 종료(축소) 버튼**이 내부 토글 대신 이 콜백을 호출한다.
     * (예: 모달/라우트 닫기) — `fullmode` 와 함께 쓰는 경우가 많다.
     */
    onClose?: () => void
    /** 툴바 왼쪽(헤더 고정 안내 옆). 함수면 `runToolbarAction`으로 본문 로딩 연동 가능. */
    toolbarStart?: JsGridToolbarSlot
    /** 툴바 오른쪽 기본 아이콘 앞. 함수면 `runToolbarAction`으로 본문 로딩 연동 가능. */
    toolbarEnd?: JsGridToolbarSlot
    style?: CSSProperties
    /**
     * `getData()` 등 명령형 API.
     * React 19 함수 컴포넌트 ref prop 패턴.
     */
    ref?: Ref<JsExcelGridHandle>
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
    /** 셀 내부 컨트롤이 행 클릭으로 전파되지 않도록 호출(현재는 셀 단위 클릭 이벤트가 없어도 안전하게 제공된다). */
    stopRowClick: (e: unknown) => void;
};

/** `Header.editor` — `render` 인자 + 값 적용/닫기 콜백. */
export type GridCellEditorArgs = GridCellRenderArgs & {
    /** 새 값 적용. `close: true`면 편집기를 닫는다. */
    onChange: (value: unknown, options?: { close?: boolean }) => void;
    /** 편집 UI 닫기(모달·드로어 완료 시 등). */
    onClose: () => void;
};

/**
 * `Header.editor` — JSX/ReactNode 또는 render 함수.
 * - 함수형: `(args) => ReactNode`
 * - JSX/ReactNode: `row`, `value`, `columnKey`, `rowIndex`, `onChange`, `onClose`, `stopRowClick` props 주입
 */
export type GridCellEditor = ReactNode | ((args: GridCellEditorArgs) => ReactNode);

/** `JsGridTable` 편집기에서 발행하는 단일 셀 변경(내부). */
export type GridCellEditEvent = {
    row: unknown;
    /** 정렬·가상화 기준 표시 행 인덱스. */
    rowIndex: number;
    /** 정렬 전 `data` 배열의 0-based 행 인덱스. */
    sourceRowIndex: number;
    columnKey: string;
    value: unknown;
    previousValue: unknown;
};

/**
 * 본문 셀 변경(시트 포함) — 편집·붙여넣기 API 공통 형태.
 * 행은 항상 `rowIds` 배열로 전달한다(`rowIdKey` 값, 없으면 `sourceRowIndex`).
 */
export type SheetCellChangeEvent = {
    sheetName: string;
    kind: "edit" | "paste";
    columnKey: string;
    value: unknown;
    rowIds: Array<string | number>;
    /** `kind === 'edit'` 일 때만 */
    previousValue?: unknown;
};

/** `SheetCellChangeEvent` 에서 `sheetName` 을 뺀 형태(내부용). */
export type GridCellChangeEvent = Omit<SheetCellChangeEvent, "sheetName">;

export type GridCellPasteItem = {
    row: unknown;
    rowId: string | number | null | undefined;
    columnKey: string;
    rowIndex: number;
    /** 정렬 전 `data` 배열의 0-based 행 인덱스. */
    sourceRowIndex: number;
    value: unknown;
    previousValue: unknown;
};

export type GridCellPasteBatch = {
    columnKey: string;
    value: unknown;
    rowIds: Array<string | number>;
    items: GridCellPasteItem[];
};

/** `GridCellPasteItem` 에 활성 시트 이름을 더한 사용자 이벤트 단위. */
export type SheetCellPasteItem = GridCellPasteItem & {
    sheetName: string;
};

/** `GridCellPasteBatch` 에 활성 시트 이름을 더한 사용자 묶음. */
export type SheetCellPasteBatch = Omit<GridCellPasteBatch, "items"> & {
    sheetName: string;
    items: SheetCellPasteItem[];
};

/**
 * `JsGridTable` 컬럼 배열(행번호·체크박스 열 포함).
 *
 * 내부 표시용 모델이므로 `label` 을 사용한다(헤더의 `name` 과 별개).
 */
/**
 * 그리드 외부(예: 에러 바)에서 특정 셀로 포커스를 옮길 때 사용하는 타깃.
 *
 * - `columnName` 은 사용자에게 보이는 컬럼 이름(= `Header.name`). 서버 에러 응답이 보내주는 값과 동일.
 * - `rowIndex` 는 시트 `data` 배열의 0-based 인덱스.
 */
export type SheetErrorFocusTarget = {
    columnName: string;
    rowIndex: number;
};

/**
 * `JsExcelGrid` 가 외부로 노출하는 명령형 API.
 * 편집·붙여넣기가 반영된 현재 데이터는 `getData()` 로 꺼낸다.
 */
export type JsExcelGridHandle = {
    /** 내부 `gridData` 전체(시트별 headers·data·errors). */
    getData: () => ExcelGridData;
};

/**
 * `JsGridTable` 인스턴스가 외부로 노출하는 명령형 API.
 * `JsExcelGrid` 가 `SheetErrorBar` 등으로부터 셀 포커스 요청을 받아 이 핸들로 위임한다.
 */
export type JsGridTableHandle = {
    /**
     * 특정 셀로 스크롤·선택 표시를 옮긴다.
     * - `columnKey` 가 현재 보이는 컬럼이 아니면 가로 스크롤/선택은 생략하고 행만 스크롤한다.
     * - `rowIndex` 가 데이터 범위 밖이면 무시한다.
     */
    focusCell: (target: { rowIndex: number; columnKey?: string | null }) => void;
};

export type JsGridTableColumn = {
    key: string;
    label: string;
    /** `Header.type` — 정렬·복사 등 동작용. */
    type?: DataType | null;
    render?: ReactNode | ((args: GridCellRenderArgs) => ReactNode);
    /** `editable` 일 때 셀 편집에 사용. */
    editor?: GridCellEditor;
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
    /** 필드 메뉴에서 숨긴 컬럼은 `false`. 생략·`true`면 표시. */
    visible?: boolean;
    /**
     * 셀 커스텀 렌더링.
     * - 함수면 `(args) => ReactNode` 형태로 호출된다.
     * - JSX/ReactNode면 element일 경우 `row`, `value`, `columnKey` props를 주입하여 렌더링한다.
     */
    render?: ReactNode | ((args: GridCellRenderArgs) => ReactNode);
    /**
     * 본문 셀 **재클릭(같은 셀 두 번째 클릭)** 시 표시할 편집 UI.
     * 그리드의 `editable` 이 `true` 일 때만 동작한다.
     * - 함수형: `(args) => ReactNode`
     * - JSX/ReactNode: `row`, `value`, `columnKey`, `rowIndex`, `onChange`, `onClose` props 주입
     */
    editor?: GridCellEditor;
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
