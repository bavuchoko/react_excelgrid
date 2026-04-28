import type {IconType} from "../../type/Type.ts";

const Expand = (props:IconType) => {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" style={props.style ?? {width:'18px'}}  className={props.className} viewBox="0 0 24 24" onClick={props.onClick}>

            <title/>

            <g id="Complete">

                <g id="expand">

                    <g>

                        <polyline data-name="Right" fill="none" id="Right-2" points="3 17.3 3 21 6.7 21" stroke="#000000" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>

                        <line fill="none" stroke="#000000" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="10" x2="3.8" y1="14" y2="20.2"/>

                        <line fill="none" stroke="#000000" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="14" x2="20.2" y1="10" y2="3.8"/>

                        <polyline data-name="Right" fill="none" id="Right-3" points="21 6.7 21 3 17.3 3" stroke="#000000" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>

                    </g>

                </g>

            </g>

        </svg>
    );
};

export default Expand;

