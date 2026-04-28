import type {IconType} from "../../type/Type.ts";

const Shrink = (props:IconType) => {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" style={props.style ?? {width:'18px'}} className={props.className} onClick={props.onClick} viewBox="0 0 24 24" fill="none">
            <g id="Arrow / Shrink">
                <path id="Vector" d="M5 14H10V19M19 10H14V5" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </g>
        </svg>
    );
};

export default Shrink;

