import type {MutableRefObject} from "react";
import Reset from "../resources/icon/Reset.tsx";
import Disk from "../resources/icon/Disk.tsx";
import type {UserColumn} from "./columnFieldsMenuModel.ts";

type Props = {
    open: boolean;
    pos: { top: number; right: number } | null;
    userColumns: UserColumn[];
    dragKeyRef: MutableRefObject<string | null>;
    onReorder: (fromKey: string, toKey: string) => void;
    onToggleVisible: (key: string, visible: boolean) => void;
    onReset: () => void;
    onSave: () => void;
};

export default function ColumnFieldsMenu(props: Props) {
    if (!props.open || !props.pos) return null;

    return (
        <div
            data-jsgrid-fields-menu="1"
            style={{
                position: 'fixed',
                top: props.pos.top,
                right: props.pos.right,
                width: 200,
                backgroundColor: 'rgb(246,246,246)',
                border: '1px solid #bdc2c9',
                boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                zIndex: 10000,
                padding: 5,
            }}
        >
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, padding: '4px 6px' }}>
                보이기/숨기기, 드래그로 순서 변경
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflow: 'auto', padding: 5 }}>
                {props.userColumns.map((c) => (
                    <div
                        key={c.key}
                        draggable
                        onDragStart={() => { props.dragKeyRef.current = c.key; }}
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={() => {
                            const fromKey = props.dragKeyRef.current;
                            const toKey = c.key;
                            if (!fromKey || fromKey === toKey) return;
                            props.onReorder(fromKey, toKey);
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 8px',
                            backgroundColor: 'rgb(232,232,232)',
                            borderRadius: 4,
                            cursor: 'grab',
                            userSelect: 'none',
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={c.visible}
                            onChange={(e) => props.onToggleVisible(c.key, e.target.checked)}
                        />
                        <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.label}
                        </div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>⋮⋮</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 12px 2px' }}>
                <button
                    type="button"
                    onClick={props.onReset}
                    style={{
                        fontSize: 12,
                        padding: '4px 8px',
                        border: '1px solid #bdc2c9',
                        backgroundColor: '#f8f8f8',
                        borderRadius: 6,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        width: '70px',
                    }}
                >
                    <Reset  style={{marginRight:'3px', width:'16px'}}/><span style={{fontSize:'12px'}}>초기화</span>
                </button>

                <button
                    type="button"
                    onClick={props.onSave}
                    style={{
                        fontSize: 12,
                        padding: '4px 8px',
                        border: '1px solid #1d4ed8',
                        backgroundColor: '#1d4ed8',
                        color: '#ffffff',
                        borderRadius: 6,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        display:"flex",
                        alignItems: 'center',
                        width: '60px',
                    }}
                >
                    <Disk style={{marginRight:'3px', width:'16px', }}/><span style={{fontSize:'12px'}}>저장</span>
                </button>
            </div>
        </div>
    );
}

