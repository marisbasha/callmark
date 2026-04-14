// React
import React, {useEffect, useRef, useState, useCallback} from 'react';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { Box } from '@mui/material';

const VIEWPORT_COLOR = 'white'

function ViewPort({
    height,
    width,
    maxPossibleTime,
    duration,
    startTime,
    endTime,
    paddingLeftRight,
    passCurrentStartTimeToApp,
    passCurrentEndTimeToApp,
    passClipDurationToApp,
    passMaxScrollTimeToApp,
    passScrollStepToApp,
    globalSamplingRate,
    globalNumSpecColumns,
    updateClipDurationAndTimes,
    strictMode,
    strictDevMode,
    SCROLL_STEP_RATIO,
}
){
    const containerRef = useRef(null)
    const overviewRef = useRef(null)
    let newViewportStartFrame = null
    let newViewportEndFrame = null
    let widthBetween_xStartTime_mouseX = null
    let widthBetween_xEndTime_mouseX = null

    const getMouseX = (event) => {
        const rect = event.target.getBoundingClientRect()
        return event.clientX - rect.left
    }

    const handleLMBDownOverview = (event) => {
        // Ignore clicks from other mouse buttons
        if (event.button !== 0) return

        const mouseX = getMouseX(event)
        const xStartFrame = calculateViewportFrameX(startTime)
        const xEndFrame = calculateViewportFrameX(startTime + duration)

        // Deal with click on Start Frame
        if ((!strictMode || strictDevMode )&& mouseX >= xStartFrame - 5 && mouseX <= xStartFrame + 5){
            containerRef.current.addEventListener('mousemove', dragStartFrame)
            containerRef.current.addEventListener('mouseleave', stopDragViewport)
            return
        }

        // Deal with click on End Frame
        if ((!strictMode || strictDevMode ) && mouseX >= xEndFrame - 5 && mouseX <= xEndFrame + 5){
            containerRef.current.addEventListener('mousemove', dragEndFrame)
            containerRef.current.addEventListener('mouseleave', stopDragViewport)
            return
        }

        // Deal with click inside viewport
        if (mouseX > xStartFrame && mouseX < xEndFrame){
            const xStartTime = calculateViewportFrameX(startTime)
            const xCurrentEndTime = calculateViewportFrameX(endTime)
            widthBetween_xStartTime_mouseX = mouseX - xStartTime
            widthBetween_xEndTime_mouseX = xCurrentEndTime - mouseX
            containerRef.current.addEventListener('mousemove', dragViewport)
            containerRef.current.addEventListener('mouseleave', stopDragViewport)
        }
    }

    const stopDragViewport = () => {
        containerRef.current.removeEventListener('mousemove', dragStartFrame)
        containerRef.current.removeEventListener('mousemove', dragEndFrame)
        containerRef.current.removeEventListener('mousemove', dragViewport)
        containerRef.current.removeEventListener('mouseleave', stopDragViewport)

        // Set new Viewport (Start & Endframe). This happens when the user drags the overview scroll bar
        if (widthBetween_xStartTime_mouseX && (newViewportStartFrame || newViewportEndFrame)){
            // make sure the hop length must be an integer, otherwise there will be offset
            let hopLength = parseInt( Math.max(1, Math.floor((newViewportEndFrame - newViewportStartFrame) / globalNumSpecColumns * globalSamplingRate) ) )
            newViewportEndFrame = newViewportStartFrame + hopLength * globalNumSpecColumns / globalSamplingRate

            const newDuration = newViewportEndFrame - newViewportStartFrame
            const newMaxScrollTime = Math.max(maxPossibleTime - newDuration, 0)

            // Update these state variables in a boundle
            updateClipDurationAndTimes(hopLength, newDuration, newMaxScrollTime, newViewportStartFrame, newViewportEndFrame)
            drawViewport( newViewportStartFrame, newViewportEndFrame, VIEWPORT_COLOR, 2  )

            // Set new Start Frame only
        } else if (newViewportStartFrame || newViewportStartFrame === 0){
            // make sure the hop length must be an integer, otherwise there will be offset
            let hopLength = parseInt( Math.max(1, Math.floor((endTime - newViewportStartFrame) / globalNumSpecColumns * globalSamplingRate) ) )
            const newEndTime = newViewportStartFrame + hopLength * globalNumSpecColumns / globalSamplingRate

            const newDuration = newEndTime - newViewportStartFrame
            const newMaxScrollTime = Math.max(maxPossibleTime - newDuration, 0)

            updateClipDurationAndTimes(hopLength, newDuration, newMaxScrollTime, newViewportStartFrame, newEndTime)
            drawViewport( newViewportStartFrame, newEndTime, VIEWPORT_COLOR, 2  )

            // Set new End frame only
        } else if (newViewportEndFrame){
            // make sure the hop length must be an integer, otherwise there will be offset
            let hopLength = parseInt( Math.max(1, Math.floor((newViewportEndFrame - startTime) / globalNumSpecColumns * globalSamplingRate) ) )
            newViewportEndFrame = startTime + hopLength * globalNumSpecColumns / globalSamplingRate

            const newDuration = newViewportEndFrame - startTime
            const newMaxScrollTime = Math.max(maxPossibleTime - newDuration, 0)
            updateClipDurationAndTimes(hopLength, newDuration, newMaxScrollTime, startTime, newViewportEndFrame)
            drawViewport( startTime, newViewportEndFrame, VIEWPORT_COLOR, 2  )
        }

        newViewportStartFrame = null
        newViewportEndFrame = null
        widthBetween_xStartTime_mouseX = null
        widthBetween_xEndTime_mouseX = null
    }

    const handleMouseUpOverview = (event) => {
        if (event.button !== 0) return
        stopDragViewport()
    }

    const dragStartFrame = (event) => {
        const mouseX = getMouseXInOverviewTimeAxisContainer(event)
        newViewportStartFrame = calculateViewportTimestamp(mouseX)

        // Prevent the user from setting the viewport too small or the start Frame to go beyond the end Frame
        if (newViewportStartFrame > endTime - 0.05){
            newViewportStartFrame = endTime - 0.05
        }

        drawViewport(newViewportStartFrame, endTime, VIEWPORT_COLOR, 2)
    }

    const dragEndFrame = (event) => {
        const mouseX = getMouseXInOverviewTimeAxisContainer(event)
        newViewportEndFrame = calculateViewportTimestamp(mouseX)

        // Prevent the user from setting the viewport too small or the end Frame to go before the start Frame
        if (newViewportEndFrame < startTime + 0.05){
            newViewportEndFrame = startTime + 0.05
        }

        drawViewport(startTime, newViewportEndFrame, VIEWPORT_COLOR, 2)

    }

    const dragViewport = (event) => {
        const mouseX = getMouseXInOverviewTimeAxisContainer(event)
        const viewportWidth = widthBetween_xStartTime_mouseX + widthBetween_xEndTime_mouseX

        // prevent changing the viewport with due to over dragging
        if ( mouseX < widthBetween_xStartTime_mouseX ||  mouseX > width + paddingLeftRight - widthBetween_xEndTime_mouseX  ){
            return
        }

        newViewportStartFrame = calculateViewportTimestamp(mouseX - widthBetween_xStartTime_mouseX)
        newViewportEndFrame = calculateViewportTimestamp(mouseX + widthBetween_xEndTime_mouseX)
        // Prevent Viewport Start Frame from going below 0
        if (newViewportStartFrame < 0){
            newViewportStartFrame = 0
            newViewportEndFrame = calculateViewportTimestamp( viewportWidth )
            return
        }
        // Prevent Viewport End Frame from going above the Audio Duration
        if (newViewportEndFrame > maxPossibleTime){
            newViewportStartFrame = calculateViewportTimestamp(overviewRef.current.width - viewportWidth )
            newViewportEndFrame = maxPossibleTime
            return
        }
        drawViewport(newViewportStartFrame, newViewportEndFrame, VIEWPORT_COLOR, 4)
    }

    const getMouseXInOverviewTimeAxisContainer = (event) => {
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        return event.clientX - rect.left
    }

    const calculateViewportTimestamp = (mouseX) => {
        // return maxPossibleTime * (  (mouseX - paddingLeftRight)   / overviewRef.current.width   )
        return maxPossibleTime * ( Math.max(0,  Math.min(1,  (  mouseX - paddingLeftRight)   / width  ) ) )
    }

    const calculateViewportFrameX = (timestamp) => {
        // 20 is 2 x expected padding of canvas
        // return timestamp * (overviewRef.current.width -  2 * paddingLeftRight ) / maxPossibleTime + paddingLeftRight
        return timestamp * ( width ) / maxPossibleTime + paddingLeftRight
    }

    const drawViewport = (startFrame, endFrame, hexColorCode, lineWidth) => {
        const overviewCanvas = overviewRef.current

        overviewCanvas.width = width + 2 * paddingLeftRight
        overviewCanvas.height = height

        const ctx = overviewCanvas.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, overviewCanvas.width, overviewCanvas.height);

        // Draw horizontal line representing the audio track
        ctx.lineWidth = 2
        ctx.strokeStyle = '#b6b1ff'
        ctx.beginPath()
        ctx.moveTo( paddingLeftRight , overviewCanvas.height/2)  // 10 is the expected padding of the canvas
        ctx.lineTo( paddingLeftRight + width, overviewCanvas.height/2)
        ctx.stroke()

        const x1 = calculateViewportFrameX(startFrame) 
        const x2 = calculateViewportFrameX(endFrame) 
        ctx.lineWidth = lineWidth
        ctx.strokeStyle = hexColorCode

        // Draw start frame
        ctx.beginPath()
        ctx.moveTo(x1, 0)
        ctx.lineTo(x1, overviewCanvas.height)
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(x1, overviewCanvas.height/2, 5, 0, Math.PI * 2)
        ctx.stroke()

        // Draw end frame
        ctx.beginPath()
        ctx.moveTo(x2, 0)
        ctx.lineTo(x2, overviewCanvas.height)
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(x2, overviewCanvas.height/2, 5, 0, Math.PI * 2)
        ctx.stroke()

        // Draw Top line
        ctx.beginPath()
        ctx.moveTo(x1, 0)
        ctx.lineTo(x2, 0)
        ctx.stroke()

        // Draw Bottom line
        ctx.beginPath()
        ctx.moveTo(x1, overviewCanvas.height)
        ctx.lineTo(x2, overviewCanvas.height)
        ctx.stroke()

        // Draw Viewport Timestamps
        ctx.font = `10px Arial`;
        ctx.fillStyle = hexColorCode
        const viewportWidth = x2 - x1
        const startFrameText = (Math.round(startFrame * 100) / 100).toString()
        const endFrameText = (Math.round(endFrame * 100) / 100).toString()
        const startFrameTextWidth = ctx.measureText(startFrameText).width
        const endFrameTextWidth = ctx.measureText(endFrameText).width
        const xPadding = 8

        // Place startFrame and endFrame timestamps on the outside of the viewport if the space is too small
        const isWideEnough = viewportWidth > startFrameTextWidth + endFrameTextWidth + xPadding * 3

        const startFrameX = isWideEnough ? x1 + xPadding : x1 - startFrameTextWidth - xPadding
        const endFrameX = isWideEnough ? x2 - endFrameTextWidth - xPadding : x2 + xPadding
        const yPadding = isWideEnough ? 5 : 2

        ctx.fillText(startFrameText, startFrameX, overviewCanvas.height - yPadding)
        ctx.fillText(endFrameText, endFrameX, overviewCanvas.height - yPadding)

    }

    const hoverViewportFrame = (event) => {
        if (strictMode && !strictDevMode) return

        const xHovered = getMouseX(event)
        const xStartFrame = calculateViewportFrameX(startTime)
        const xEndFrame = calculateViewportFrameX(startTime + duration)

        // Deal with hover on Start Frame
        if ( (xHovered >= xStartFrame - 5 && xHovered <= xStartFrame + 5) || (xHovered >= xEndFrame - 5 && xHovered <= xEndFrame + 5) ){
            overviewRef.current.style.cursor = 'col-resize'
        } else {
            overviewRef.current.style.cursor = 'default'
        }
    }

    useEffect(()=>{

        drawViewport( startTime, endTime, VIEWPORT_COLOR, 2  )
    }, [height,
        width,
        maxPossibleTime,
        duration,
        startTime,
        endTime,
        paddingLeftRight])


    return <div 
                ref={containerRef}
                onMouseUp={(event) => {
                    if (event.button !== 0) return
                    stopDragViewport()
                }}
                >
                <canvas
                    ref={overviewRef}
                    width={width + 2 * paddingLeftRight}
                    height={height}
                    onMouseDown={handleLMBDownOverview}
                    onMouseMove={hoverViewportFrame}
                />
            </div>

}

export default ViewPort;