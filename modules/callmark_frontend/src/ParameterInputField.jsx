// React
import React, { useState,} from 'react';

function ParameterInputField(
        {
            value,
            onChange,
            onBlur,
            onFocus,
            disabled,
            width,
        }
    )
{
    const [isEditing, setIsEditing] = useState(false);

    const handleClick = () => {
        if (!disabled) {
            setIsEditing(true)
            if (onFocus) {
                onFocus()
            }
        }
    }

    return (
        <span>
            {
            isEditing?
                <input
                    value={value}
                    style={{
                        backgroundColor: "transparent",
                        borderTop: "none",
                        borderRight: "none",
                        borderBottom: "1px solid #60A5FA", // equivalent to border-blue-400
                        borderLeft: "none",
                        // outline: "none",
                        width: `${width}px`,
                        color: "#60A5FA", }}
                    type="number"
                    disabled={disabled}
                    onKeyDown={(event)=>{
                                    event.stopPropagation();
                                    if(event.key === 'Enter' && isEditing){
                                        setIsEditing(false);
                                        onBlur();
                                    }
                                }}
                    onBlur={ ()=>{setIsEditing(false); onBlur();} }
                    onChange={onChange}
                    autoFocus
                /> :
                <span
                    style={{...{backgroundColor: "transparent",
                        color: "#60A5FA",
                        width: `${+width + 4}px`,
                        height: "19px",
                        display: "inline-block",
                        fontSize: "14px"
                        },...( !disabled && {
                                    borderBottom: "1px solid #60A5FA",
                                    cursor: "pointer"
                                }) }}
                    onClick={handleClick}
                    >
                    {value}
                </span>
            }
    </span>
    )
 }
 export default ParameterInputField;

 