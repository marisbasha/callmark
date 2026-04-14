// React
import React, {useEffect, useState, useRef, useCallback} from 'react';
import Box from '@mui/material/Box';
// Internal dependencies
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import IconButton from '@mui/material/IconButton';
import ParameterInputField from './ParameterInputField';
import ParameterRangeSlider from './ParameterRangeSlider';
import { Divider } from '@mui/material';
import Slider from '@mui/material/Slider';

const MIN_POSSIBLE_DB = -150
const MAX_POSSIBLE_DB = 150

function SpectrogramParameters(
        {
            specCalMethod,
            nfft,
            binsPerOctave,
            minFreq,
            maxFreq,
            passShowLocalConfigWindowToTrack,
            passSpecCalMethodToTrack,
            passNfftToTrack,
            passBinsPerOctaveToTrack,
            passMinFreqToTrack,
            passMaxFreqToTrack,
            submitLocalParameters,
            strictMode,
            strictDevMode,
            spectrogram,
            globalSamplingRate,
            spectrogramIsLoading,
            setAnyWindowsOpen,
            dbMin,
            dbMax,
            setDbMin,
            setDbMax,
            colorMap,
            setColorMap,
            specCanvasHeight,
            setSpecCanvasHeight,
            disableKeyEvent
        }
    )
{
    const [showNFftInput, setShowNFftInput] = useState(true)
    const [showBinsPerOctaveInput, setShowBinsPerOctaveInput] = useState(false)
    const minDistance = 1;
    const [showContent, setShowContent] = useState(false)
    const [isEditingMinFreq, setIsEditingMinFreq] = useState(false)
    const [isEditingMaxFreq, setIsEditingMaxFreq] = useState(false)
    const [localMinFreq, setLocalMinFreq] = useState(minFreq)
    const [localMaxFreq, setLocalMaxFreq] = useState(maxFreq)


    const handleNfftInputChange = (event) => {
        const value = parseInt( event.target.value )
        if (event.target.value === '' || isNaN(value)){
            passNfftToTrack( event.target.value )
        }else{
            const newNfft = Math.max(0, Math.min( 16384, value ))
            passNfftToTrack( newNfft )
        }
    }

    const handleBinsPerOctaveInputChange = (event) => {
        const value = parseInt( event.target.value )
        if (event.target.value === '' || isNaN(value)){
            passBinsPerOctaveToTrack( event.target.value )
        }else{
            const newBPO = Math.max(0, Math.min( 200, value ))
            passBinsPerOctaveToTrack( newBPO )
        }
    }

    const handleMinFreqFocus = () => {
        setIsEditingMinFreq(true)
    }

    const handleMinFreqInputChange = (event) => {
        // Keep value local during editing - don't update parent state yet
        setLocalMinFreq(event.target.value)
    }

    const handleMaxFreqFocus = () => {
        setIsEditingMaxFreq(true)
    }

    const handleMaxFreqInputChange = (event) => {
        // Keep value local during editing - don't update parent state yet
        setLocalMaxFreq(event.target.value)
    }

    const handleMinFreqBlur = () => {
        // Parse and validate the value
        let newMin = parseFloat(localMinFreq)

        // Default to 0 if empty or invalid
        if (localMinFreq === '' || isNaN(newMin)) {
            newMin = 0
        }

        // Get current max value
        const currentMax = typeof maxFreq === 'number' ? maxFreq : parseFloat(maxFreq) || Math.floor(globalSamplingRate / 2)

        // Clamp to valid range and ensure min < max
        newMin = Math.max(0, Math.min(newMin, currentMax - minDistance))

        // Update local and parent state
        setLocalMinFreq(newMin)
        passMinFreqToTrack(newMin)

        // Clear editing flag
        setIsEditingMinFreq(false)

        // Submit after state update - use setTimeout to ensure state is committed
        setTimeout(() => {
            submitLocalParameters()
        }, 0)
    }

    const handleMaxFreqBlur = () => {
        // Parse and validate the value
        let newMax = parseFloat(localMaxFreq)

        // Default to Nyquist if empty or invalid
        if (localMaxFreq === '' || isNaN(newMax)) {
            newMax = Math.floor(globalSamplingRate / 2)
        }

        // Get current min value
        const currentMin = typeof minFreq === 'number' ? minFreq : parseFloat(minFreq) || 0

        // Clamp to valid range and ensure max > min
        newMax = Math.min(Math.max(newMax, currentMin + minDistance), Math.floor(globalSamplingRate / 2))

        // Update local and parent state
        setLocalMaxFreq(newMax)
        passMaxFreqToTrack(newMax)

        // Clear editing flag
        setIsEditingMaxFreq(false)

        // Submit after state update - use setTimeout to ensure state is committed
        setTimeout(() => {
            submitLocalParameters()
        }, 0)
    }

    const handleFreqRangeSliderChange = (
        event,
        newValue,
        activeThumb,
      ) => {
        if (!Array.isArray(newValue)) {
          return;
        }

        // Don't update from slider if user is actively editing the input fields
        if (isEditingMinFreq || isEditingMaxFreq) {
          return;
        }

        // Ensure min/max are valid numbers before clamping
        const currentMin = typeof minFreq === 'number' ? minFreq : parseFloat(minFreq) || 0;
        const currentMax = typeof maxFreq === 'number' ? maxFreq : parseFloat(maxFreq) || Math.floor(globalSamplingRate / 2);

        if (activeThumb === 0) {
          // Moving the left thumb
          const newMin = Math.min(newValue[0], currentMax - minDistance);
          passMinFreqToTrack(newMin);
        } else {
          // Moving the right thumb
          const newMax = Math.max(newValue[1], currentMin + minDistance);
          passMaxFreqToTrack(newMax);
        }
      };


    const handleDbMinInputChange = (event) => {
        if (event.target.value === '' || isNaN(parseInt(event.target.value))){
            setDbMin( event.target.value )
            return 
        }
        const newMin = Math.max(MIN_POSSIBLE_DB, Math.min(+event.target.value, dbMax - minDistance));
        setDbMin( newMin)
    }

    const handleDbMaxInputChange = (event) => {
        if (event.target.value === '' || isNaN(parseInt(event.target.value))){
            setDbMax( event.target.value )
            return 
        }
        const newMax = Math.min( Math.max(+event.target.value, dbMin + minDistance), MAX_POSSIBLE_DB );
        setDbMax( newMax )
    }

    const handleDbRangeSliderChange = (
        event,
        newValue,
        activeThumb,
      ) => {
        if (!Array.isArray(newValue)) {
          return;
        }
        if (activeThumb === 0) {
          // Moving the left thumb
          const newMin = Math.min(newValue[0], dbMax - minDistance);
          setDbMin(newMin);
        } else {
          // Moving the right thumb
          const newMax = Math.max(newValue[1], dbMin + minDistance);
          setDbMax(newMax);
        }
      };

    /* ++++++++++++++++++ Use Effect Hooks ++++++++++++++++++ */

    // Sync local frequency state with parent state when not editing
    useEffect(() => {
        if (!isEditingMinFreq) {
            setLocalMinFreq(minFreq)
        }
    }, [minFreq, isEditingMinFreq])

    useEffect(() => {
        if (!isEditingMaxFreq) {
            setLocalMaxFreq(maxFreq)
        }
    }, [maxFreq, isEditingMaxFreq])

    useEffect( () => {
        // Conditionally render the nfft or binsPerOctave Input field according to the selected specCalMethod
        if (!specCalMethod) return

        if (specCalMethod === 'linear') {
            setShowNFftInput(true)
            setShowBinsPerOctaveInput(false)
        }

        if (specCalMethod === 'log-mel') {
            setShowNFftInput(true)
            setShowBinsPerOctaveInput(false)
        }

        if (specCalMethod === 'constant-q'){
            setShowNFftInput(false)
            setShowBinsPerOctaveInput(true)
        }

        if (specCalMethod === 'dummy'){
            setShowNFftInput(false)
            setShowBinsPerOctaveInput(false)
        }

        if (spectrogram){
            submitLocalParameters()
        }

    }, [specCalMethod])


    return (
            <Box sx={{width:"100%", paddingRight:"15px", paddingTop:"10px"}}>

                <Box sx={{width:"100%", height:"30px", paddingLeft:"10px", 
                          background: "linear-gradient(to right, #082536, #082536)",
                          display: "flex", justifyContent:"space-between", alignItems:"center", cursor: "pointer" }}
                          onClick={()=>{ setShowContent(!showContent) }} >
                     <span  style={{ 
                            fontWeight: "600", 
                            fontSize: "14px",
                            color: "#ffffff" 
                        }}>
                        Spectrogram Parameters
                    </span>
                    <IconButton 
                        sx={{width:"25px", height:"30px", '& svg': {
                            color: "#e5e7eb"  // lighter color for better contrast
                            }}}
                        >
                        {showContent? <ArrowDropUpIcon fontSize="large"/>:<ArrowDropDownIcon fontSize="large"/>}
                    </IconButton>
                </Box>
            { showContent &&
                <Box sx={{paddingTop:"10px", marginLeft:"5px", width:"100%"}} >
                    <Box sx={{ width:"100%", paddingBottom:"5px", display:"flex", justifyContent:"flex-start", alignItems:"center", gap:"10px" }} >
                        <span style={{fontSize:"14px"}}>Spectrogram Type</span>
                        <select
                            id="spec-type-select"
                            value={specCalMethod}
                            onChange={(event) => {
                                passSpecCalMethodToTrack(event.target.value);
                            }}
                            style={{
                                // width: '100%',
                                // height: '30px',
                                padding: '0px',
                                fontSize: '14px',
                                borderRadius: '4px',
                                border: '1px solid #ccc',
                                color: "#60A5FA",
                                backgroundColor: "transparent",
                            }}
                        >
                            <option value="linear">Linear</option>
                            <option value="log-mel">Log-Mel</option>
                            <option value="constant-q">Constant-Q</option>
                            {strictMode && <option value="dummy" disabled={specCalMethod !== 'dummy'}>Dummy</option>}
                        </select>
                    </Box>
                    <Box sx={{ paddingLeft:"0px", width:"100%", display:"flex", justifyContent:"flex-start" }} >
                        
                        {showNFftInput && (
                            <Box sx={{ paddingLeft:"24px", width:"60%",display:"flex", justifyContent:"flex-end", gap:"10px"}} >
                                <span style={{fontSize:"14px"}}>N-FFT</span>
                                <ParameterInputField
                                    value={nfft}
                                    onChange={handleNfftInputChange}
                                    onBlur={submitLocalParameters}
                                    disabled={strictMode && !strictDevMode }
                                    width={60}
                                />
                            </Box>
                        )}
                        {showBinsPerOctaveInput && (
                            <Box sx={{ paddingLeft:"24px", width:"60%",display:"flex", justifyContent:"flex-end", gap:"10px"}} >
                                <span style={{fontSize:"14px"}}>BPO</span>
                                <ParameterInputField
                                    value={binsPerOctave}
                                    onChange={handleBinsPerOctaveInputChange}
                                    onBlur={submitLocalParameters}
                                    disabled={strictMode && !strictDevMode }
                                    width={60}
                                />
                            </Box>
                        )}
                    </Box>
                    <Divider sx={{marginTop:"2px", marginLeft:"15px", marginRight:"15px"}} color="#4a4a4a"/>
                    <Box sx={{ width:"100%", paddingTop:"5px", display:"flex", justifyContent:"flex-start", alignItems:"center", gap:"5px" }} >
                        <Box sx={{width:"30%", height:"64px", display:"flex", flexDirection:"column", justifyContent:"flex-start" }} >
                            <span style={{fontSize:"14px"}}>Frequency Range (Hz)</span>
                        </Box>
                        <Box sx={{width:"70%", display:"flex", flexDirection:"column", gap:"5px"}} >
                            <Box sx={{width:"100%", display:"flex", gap:"5px"}} >        
                                <span style={{fontSize:"14px"}}>Min</span>
                                    <ParameterInputField
                                        value={localMinFreq}
                                        onChange={handleMinFreqInputChange}
                                        onFocus={handleMinFreqFocus}
                                        onBlur={handleMinFreqBlur}
                                        disabled={strictMode && !strictDevMode }
                                        width={60}
                                    />
                                <span style={{fontSize:"14px"}}>Max</span>
                                    <ParameterInputField
                                        value={localMaxFreq}
                                        onChange={handleMaxFreqInputChange}
                                        onFocus={handleMaxFreqFocus}
                                        onBlur={handleMaxFreqBlur}
                                        disabled={strictMode && !strictDevMode }
                                        width={60}
                                    />
                            </Box>
                            <Box sx={{width:"100%", display:"flex", gap:"5px"}} >
                                <Box
                                    sx={{width:"10%"}}
                                >
                                    <span style={{fontSize:"12px"}}>0</span>
                                </Box>
                                <Box
                                    sx={{width:"60%"}}
                                >
                                    <ParameterRangeSlider
                                        value={[ minFreq, maxFreq ]}
                                        onChange={handleFreqRangeSliderChange}
                                        onBlur={submitLocalParameters}
                                        disabled={strictMode && !strictDevMode }
                                        min={0}
                                        max={Math.floor(globalSamplingRate / 2)}
                                        disableKeyEvent={disableKeyEvent}
                                    />
                                </Box>
                                <Box
                                    sx={{width:"20%", paddingLeft:"5px"}}
                                >
                                    <span style={{fontSize:"12px"}}>{Math.floor( globalSamplingRate/2 )}</span>
                                </Box>
                            </Box>

                        </Box>
                    </Box>

                    <Divider sx={{marginTop:"2px", marginLeft:"15px", marginRight:"15px"}} color="#4a4a4a"/>
                    <Box sx={{ width:"100%", paddingTop:"5px", display:"flex", justifyContent:"flex-start", alignItems:"center", gap:"5px" }} >
                        <Box sx={{width:"30%", height:"64px", display:"flex", flexDirection:"column", justifyContent:"flex-start" }} >
                            <span style={{fontSize:"14px"}}>Dynamic Range (dB)</span>
                        </Box>
                        <Box sx={{width:"70%", display:"flex", flexDirection:"column", gap:"5px"}} >
                            <Box sx={{width:"100%", display:"flex", gap:"5px"}} >        
                                <span style={{fontSize:"14px"}}>Min</span>
                                <ParameterInputField
                                            value={dbMin}
                                            onChange={handleDbMinInputChange}
                                            onBlur={submitLocalParameters}
                                            disabled={strictMode && !strictDevMode }
                                            width={60}
                                        />
                                <span style={{fontSize:"14px"}}>Max</span>
                                        <ParameterInputField
                                            value={dbMax}
                                            onChange={handleDbMaxInputChange}
                                            onBlur={submitLocalParameters}
                                            disabled={strictMode && !strictDevMode }
                                            width={60}
                                        />
                            </Box>
                            <Box sx={{width:"100%", display:"flex", gap:"5px"}} >
                                <Box
                                    sx={{width:"10%"}}
                                >
                                    <span style={{fontSize:"12px"}}>{MIN_POSSIBLE_DB}</span>
                                </Box>
                                <Box
                                    sx={{width:"60%"}}
                                >
                                    <ParameterRangeSlider
                                        value={[ dbMin, dbMax ]}
                                        onChange={handleDbRangeSliderChange}
                                        onBlur={submitLocalParameters}
                                        disabled={strictMode && !strictDevMode }
                                        min={MIN_POSSIBLE_DB}
                                        max={MAX_POSSIBLE_DB}
                                        disableKeyEvent={disableKeyEvent}
                                    />
                                </Box>
                                <Box
                                    sx={{width:"20%", paddingLeft:"5px"}}
                                >
                                    <span style={{fontSize:"12px"}}>{MAX_POSSIBLE_DB}</span>
                                </Box>
                            </Box>

                        </Box>
                    </Box>

                    <Divider sx={{marginTop:"2px", marginLeft:"15px", marginRight:"15px"}} color="#4a4a4a"/>

                    <Box sx={{ width:"100%", paddingBottom:"5px", display:"flex", justifyContent:"flex-start", alignItems:"center", gap:"10px" }} >
                        <span style={{fontSize:"14px"}}>Color Map</span>
                        <div style={{ display: "flex", alignItems: "center", "marginLeft":"3px", "marginRight":"10px", "marginTop":"5px" }}>
                            <select
                                id="colormap"
                                value={colorMap}
                                onChange={(event) => {
                                    setColorMap(event.target.value);
                                }}
                                style={{
                                    padding: '0px',
                                    fontSize: '14px',
                                    borderRadius: '4px',
                                    border: '1px solid #ccc',
                                    color: "#60A5FA",
                                    backgroundColor: "transparent",
                                }}
                            >
                                {/* Dropdown options */}
                                <option value="inferno">inferno</option>
                                <option value="viridis">viridis</option>
                                <option value="magma">magma</option>
                                <option value="gray">gray</option>
                                <option value="plasma">plasma</option>
                                <option value="cividis">cividis</option>
                            </select>
                        </div>
                    </Box>

                    <Divider sx={{marginTop:"2px", marginLeft:"15px", marginRight:"15px"}} color="#4a4a4a"/>
                    
                    <Box sx={{ width:"100%", paddingBottom:"5px", display:"flex", justifyContent:"flex-start", alignItems:"center", gap:"10px" }} >
                        <Box sx={{width:"30%", display:"flex", flexDirection:"column", justifyContent:"flex-start" }} >
                            <span style={{fontSize:"14px"}}>Spectrogram Height</span>
                        </Box>
                        <Box
                            sx={{width:"70%", display:"flex", flexDirection:"row", justifyContent:"flex-start" }}>
                            <Box sx={{width:"10%"}} />
                            <Box sx={{width:"63%"}} >
                                <Slider
                                    value={specCanvasHeight}
                                    onChange={(event, newValue)=>{setSpecCanvasHeight(newValue)}}
                                    min={50}
                                    max={500}
                                    step={1} // Ensures only integer values
                                    valueLabelDisplay="auto" // Shows the value label on hover or drag
                                    slotProps={{thumb: {onKeyDown: (e) => { 
                                            if (disableKeyEvent){
                                                e.preventDefault();
                                            }
                                        }
                                    }}}
                                    sx={{
                                        height:"3px",
                                        // Method 1: Direct thumb sizing
                                        '& .MuiSlider-thumb': {
                                            width: 14,  // Default is 20px
                                            height: 14, // Default is 20px
                                        },
                                    }}
                                />
                            </Box>
                        </Box>
                    </Box>

                </Box>
            }
            </Box>
    )
}

export default SpectrogramParameters;
