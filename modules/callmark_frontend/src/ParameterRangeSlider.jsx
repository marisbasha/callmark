// React
import React, { useState,} from 'react';
import Slider from '@mui/material/Slider';

function ParameterRangeSlider(
        {
            value,
            onChange,
            onBlur,
            disabled,
            min,
            max,
            disableKeyEvent
        }
    )
{
    const [isEditing, setIsEditing] = useState(false);

    // Ensure value is a valid array with two numbers
    const validValue = Array.isArray(value) && value.length === 2 &&
                       typeof value[0] === 'number' && typeof value[1] === 'number'
                       ? value
                       : [min || 0, max || 100];

    return (
        <Slider
            value={validValue}
            onChange={onChange}
            disableSwap
            slotProps={{thumb: {onKeyDown: (e) => { 
                                    if (disableKeyEvent){
                                        e.preventDefault();
                                        return
                                    }
                                    e.stopPropagation(); 
                                    if ( e.key === "ArrowLeft" || e.key === "ArrowRight" ){
                                        setIsEditing(true); 
                                    }
                                },
                                onKeyUp: (e) =>{  
                                    if (disableKeyEvent){
                                        return
                                    }

                                    if(isEditing){
                                        setIsEditing(false);
                                        onBlur();
                                    } 
                                }
            }}}
            disabled={disabled}
            min={min}
            max={max}
            onMouseDown = {()=>{ setIsEditing(true); }}
            onMouseUp = {()=>{ 
                if(isEditing){
                    setIsEditing(false);
                    onBlur();
                } 
            }}
            onMouseLeave = {()=>{ 
                if(isEditing){
                    setIsEditing(false);
                    onBlur();
                } 
            }}
            sx={{
                height:"3px",
                // Method 1: Direct thumb sizing
                '& .MuiSlider-thumb': {
                    width: 14,  // Default is 20px
                    height: 14, // Default is 20px
                },
            }}
        />
    )
 }
 export default ParameterRangeSlider;

 