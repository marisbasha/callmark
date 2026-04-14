// React
import React, {useEffect, useRef, useState, useCallback} from 'react';

const TIME_AXIS_COLOR = '#9db4c0'
function TimeAxis({
        height,
        width,
        maxPossibleTime,
        duration,
        startTime,
        endTime,
    })
{
    const timeAxisRef = useRef(null)

    const secondsTo_HH_MM_SS = (seconds) => {
        const hours = Math.floor(seconds / 3600)
        let remainingSeconds = seconds % 3600
        const minutes = Math.floor(remainingSeconds / 60)
        remainingSeconds %= 60
        const secondsStr = remainingSeconds.toFixed(0).padStart(2, '0')

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secondsStr}`
    }

    const secondsTo_HH_MM_SS_MMM = (seconds) => {
        // Get the hours, minutes, and seconds
        let hours = Math.floor(seconds / 3600);
        let minutes = Math.floor((seconds % 3600) / 60);
        let secs = Math.floor(seconds % 60);
        let milliseconds = Math.floor((seconds % 1) * 1000);

        // Format the time components to be two digits (e.g., 01, 09) and three digits for milliseconds
        let formattedHours = String(hours).padStart(2, '0');
        let formattedMinutes = String(minutes).padStart(2, '0');
        let formattedSeconds = String(secs).padStart(2, '0');
        let formattedMilliseconds = String(milliseconds).padStart(3, '0');

        // Combine them into the desired format
        return `${formattedHours}:${formattedMinutes}:${formattedSeconds}.${formattedMilliseconds}`;
    }

    const secondsTo_MM_SS_M = (seconds) => {
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        const milliseconds = Math.round((seconds - Math.floor(seconds)) * 1000)

        return `${minutes.toString().padStart(2, '0')}:${Math.floor(remainingSeconds).toString().padStart(2, '0')}.${milliseconds.toString().padStart(1, '0')}`
    }

    const secondsTo_MM_SS_MMM = (seconds) => {
        // Get the minutes, seconds, and milliseconds
        let minutes = Math.floor(seconds / 60);
        let secs = Math.floor(seconds % 60);
        let milliseconds = Math.floor((seconds % 1) * 1000);

        // Format the time components to be two digits (e.g., 01, 09) and three digits for milliseconds
        let formattedMinutes = String(minutes).padStart(2, '0');
        let formattedSeconds = String(secs).padStart(2, '0');
        let formattedMilliseconds = String(milliseconds).padStart(3, '0');

        // Combine them into the desired format
        return `${formattedMinutes}:${formattedSeconds}.${formattedMilliseconds}`;
    }

    const drawTimeAxis = () => {
        const cvs = timeAxisRef.current
        // Update the canvas width when the width state variable changes
        cvs.width = width 
        cvs.height = height

        const ctx = cvs.getContext('2d', { willReadFrequently: true })
        ctx.clearRect(0, 0, cvs.width, cvs.height)

        ctx.lineWidth = 2
        ctx.strokeStyle = TIME_AXIS_COLOR
        ctx.font = `${10}px Arial`
        ctx.fillStyle = TIME_AXIS_COLOR
        const firstAndLastTimeStampY = 18

        // Set time formats depending on the total audio duration
        let timeConvertMethod
        let millisecondFormatMethod
        if (maxPossibleTime > 3600){
            timeConvertMethod = secondsTo_HH_MM_SS
            millisecondFormatMethod = secondsTo_HH_MM_SS_MMM
        } else {
            timeConvertMethod = secondsTo_MM_SS_M
            millisecondFormatMethod = secondsTo_MM_SS_MMM
        }

        // Drawing horizontal line
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(cvs.width, 0)
        ctx.stroke()

        // Drawing first timestamp
        ctx.beginPath()
        ctx.moveTo(1, 0)
        ctx.lineTo(1, cvs.height)
        ctx.stroke()
        const firstTimeStampText = timeConvertMethod(startTime)
        ctx.fillText(firstTimeStampText, 5, firstAndLastTimeStampY)

        // Drawing last timestamp
        ctx.beginPath()
        ctx.moveTo(cvs.width - 1, 0)
        ctx.lineTo(cvs.width - 1, cvs.height)
        ctx.stroke()
        const lastTimestampText = timeConvertMethod(endTime)
        const textWidth = ctx.measureText(lastTimestampText).width
        //ctx.fillText(lastTimestampText, cvs.width - textWidth - 5 ,firstAndLastTimeStampY)

        // Calculate how many timestamps we can fit in the current viewport without them overlapping
        const minWidthBetweenTimestamps = 70
        let timestampIncrement = 1
        let numberOfTimestampsThatHaveSpaceInsideCanvas = cvs.width / minWidthBetweenTimestamps

        while (duration > numberOfTimestampsThatHaveSpaceInsideCanvas * timestampIncrement){
            timestampIncrement = timestampIncrement * 2
        }

        // Draw First level (HH:MM:SS.m for audio longer than one hour, MM:SS.m for audio shorter than that)
        const lineHeight = 20
        const textY = lineHeight + 12
        ctx.font = `${12}px Arial`
        for (let timestamp = startTime; timestamp <= endTime; timestamp += timestampIncrement){
            // Always skip drawing the first timestamp because we already drew it
            if (timestamp === startTime) continue

            const x = (timestamp * cvs.width / duration) - ( startTime * cvs.width / duration )
            ctx.beginPath()
            ctx.moveTo(x, 0)
            ctx.lineTo(x, lineHeight)
            ctx.stroke()
            const text = timeConvertMethod(timestamp)
            const textWidth = ctx.measureText(text).width
            ctx.fillText(text, x - textWidth / 2, textY)
        }

        // Draw second level (Milliseconds)
        if (duration < 10 ){

            let i = 0
            const lineHeight = 10
            const textY = lineHeight + 12
            for (let millisecond = startTime; millisecond <= endTime; millisecond += timestampIncrement*0.1){
                // Don't draw lines on 0 and 10, because we already have seconds timestamps there
                if (i % 10 !== 0){
                    // Draw Millisecond lines
                    const x = (millisecond * cvs.width / duration) - ( startTime * cvs.width / duration )
                    ctx.beginPath()
                    ctx.moveTo(x, 0)
                    ctx.lineTo(x, lineHeight)
                    ctx.stroke()

                    const text = millisecondFormatMethod(millisecond)
                    const textWidth = ctx.measureText(text).width

                    // Draw every millisecond number if clip duration is less than 1 second
                    if (duration < 1){
                        ctx.fillText(text, x - textWidth / 2, textY)
                        // Draw every fifth millisecond number if clip duration is less than 2 seconds
                    } else if (duration < 2){
                        if (i % 5 === 0 && i % 10 !== 0){
                            ctx.fillText(text, x - textWidth / 2, textY)
                        }
                    }
                }
                i++
            }
        }

        // Draw third level (Deciseconds)
        if (duration < 1){

            let i = 0
            const lineHeight = 5
            for (let decisecond = startTime; decisecond <= endTime; decisecond += timestampIncrement*0.01){
                // Don't draw lines on 0 and 10, because we already have millisecond timestamps there
                if (i % 10 !== 0) {
                    const x = (decisecond * cvs.width / duration) - (startTime * cvs.width / duration)
                    ctx.beginPath()
                    ctx.moveTo(x, 0)
                    ctx.lineTo(x, lineHeight)
                    ctx.stroke()
                }
                i++
            }
        }
    }

    useEffect(()=>{
        drawTimeAxis()
    }, [ width, height, maxPossibleTime, duration, startTime, endTime, ])

    return  <canvas
                ref={timeAxisRef}
                width={`${width}px`}
                height={`${height}px`}
                onContextMenu={(event) => event.preventDefault()}
            />
}

export default TimeAxis;