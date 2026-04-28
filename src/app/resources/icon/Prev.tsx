import type {IconType} from "../../type/Type.ts";

const Prev = (props:IconType) => {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" style={props.style ?? {width:'18px'}} className={props.className} onClick={props.onClick} viewBox="0 0 24 24" fill="currentColor" >
            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
            <path
                d="M17 3.34a10 10 0 0 1 5 8.66c0 5.523 -4.477 10 -10 10s-10 -4.477 -10 -10a10 10 0 0 1 15 -8.66m-3.293 4.953a1 1 0 0 0 -1.414 0l-3 3a1 1 0 0 0 0 1.414l3 3a1 1 0 0 0 1.414 0l.083 -.094a1 1 0 0 0 -.083 -1.32l-2.292 -2.293l2.292 -2.293a1 1 0 0 0 0 -1.414"/>

        </svg>
    );
};

export default Prev;

