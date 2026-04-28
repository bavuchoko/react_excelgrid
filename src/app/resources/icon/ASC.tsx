import type {IconType} from "../../type/Type.ts";

const ASC = (props:IconType) => {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" style={props.style ?? { width: '18px' }}
             className={props.className}
             onClick={props.onClick} viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
            <path d="M12 5l0 14"/>
            <path d="M16 9l-4 -4"/>
            <path d="M8 9l4 -4"/>
        </svg>
    );
};

export default ASC;

