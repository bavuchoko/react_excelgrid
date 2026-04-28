import type {IconType} from "../../type/Type.ts";


const Fields = (props:IconType) => {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" style={props.style ?? {width:'18px'}} onClick={props.onClick} clip={props.className}  viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
             >
            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
            <path d="M4 6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v1a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2l0 -1"/>
            <path d="M4 15a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2l0 -3"/>
            <path d="M14 6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2l0 -12"/>
        </svg>
    );
};

export default Fields;

