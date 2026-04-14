// React
import React, {useEffect, useRef, useState, useCallback} from 'react';
import {createPortal} from 'react-dom';

// External dependencies
import axios from 'axios';
import {nanoid} from "nanoid";
import {toast} from "react-toastify";
import emitter from './eventEmitter';

// Module-level storage for labels and audioIDs to persist across component remounts
// Keys: trackID -> labels array, `${trackID}_audioID` -> audioID string
const labelsStorage = new Map();
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from "@mui/material/LinearProgress";
import Box from "@mui/material/Box";
import IconButton from '@mui/material/IconButton';
import TuneIcon from '@mui/icons-material/Tune';
import StopIcon from '@mui/icons-material/Stop';
import PauseIcon from '@mui/icons-material/Pause';
import DeleteIcon from '@mui/icons-material/Delete';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DensityLargeIcon from '@mui/icons-material/DensityLarge';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import {Button, TextField} from '@mui/material';
import LineStyleIcon from '@mui/icons-material/LineStyle';
import ContrastIcon from '@mui/icons-material/Contrast';
import LightModeIcon from '@mui/icons-material/LightMode';
import PaletteIcon from '@mui/icons-material/Palette';
import Divider from '@mui/material/Divider';

 
// Internal dependencies
import SpectrogramParameters from "./SpectrogramParameters"
import WhisperSeg from "./WhisperSeg.jsx"
import LabelWindow from "./LabelWindow.jsx";
import LocalFileUpload from "./LocalFileUpload.jsx";
import { useOpenWindowsContext } from './OpenWindowsContext.jsx'; // Adjust path as necessary
import {Label} from "./label.js"
import {binsToTime, binToTime, importTimeToBins, binsToExportTime} from "./utils.js"
import {freqBtn, icon, iconBtn, iconBtnDisabled, iconBtnSmall, iconSmall, toggleVisibilityBtn} from "./buttonStyles.js"
import {
    Species,
    Individual,
    Clustername,
    activateClustername,
    activateIndividual,
    checkIfEveryObjectIsInactive,
    deactivateExistingClusternames,
    deactivateExistingIndividuals,
    ANNOTATED_AREA,
    ANNOTATED_AREA_CLUSTERNAME,
    ANNOTATED_AREA_COLOR,
    ANNOTATED_AREA_INDIVIDUAL_TRAIN_WHISPERSEG,
    DEFAULT_UNKNOWN_CLUSTERNAME_COLOR,
    CLUSTERNAME_COLOR_ARRAY,
    INACTIVE_BUTTON_COLOR,
    UNKNOWN_CLUSTERNAME,
    UNKNOWN_INDIVIDUAL,
    UNKNOWN_SPECIES
} from './species.js'
import { concat } from 'lodash';

// Classes Definitions
class Playhead{
    constructor(timeframe) {
        this.timeframe = timeframe
    }
}

// Global variables
const HEIGHT_BETWEEN_INDIVIDUAL_LINES = 16
const ZERO_GAP_CORRECTION_MARGIN = 0.0005
const FREQUENCY_LINES_COLOR = '#47ff14'
const ACTIVE_LABEL_COLOR = '#ffffff'
const WAVEFORM_COLOR = '#ddd8ff'

function Track(
        {
            trackID,
            speciesArray,
            deletedItemID,
            globalAudioDuration,
            globalClipDuration,
            currentStartTime,
            currentEndTime,
            setCurrentStartTime,
            setCurrentEndTime,
            removeTrackInApp,
            globalHopLength,
            globalNumSpecColumns,
            globalSamplingRate,
            updateClipDurationAndTimes,
            strictMode,
            strictDevMode,
            importedLabels,
            handleUploadResponse,
            handleMultipleLocalFileUploads,
            trackData,
            passFilesUploadingToApp,
            addLabelsToApp,
            exportRequest,
            submitRequest,
            zipExportRequest,
            toggleTrackVisibility,
            moveTrackUp,
            moveTrackDown,
            lastTrackIndex,
            passSpeciesArrayToApp,
            tokenInference,
            tokenFinetune,
            passTokenInferenceToWhisperSeg,
            passTokenFinetuneToWhisperSeg,
            authToken,
            setAuthToken,
            isAuthenticated,
            setIsAuthenticated,
            globalSpecCanvasHeight,
            showAllWaveforms,
            showAllAnnotationCanvases,
            globalSpecBrightness,
            globalSpecContrast,
            globalColorMap,
            annotationTimestamps,
            getCurrentUTCTime,
            getDeviceInfo,
            hashID,
            canvasWidth,
            TRACK_SIDEBAR_WIDTH,
            DEFAULT_UNKNOWN_CLUSTERNAME_COLOR,
            disableKeyEvent,
            setDisableKeyEvent,
            userGivenStartTime,
            disableOnsetOffsetEdit,
            setUploadProgress,
            MAX_FILE_SIZE,
            projectData,
            passTrackMetaObjToApp,
            allowAnnotationOverlap,
        }
    )
{
    //console.log('[DEBUG] 🔄 Track component rendering/mounting. trackID:', trackID, 'trackData.audioID:', trackData.audioID)

    // General
    const [trackName, setTrackName] = useState('')
    const [audioId, setAudioId] = useState(trackData.audioID)
    // Initialize audioIdRef from storage to persist across remounts
    const audioIdRef = useRef(labelsStorage.get(`${trackID}_audioID`) || trackData.audioID)

    // Spectrogram
    const specCanvasRef = useRef(null)
    const specOverlayCanvasRef = useRef(null)
    const specImgData = useRef(null)
    const [spectrogram, setSpectrogram] = useState(trackData.spectrogram)

    const [specCanvasHeight, setSpecCanvasHeight] = useState( globalSpecCanvasHeight )

    // Frequency
    const frequenciesCanvasRef = useRef(null)
    const [frequencies, setFrequencies] = useState(trackData.frequencies)
    const frequenciesRef = useRef(frequencies) // Keep ref in sync with state
    const [showFrequencyLines, setShowFrequencyLines] = useState(false)

    const [frequencyLines, setFrequencyLines] = useState({maxFreqY: -10, minFreqY: specCanvasHeight+10})
    const frequencyLinesRef = useRef({maxFreqY: -10, minFreqY: specCanvasHeight+10})
    const [frequencyRanges, setfrequencyRanges] = useState( null )

    let draggedFrequencyLinesObject = null

    // Frequency zoom state refs (for A/S keys)
    const spectrogramIsLoadingRef = useRef(false)

    // Track previous audioID and duration to detect actual changes (not just object reference changes)
    const previousAudioIDRef = useRef(null)
    const previousGlobalAudioDurationRef = useRef(null)

    // Flag to prevent time-zoom useEffect from firing during frequency zoom (A/S keys)
    const isFrequencyZoomingRef = useRef(false)

    // Abort controller for cancelling pending backend requests
    const abortControllerRef = useRef(null)

    // Labels and Individuals Canvases
    const [showLabelAndIndividualsCanvas, setShowLabelAndIndividualsCanvas] = useState(true)

    // Label Canvas
    const labelCanvasRef = useRef(null)
    const labelOverlayCanvasRef = useRef(null)

    const animationFrameRef = useRef(null);
    const hoverAnimationFrameRef = useRef(null); // For throttling hover redraws

    // Individuals Canvas
    const individualsCanvasRef = useRef(null)
    const numberOfIndividuals = speciesArray.reduce((total, speciesObj) => total + speciesObj.individuals.length, 0)
    
    const [clusternamesAnchorOrigin, setClusternamesAnchorOrigin] = useState(null)
    const [selectedSpeciesId, setSelectedSpeciesId] = useState(null)
    const [selectedIndividualId, setSelectedIndividualId] = useState(null)
    const [selectedIndividualGlobalIndex, setSelectedIndividualGlobalIndex] = useState(null)

    const closeClusterNameListRef = useRef(null)

    // Labels - initialize from storage to persist across remounts
    const [labels, setLabels] = useState(() => labelsStorage.get(trackID) || [])
    const labelsRef = useRef([])
    const [activeLabel, setActiveLabel] = useState(null)
    let draggedActiveLabel = null
    let clickedLabel = undefined
    let lastHoveredLabel = {labelObject: null, isHighlighted: false}
    const [activeIndividualIndex, setActiveIndividualIndex] = useState(1);
    const [activeClusterColor, setActiveClusterColor] = useState(DEFAULT_UNKNOWN_CLUSTERNAME_COLOR);

    // Persist labels to storage whenever they change (survives remounts)
    useEffect(() => {
        labelsStorage.set(trackID, labels)
        //console.log('[DEBUG] Labels saved to storage. trackID:', trackID, 'count:', labels.length)
    }, [labels, trackID])

    // Debug: Log labels changes
    useEffect(() => {
        //console.log('[DEBUG] Labels array changed! New length:', labels.length, 'Labels:', labels.map(l => ({ id: l.id, onsetBin: l.onsetBin, offsetBin: l.offsetBin })))
        if (labels.length === 0) {
            //console.log('[DEBUG] ⚠️ Labels cleared! Stack trace:')
            //console.trace()
        }
    }, [labels])

    // Audio
    const playheadRef = useRef(new Playhead(0))
    const [audioSnippet, setAudioSnippet] = useState(null)
    const [playWindowTimes, setPlayWindowTimes] = useState(null)
    const pauseAudioRef = useRef( false )
    const audioSnippetOffsetRef = useRef( 0 )
    const [isPlayingAudio, setIsPlayingAudio] = useState(false)
    const [isControllingAudioPlay, setIsControllingAudioPlay] = useState(false)

    // Waveform
    const waveformCanvasRef = useRef(null)
    const waveformOverlayCanvasRef = useRef(null)
    const waveformImgData = useRef(null)
    const waveformDataCache = useRef(null) // Cache waveform data to avoid refetching
    const waveformCacheKey = useRef(null) // Track what's cached
    const [audioArray, setAudioArray] = useState(null)
    const [waveformScale, setWaveformScale] = useState(3)
    const [displayWaveform, setDisplayWaveform] = useState(true)
    // Deprecated: NO LONGER USE showWaveform in the future, leave it untouched!
    const [showWaveform, setShowWaveform] = useState(true)

    //drag ref
    const dragListenerRef = useRef(null);
    const rectangleDragRef = useRef(null); // {startX, startY, startTime, isActive}
    const isFrequencyModeKeyRef = useRef(false); // Ref to track F key state
    const disableKeyEventRef = useRef(disableKeyEvent); // Ref to track current disable state for event handlers
    const mousePositionRef = useRef({ x: null, y: null }); // Track current mouse position for zoom

    const browseLabelsRef = useRef(null)

    // File Upload
    const [spectrogramIsLoading, setSpectrogramIsLoading] = useState(false)

    // Local Parameters
    const [showLocalConfigWindow, setShowLocalConfigWindow] = useState(false)
    const [specCalMethod, setSpecCalMethod] = useState(trackData.specCalMethod ? trackData.specCalMethod : 'linear')
    const [nfft, setNfft] = useState(trackData.nfft ? trackData.nfft : '')
    const [binsPerOctave, setBinsPerOctave] = useState(trackData.binsPerOctave ? trackData.binsPerOctave: '')
    const [minFreq, setMinFreq] = useState(trackData.minFreq ? trackData.minFreq : '')
    const [maxFreq, setMaxFreq] = useState(trackData.maxFreq ? trackData.maxFreq : '')
    const [nBins, setNBins] = useState(256);

    const specCalMethodRef = useRef(null);
    const nfftRef = useRef(null);
    const hopLengthRef = useRef(null);
    const activeLabelRef = useRef(null);
    const labelCenterTimeRef = useRef(null);
    const binsPerOctaveRef = useRef(null);
    const minFreqRef = useRef(null);
    const maxFreqRef = useRef(null);
    const nBinsRef = useRef(null);

    // Store pending frequency changes to apply after current spectrogram loads
    const pendingFreqChangeRef = useRef(null);

    // WhisperSeg
    const [whisperSegIsLoading, setWhisperSegIsLoading] = useState(false)

    // Active Species
    const activeSpecies = speciesArray.find(speciesObj =>
        speciesObj.individuals.some(individual => individual.isActive)
    )

    // Label Window
    const [expandedLabel, setExpandedLabel] = useState(null)
    const [globalMouseCoordinates, setGlobalMouseCoordinates] = useState(null)

    // Icons
    const activeIcon = showWaveform ? icon : iconSmall
    const activeIconBtnStyle = showWaveform ? iconBtn : iconBtnSmall

    // Scroll Context
    const { setAnyWindowsOpen } = useOpenWindowsContext();

    // Frequency Lines
    const allowUpdateMinFreqGivenLineY = useRef( false );
    const allowUpdateMaxFreqGivenLineY = useRef( false );

    const [numFreqLinesToAnnotate, setNumFreqLinesToAnnotate] = useState(0)

    // Layout (Track Height)
    const [specHeight, setSpecHeight] = useState('300px');
    // Experimental debug
    // State to control the height of B and C
    const [isHidden, setIsHidden] = useState(false);

    // Calculate heights based on isHidden state
    const WAVEFORM_CVS_HEIGHT = displayWaveform ? 60 : 0; // height of B and C
    const specYAxisWidth = 45;
    const controlPanelWidth = TRACK_SIDEBAR_WIDTH - specYAxisWidth;

    // Spectrogram
    const [ specBrightness, setSpecBrightness ] = useState(1.0);
    const [ specContrast, setSpecContrast ] = useState(1.0);
    const [sliderSpecBrightnessValue, setSliderSpecBrightnessValue] = useState(1);
    const [sliderSpecContrastValue, setSliderSpecContrastValue] = useState(1);
    const [colorMap, setColorMap] = useState('inferno');
    const [dbMin, setDbMin] = useState( -80 );
    const [dbMax, setDbMax] = useState( 30 );
    
    const [ isUserGivenStartTimeUsed, setIsUserGivenStartTimeUsed ] =  useState( false );

    /* ++++++++++++++++++++ Pass methods ++++++++++++++++++++ */

    const passSpectrogramIsLoadingToTrack = ( boolean ) => {
        setSpectrogramIsLoading( boolean )
    }

    const passShowLocalConfigWindowToTrack = ( boolean ) => {
        setShowLocalConfigWindow( boolean )
    }

    const passSpecCalMethodToTrack = ( newSpecCalMethod ) => {
        setSpecCalMethod( newSpecCalMethod )
    }

    const passNfftToTrack = ( newNfft ) => {
        setNfft( newNfft )
    }

    const passBinsPerOctaveToTrack = ( newBinsPerOctave ) => {
        setBinsPerOctave( newBinsPerOctave )
    }

    const passMinFreqToTrack = ( newMinFreq ) => {
        setMinFreq( newMinFreq )
    }

    const passMaxFreqToTrack = ( newMaxFreq ) => {
        setMaxFreq( newMaxFreq )
    }

    const passLabelsToTrack = ( newLabelsArray ) => {
        setLabels( newLabelsArray )
        drawAllCanvases(spectrogram, frequencies, audioArray, newLabelsArray)
    }

    const passExpandedLabelToTrack = ( newExpandedLabel ) => {
        setExpandedLabel( newExpandedLabel )

        // Clear active label when closing the label window
        if (newExpandedLabel === null) {
            emitter.emit('dataChange', {
                onsetBin: undefined,
                offsetBin: undefined,
                onsetTime: undefined,
                offsetTime: undefined,
                id: undefined,
                trackID: undefined,
                color: undefined,
            })

            // Clear frequency lines when closing the label window
            setShowFrequencyLines(false)
            setNumFreqLinesToAnnotate(0)
            allowUpdateMinFreqGivenLineY.current = false
            allowUpdateMaxFreqGivenLineY.current = false

            // Redraw canvases to remove frequency lines
            if (spectrogram && frequencies && audioArray) {
                drawAllCanvases(spectrogram, frequencies, audioArray, labelsRef.current)
            }
        }
    }

    const passWhisperSegIsLoadingToTrack = ( boolean ) => {
        setWhisperSegIsLoading( boolean )
    }


    /* ++++++++++++++++++ Handle brightness/contrast slider dragging ++++++++++++++++++ */
    // Update the slider value as user drags
    const handleSliderSpecBrightnessChange = (event) => {
        setSliderSpecBrightnessValue(parseFloat(event.target.value));
    };
    const handleSliderSpecBrightnessMouseUp = () => {
        setSpecBrightness(sliderSpecBrightnessValue);
    };

    const handleSliderSpecContrastChange = (event) => {
        setSliderSpecContrastValue(parseFloat(event.target.value))
    };

    const handleSliderSpecContrastMouseUp = () => {
        setSpecContrast( sliderSpecContrastValue )
    };


    /* ++++++++++++++++++ Backend API calls ++++++++++++++++++ */

    const getAudioClipSpec = async () => {
        // Cancel any pending request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }

        // Create new abort controller for this request
        abortControllerRef.current = new AbortController()

        // Use ref to avoid stale audioId from closure
        const currentAudioId = audioIdRef.current || audioId
        if (!currentAudioId) {
            return null
        }

        const path = import.meta.env.VITE_BACKEND_SERVICE_ADDRESS+'get-audio-clip-spec'

        const finalMinFreq = minFreqRef.current !== null ? minFreqRef.current : minFreq
        const finalMaxFreq = maxFreqRef.current !== null ? maxFreqRef.current : maxFreq

        // Get device pixel ratio for high-resolution displays
        const dpr = window.devicePixelRatio || 1

        const requestParameters = {
            audio_id: currentAudioId,
            start_time: currentStartTime,
            hop_length: globalHopLength,
            num_spec_columns: globalNumSpecColumns,
            sampling_rate: globalSamplingRate,
            spec_cal_method: specCalMethod,
            n_fft: Number(nfft),
            bins_per_octave: Number(binsPerOctave),
            min_frequency: Number(finalMinFreq),
            max_frequency: Number(finalMaxFreq),
            brightness: specBrightness,
            contrast: specContrast,
            color_map: colorMap,
            db_min: dbMin,
            db_max: dbMax,
            target_width: Math.round(canvasWidth * dpr),  // Request high-res image for HiDPI displays
            target_height: Math.round(specCanvasHeight * dpr),  // Request high-res image for HiDPI displays
        }


        try {
            const response = await axios.post(path, requestParameters, {
                signal: abortControllerRef.current.signal
            })

            // Update potentially by the backend corrected values in the input fields (e.g. when the user requests nfft < 5)
            const newSpecCalMethod = response.data.configurations.spec_cal_method
            const newNfft = response.data.configurations.n_fft
            const newBinsPerOctave = response.data.configurations.bins_per_octave
            const newMinFreq = response.data.configurations.min_frequency
            const newMaxFreq = response.data.configurations.max_frequency
            const newNBins = response.data.configurations.n_bins
            setSpecCalMethod(newSpecCalMethod)
            setNfft(newNfft ? newNfft : 512)
            setBinsPerOctave(newBinsPerOctave ? newBinsPerOctave : 0)

            // Only update if actually different to prevent infinite loop
            const finalMinFreq = newMinFreq ? newMinFreq : 0
            const finalMaxFreq = newMaxFreq ? newMaxFreq : 16000
            if (finalMinFreq !== minFreqRef.current) setMinFreq(finalMinFreq)
            if (finalMaxFreq !== maxFreqRef.current) setMaxFreq(finalMaxFreq)

            setNBins( newNBins )

            return response.data

        } catch (error) {
            // Don't show error if request was aborted (user made a new request)
            if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
                return null
            }
            toast.error('Something went wrong trying compute the spectrogram. Check the console for more information.')
        }
    }

    const getSpecAndAudioArray = async () => {
        try {
            const [data, newAudioArray] = await Promise.all(
                [
                    getAudioClipSpec(),
                    getAudioArray()
                ]
            )

            // If no audio loaded yet, early return
            if (!data || !newAudioArray) {
                setSpectrogramIsLoading(false)
                passFilesUploadingToApp(false)
                return
            }

            // DO NOT recalculate labels when zooming!
            // Recompute label bin positions when spectrogram parameters change
            const newLabels = getUpdatedLabelsGivenSpecParaChange( data.configurations.spec_cal_method,
                data.configurations.bins_per_octave, data.configurations.min_frequency, data.configurations.n_bins,
                data.configurations.n_fft, data.configurations.sampling_rate, data.configurations.hop_length
            )
            setLabels( newLabels )
            labelsRef.current = newLabels

            // Convert active label bins for this track's new hop/nfft config
            // Use the matching label from newLabels (already converted from stored time)
            const currentActiveLabel = activeLabelRef.current
            if (currentActiveLabel && currentActiveLabel.onsetBin !== undefined && hopLengthRef.current !== null) {
                const oldHop = hopLengthRef.current
                const newHop = data.configurations.hop_length
                const oldNfft = nfftRef.current
                const newNfft = data.configurations.n_fft
                if (oldHop !== newHop || oldNfft !== newNfft) {
                    // Find the matching label that was already correctly converted from stored time
                    const matchingLabel = newLabels.find(l => l.id === currentActiveLabel.id)
                    let newOnsetBin, newOffsetBin
                    if (matchingLabel) {
                        newOnsetBin = matchingLabel.onsetBin
                        newOffsetBin = matchingLabel.offsetBin
                    } else {
                        // Fallback for cross-track or in-progress labels
                        newOnsetBin = currentActiveLabel.onsetBin * oldHop / newHop
                        newOffsetBin = currentActiveLabel.offsetBin
                    }
                    const updatedActiveLabel = {
                        ...currentActiveLabel,
                        onsetBin: newOnsetBin,
                        offsetBin: newOffsetBin,
                    }
                    activeLabelRef.current = updatedActiveLabel
                    setActiveLabel(updatedActiveLabel)
                }
            }
            setSpectrogram(data.spec)
            setSpectrogramIsLoading(false)
            passFilesUploadingToApp(false)
            setFrequencies(data.freqs.map( (freq) => Math.round(freq) ))
            setAudioArray(newAudioArray)

            specCalMethodRef.current = data.configurations.spec_cal_method;
            nfftRef.current = data.configurations.n_fft;
            hopLengthRef.current = data.configurations.hop_length;
            binsPerOctaveRef.current = data.configurations.bins_per_octave;
            minFreqRef.current = data.configurations.min_frequency;
            maxFreqRef.current = data.configurations.max_frequency;
            nBinsRef.current = data.configurations.n_bins;

            drawAllCanvases(data.spec, data.freqs.map( (freq) => Math.round(freq) ), newAudioArray, newLabels)

            // Apply any pending frequency changes that were queued during loading
            if (pendingFreqChangeRef.current) {
                const pending = pendingFreqChangeRef.current
                pendingFreqChangeRef.current = null
                // Apply pending changes after a short delay to ensure current render completes
                setTimeout(() => {
                    setMinFreq(pending.minFreq)
                    setMaxFreq(pending.maxFreq)
                }, 50)
            }

        } catch (error) {
            toast.error('An error occurred trying to generate the spectrogram. Check the console for more information')
            console.error('Error fetching data:', error)
        }

        // Set up start time
        if (!( userGivenStartTime === null || globalClipDuration === null || isUserGivenStartTimeUsed )){
            setCurrentStartTime( userGivenStartTime );
            setCurrentEndTime(userGivenStartTime + globalClipDuration ) 
            setIsUserGivenStartTimeUsed(true);  // only set the start time using userGivenStartTime once
        }

    }

    const submitLocalParameters = () => {
        if (!globalClipDuration || !trackData) return

        if (audioSnippet) {
            audioSnippet.pause()
            audioSnippet.currentTime = currentStartTime
        }

        setSpectrogramIsLoading(true)
        getSpecAndAudioArray()
        emitter.emit('resetPlayhead', currentStartTime)
    }

    const handleUploadError = (error) => {
        setSpectrogramIsLoading( false )
        toast.error('Error while uploading. Check the console for more information.', {autoClose: false})
        console.error("Error uploading file:", error)

    }

    const checkMouseLocation = (event) => {
        const isClickingWaveFormCanvas = waveformCanvasRef.current !== null?  event.clientY - waveformCanvasRef.current.getBoundingClientRect().top < waveformCanvasRef.current.height : false
        const isClickingLabelCanvas = labelCanvasRef.current !== null?  event.clientY - labelCanvasRef.current.getBoundingClientRect().top  > 0 : false
        const isClickingSpecCanvas = specCanvasRef.current !== null? event.clientY - specCanvasRef.current.getBoundingClientRect().top > 0 && event.clientY - specCanvasRef.current.getBoundingClientRect().top < specCanvasRef.current.height : false
        return {
            isClickingWaveFormCanvas, isClickingLabelCanvas, isClickingSpecCanvas
        }
    }

    /* ++++++++++++++++++ Mouse Interaction methods ++++++++++++++++++ */

    const handleLMBDown = (event) => {

        // Don't proceed if no spectrogram is present in the track
        if (!spectrogram) {
            return
        }

        // Don't proceed if audio is currently playing
        if (audioSnippet && !audioSnippet.paused) {
            return
        }

        allowUpdateMaxFreqGivenLineY.current = false
        allowUpdateMinFreqGivenLineY.current = false

        // Ignore clicks from other mouse buttons
        if (event.button !== 0) {
            return
        }

        const mouseX = getMouseX(event)
        const mouseY = getMouseY(event)

        // Don't proceed if the click happens after the end of the audio (this can happen with multi-file set up of different audio-lengths)
        const maxAudioX = calculateXPositionFromTime(trackData.audioDuration)
        if (mouseX > maxAudioX){
            return
        }

        const mouseLoc = checkMouseLocation(event)

        // Deal with click on Onset or Offset to trigger drag methods
        if ( checkIfOccupiedByOnsetOrOffset(mouseX, mouseY, event.target.className === 'label-canvas')){

            // Deal with click on Onset
            clickedLabel = checkIfClickedOnOnset(mouseX, mouseY, event.target.className === 'label-canvas' )
            if ( clickedLabel ){
                annotationTimestamps.current = [...annotationTimestamps.current, {
                    "hash_id":hashID,
                    "timestamp":getCurrentUTCTime().toISOString(),
                    "action":"update_onset",
                    "deviceInfo":getDeviceInfo()
                } ];

                // specCanvasRef.current.addEventListener('mousemove', dragOnset)
                // waveformCanvasRef.current.addEventListener('mousemove', dragOnset)
                // labelCanvasRef.current.addEventListener('mousemove', dragOnset)

                dragListenerRef.current = dragOnset;
                specCanvasRef.current.addEventListener('mousemove', dragListenerRef.current)
                waveformCanvasRef.current.addEventListener('mousemove', dragListenerRef.current)
                labelCanvasRef.current.addEventListener('mousemove', dragListenerRef.current)
                return
            }

            // Deal with click on Offset
            clickedLabel = checkIfClickedOnOffset(mouseX, mouseY, event.target.className === 'label-canvas')
            if (clickedLabel){
                annotationTimestamps.current = [...annotationTimestamps.current, {
                    "hash_id":hashID,
                    "timestamp":getCurrentUTCTime().toISOString(),
                    "action":"update_offset",
                    "deviceInfo":getDeviceInfo()
                } ];

                specCanvasRef.current.addEventListener('mousemove', dragOffset)
                waveformCanvasRef.current.addEventListener('mousemove', dragOffset)
                labelCanvasRef.current.addEventListener('mousemove', dragOffset)
                return
            }
        }

        // Deal with click on Active Label onset
        if (checkIfClickedOnActiveLabelOnset(mouseX)) {
            annotationTimestamps.current = [...annotationTimestamps.current, {
                "hash_id":hashID,
                "timestamp":getCurrentUTCTime().toISOString(),
                "action":"update_onset",
                "deviceInfo":getDeviceInfo()
            } ];

            draggedActiveLabel = JSON.parse(JSON.stringify(activeLabel))
            specCanvasRef.current.addEventListener('mousemove', dragActiveLabelOnset)
            waveformCanvasRef.current.addEventListener('mousemove', dragActiveLabelOnset)
            return
        }

        // Deal with click on Active Label offset
        if (checkIfClickedOnActiveLabelOffset(mouseX)) {
            annotationTimestamps.current = [...annotationTimestamps.current, {
                "hash_id":hashID,
                "timestamp":getCurrentUTCTime().toISOString(),
                "action":"update_offset",
                "deviceInfo":getDeviceInfo()
            } ];

            draggedActiveLabel = JSON.parse(JSON.stringify(activeLabel))
            specCanvasRef.current.addEventListener('mousemove', dragActiveLabelOffset)
            waveformCanvasRef.current.addEventListener('mousemove', dragActiveLabelOffset)
            return
        }

        // Deal with click on Max Frequency Line
        if (checkIfOccupiedByMaxFreqLine(mouseY) && event.target.className === 'spec-canvas'){
            annotationTimestamps.current = [...annotationTimestamps.current, {
                "hash_id":hashID,
                "timestamp":getCurrentUTCTime().toISOString(),
                "action":"update_frequency",
                "deviceInfo":getDeviceInfo()
            } ];

            draggedFrequencyLinesObject = frequencyLines
            specCanvasRef.current.addEventListener('mousemove', dragMaxFreqLine)
            allowUpdateMaxFreqGivenLineY.current = true // User is going to drag the frequency line
            return
        }
    
        // Deal with click on Min Frequency Line
        if (checkIfOccupiedByMinFreqLine(mouseY) && event.target.className === 'spec-canvas'){
            annotationTimestamps.current = [...annotationTimestamps.current, {
                "hash_id":hashID,
                "timestamp":getCurrentUTCTime().toISOString(),
                "action":"update_frequency",
                "deviceInfo":getDeviceInfo()
            } ];

            draggedFrequencyLinesObject = frequencyLines
            specCanvasRef.current.addEventListener('mousemove', dragMinFreqLine)
            allowUpdateMinFreqGivenLineY.current = true
            return
        }

        // Deal with click inside an existing label
        const labelToBeExpanded = checkIfClickedOnLabel(event, mouseX, mouseY)
        if ( labelToBeExpanded ) {
            setExpandedLabel( labelToBeExpanded )
            emitter.emit('dataChange', {
                onsetBin: labelToBeExpanded.onsetBin,
                offsetBin: labelToBeExpanded.offsetBin,
                onsetTime: binToTime(labelToBeExpanded.onsetBin, globalHopLength, globalSamplingRate),
                offsetTime: binToTime(labelToBeExpanded.offsetBin, globalHopLength, globalSamplingRate),
                id: labelToBeExpanded.id,
                trackID: trackID,
                color: ACTIVE_LABEL_COLOR,
            })

            emitter.emit('updateOnFocusTrackID', trackID )

            setGlobalMouseCoordinates({x: event.clientX, y: event.clientY})

            return
        }

        // Add offset to existing label if necessary
        if ( (mouseLoc.isClickingWaveFormCanvas || mouseLoc.isClickingSpecCanvas) && labels.length > 0 ){
            const newestLabel = labels[labels.length-1]
            // Check if newest label is missing an offset (undefined, null, NaN, or empty string)
            const needsOffset = newestLabel.offsetBin === undefined ||
                               newestLabel.offsetBin === null ||
                               isNaN(newestLabel.offsetBin) ||
                               newestLabel.offsetBin === ''

            console.log('[DEBUG] Checking if should add offset:', {
                labelsCount: labels.length,
                newestLabelId: newestLabel.id,
                newestLabelOnsetBin: newestLabel.onsetBin,
                newestLabelOffsetBin: newestLabel.offsetBin,
                offsetType: typeof newestLabel.offsetBin,
                needsOffset: needsOffset
            })

            if (needsOffset){
                console.log('[DEBUG] Entering needsOffset block - will add offset')

                if (disableOnsetOffsetEdit){
                    console.log('[DEBUG] disableOnsetOffsetEdit is true, returning early')
                    return
                }

                console.log('[DEBUG] About to add offset')
                annotationTimestamps.current = [...annotationTimestamps.current, {
                    "hash_id":hashID,
                    "timestamp":getCurrentUTCTime().toISOString(),
                    "action":"add_offset",
                    "deviceInfo":getDeviceInfo()
                } ];

                let newOffset = null
                if (specCalMethod!=="constant-q"){
                    newOffset = calculateBinIndex(event)
                }else{
                    newOffset = calculateBinIndexConstantQOffset(event)
                }

                newOffset = magnet(newOffset)

                const labelsCopy = [...labels]
                const labelToUpdate = {...newestLabel} // Deep copy the label object

                if (newOffset < labelToUpdate.onsetBin){
                    if (specCalMethod!== "constant-q"){
                        labelToUpdate.offsetBin = newOffset
                        labelsCopy[labels.length-1] = flipOnsetOffset(labelToUpdate)
                    }else{
                        // In constantQ, do not swap onset offset to avoid confusion
                        labelToUpdate.offsetBin = labelToUpdate.onsetBin
                        labelsCopy[labels.length-1] = labelToUpdate
                    }
                } else {
                    labelToUpdate.offsetBin = newOffset
                    labelsCopy[labels.length-1] = labelToUpdate
                }

                // Compute ground truth time now that both onset and offset are set
                const finalLabel = labelsCopy[labels.length-1]
                const config = getConfigSnapshot()
                const time = binsToTime(finalLabel.onsetBin, finalLabel.offsetBin, config.nfft, config.hopLength, globalSamplingRate)
                finalLabel.onsetTime = time.onset
                finalLabel.offsetTime = time.offset

                setLabels(labelsCopy)

                emitter.emit('dataChange', {
                    onsetBin: labelsCopy[labels.length-1].onsetBin,
                    offsetBin: labelsCopy[labels.length-1].offsetBin,
                    onsetTime: binToTime(labelsCopy[labels.length-1].onsetBin, globalHopLength, globalSamplingRate),
                    offsetTime: binToTime(labelsCopy[labels.length-1].offsetBin, globalHopLength, globalSamplingRate),
                    id: labelsCopy[labels.length-1].id,
                    trackID: trackID,
                    color: ACTIVE_LABEL_COLOR,
                })
                emitter.emit('updateOnFocusTrackID', trackID )
                return
            }
        }

        // In this case, we are in the state of adding frequency lines
        if (numFreqLinesToAnnotate > 0 ){
            if( event.target.className === 'spec-canvas' ){
                annotationTimestamps.current = [...annotationTimestamps.current, {
                    "hash_id":hashID,
                    "timestamp":getCurrentUTCTime().toISOString(),
                    "action":"add_frequency",
                    "deviceInfo":getDeviceInfo()
                } ];

                if (numFreqLinesToAnnotate == 2){
                    setFrequencyLines( {...frequencyLines, minFreqY:mouseY } )
                    allowUpdateMinFreqGivenLineY.current = true
                }else{
                    const newMinFreqY = Math.max( frequencyLines.minFreqY, mouseY )
                    const newMaxFreqY = Math.min( frequencyLines.minFreqY, mouseY )
                    setFrequencyLines( { minFreqY:newMinFreqY, maxFreqY:newMaxFreqY } )
                    allowUpdateMinFreqGivenLineY.current = true
                    allowUpdateMaxFreqGivenLineY.current = true
                }
                setNumFreqLinesToAnnotate( numFreqLinesToAnnotate - 1 )
            }
            return 
        }

        // after excluding all the other possibilities, the only case is to add new onset
        // at this moment, close the previously opened Label Window, since we are switching to a new label
        setExpandedLabel(null);

        // Clear previous active label when starting a new label
        emitter.emit('dataChange', {
            onsetBin: undefined,
            offsetBin: undefined,
            onsetTime: undefined,
            offsetTime: undefined,
            id: undefined,
            trackID: undefined,
            color: undefined,
        })

        // Clear cached image data to force redraw without old label lines
        specImgData.current = null
        waveformImgData.current = null

        // Redraw canvases to remove old label lines
        if (spectrogram && frequencies && audioArray) {
            drawAllCanvases(spectrogram, frequencies, audioArray, labelsRef.current)
        }

        emitter.emit('updateOnFocusTrackID', trackID )
        // Add onset
        if (mouseLoc.isClickingWaveFormCanvas || mouseLoc.isClickingSpecCanvas){

            if (disableOnsetOffsetEdit){
                return
            }

            annotationTimestamps.current = [...annotationTimestamps.current, {
                "hash_id":hashID,
                "timestamp":getCurrentUTCTime().toISOString(),
                "action":"add_onset",
                "deviceInfo":getDeviceInfo()
            } ];

            let clickedBin = null
            if (specCalMethod!=="constant-q"){
                clickedBin = calculateBinIndex(event)
            }else{
                clickedBin = calculateBinIndexConstantQOnset(event)
            }

            clickedBin = magnet(clickedBin)

            // Initialize rectangle drag mode ONLY if 'F' key is pressed
            if (isFrequencyModeKeyRef.current) {
                rectangleDragRef.current = {
                    startX: mouseX,
                    startY: mouseY,
                    startBin: clickedBin,
                    isActive: true
                }

                // Add drag listener for rectangle drawing
                specCanvasRef.current.addEventListener('mousemove', dragRectangle)
                waveformCanvasRef.current.addEventListener('mousemove', dragRectangle)
                labelCanvasRef.current.addEventListener('mousemove', dragRectangle)

                // Add new label for rectangle mode
                addNewLabel(clickedBin)
            } else {
                // Normal click mode: only add onset
                addNewLabel(clickedBin)
            }
        } 

    }

    const handleMouseUp = (event) => {
        if (event.button !== 0) return

        // Handle rectangle drag completion (F key mode)
        if (rectangleDragRef.current && rectangleDragRef.current.isActive) {
            const mouseX = getMouseX(event)
            const mouseY = getMouseY(event)

            // Check if user actually dragged (moved at least 5 pixels in any direction)
            const dragDistanceX = Math.abs(mouseX - rectangleDragRef.current.startX)
            const dragDistanceY = Math.abs(mouseY - rectangleDragRef.current.startY)
            const minDragDistance = 5 // pixels

            if (dragDistanceX < minDragDistance && dragDistanceY < minDragDistance) {
                // User just clicked without dragging - treat as normal label creation (onset only)
                rectangleDragRef.current = null
                removeDragEventListeners()
                return
            }

            // Calculate offset bin
            let offsetBinVal = null
            if (specCalMethod !== "constant-q") {
                offsetBinVal = calculateBinIndex(event)
            } else {
                offsetBinVal = calculateBinIndexConstantQOffset(event)
            }
            offsetBinVal = magnet(offsetBinVal)

            // Calculate frequency range
            const canvasHeight = specCanvasRef.current.height
            const minY = Math.min(rectangleDragRef.current.startY, mouseY)
            const maxY = Math.max(rectangleDragRef.current.startY, mouseY)

            // Convert Y positions to frequencies
            const maxFrequency = getFrequencyAtYPosition(minY, canvasHeight, frequencies)
            const minFrequency = getFrequencyAtYPosition(maxY, canvasHeight, frequencies)

            // Update the newest label with offset and frequency range
            const labelsCopy = [...labels]
            const newestLabel = labelsCopy[labelsCopy.length - 1]
            if (newestLabel) {
                newestLabel.offsetBin = offsetBinVal
                newestLabel.minFreq = Math.round(minFrequency)
                newestLabel.maxFreq = Math.round(maxFrequency)
                // Compute ground truth time now that both onset and offset are set
                const config = getConfigSnapshot()
                const time = binsToTime(newestLabel.onsetBin, newestLabel.offsetBin, config.nfft, config.hopLength, globalSamplingRate)
                newestLabel.onsetTime = time.onset
                newestLabel.offsetTime = time.offset

                setLabels(labelsCopy)

                // Set mouse coordinates for LabelWindow positioning
                setGlobalMouseCoordinates({x: event.clientX, y: event.clientY})

                setExpandedLabel(newestLabel)

                emitter.emit('dataChange', {
                    onsetBin: newestLabel.onsetBin,
                    offsetBin: newestLabel.offsetBin,
                    onsetTime: binToTime(newestLabel.onsetBin, globalHopLength, globalSamplingRate),
                    offsetTime: binToTime(newestLabel.offsetBin, globalHopLength, globalSamplingRate),
                    id: newestLabel.id,
                    trackID: trackID,
                    color: ACTIVE_LABEL_COLOR,
                })
                emitter.emit('updateOnFocusTrackID', trackID)
            }

            // Reset rectangle drag state
            rectangleDragRef.current = null
        }

        removeDragEventListeners()

        // Only do this when mouse up event stems from dragging a label (equivalent to clickedLabel being true)
        if (clickedLabel){
            // Flip onset with offset if necessary
            if (clickedLabel.onsetBin > clickedLabel.offsetBin){
                clickedLabel = flipOnsetOffset(clickedLabel)
            }
            // Create zero gap labels if necessary
            clickedLabel.onsetBin = magnet(clickedLabel.onsetBin)
            clickedLabel.offsetBin = magnet(clickedLabel.offsetBin)

            // Recompute ground truth time after drag
            if (clickedLabel.offsetBin !== undefined) {
                const config = getConfigSnapshot()
                const time = binsToTime(clickedLabel.onsetBin, clickedLabel.offsetBin, config.nfft, config.hopLength, globalSamplingRate)
                clickedLabel.onsetTime = time.onset
                clickedLabel.offsetTime = time.offset
            }

            passLabelsToTrack(labels)
            if (clickedLabel.id === expandedLabel?.id){
                setExpandedLabel(clickedLabel)
            }
            emitter.emit('dataChange', {
                onsetBin: clickedLabel.onsetBin,
                offsetBin: clickedLabel.offsetBin,
                onsetTime: binToTime(clickedLabel.onsetBin, globalHopLength, globalSamplingRate),
                offsetTime: binToTime(clickedLabel.offsetBin, globalHopLength, globalSamplingRate),
                id: clickedLabel.id,
                trackID: trackID,
                color: ACTIVE_LABEL_COLOR,
            })

        }

        // Only do this when mouse up event stems from dragging the active label (equivalent to draggedActiveLabel being true)
        // ADD: this is used to drag the label of one channel from another channel
        if (draggedActiveLabel){

            // Flip onset with offset if necessary
            if (draggedActiveLabel.onsetBin > draggedActiveLabel.offsetBin){
                draggedActiveLabel = flipOnsetOffset(draggedActiveLabel)
            }
            // Create zero gap labels if necessary
            draggedActiveLabel.onsetBin = magnet(draggedActiveLabel.onsetBin)
            draggedActiveLabel.offsetBin = magnet(draggedActiveLabel.offsetBin)

            const newActiveLabel = {
                ...activeLabel,
                onsetBin: draggedActiveLabel.onsetBin,
                offsetBin: draggedActiveLabel.offsetBin,
                onsetTime: binToTime(draggedActiveLabel.onsetBin, globalHopLength, globalSamplingRate),
                offsetTime: binToTime(draggedActiveLabel.offsetBin, globalHopLength, globalSamplingRate),
            }

            emitter.emit('dataChange', newActiveLabel)
            emitter.emit('expandedLabelHandler', newActiveLabel)

        }

        // Only do this when mouse up event stems from dragging the frequency lines
        if (draggedFrequencyLinesObject){
            setFrequencyLines({...draggedFrequencyLinesObject})
        }

        clickedLabel = undefined
        draggedActiveLabel = null
        draggedFrequencyLinesObject = null
        

    }

    const dragRectangle = (event) => {
        if (!rectangleDragRef.current || !rectangleDragRef.current.isActive) {
            return
        }

        const mouseX = getMouseX(event)
        const mouseY = getMouseY(event)

        // Redraw spectrogram to clear previous rectangle
        const specCVS = specCanvasRef.current
        const specCTX = specCVS.getContext('2d', { willReadFrequently: true, alpha: false })
        if (specImgData.current) {
            specCTX.clearRect(0, 0, specCVS.width, specCVS.height)
            specCTX.putImageData(specImgData.current, 0, 0)
        }

        // Also keep labels updated on label canvas
        const labelCVS = labelCanvasRef.current
        const labelCTX = labelCVS.getContext('2d', { willReadFrequently: true, alpha: true })
        labelCTX.clearRect(0, 0, labelCVS.width, labelCVS.height)
        drawAllLabels(labelsRef.current)

        // Draw frequency lines if expanded label exists
        if (expandedLabel !== null && frequencies) {
            const newMinFreqY = getYPositionAtFrequency(expandedLabel.minFreq, specCanvasRef.current.height, frequencies)
            const newMaxFreqY = getYPositionAtFrequency(expandedLabel.maxFreq, specCanvasRef.current.height, frequencies)
            drawFrequencyLines(frequencies, { minFreqY: newMinFreqY, maxFreqY: newMaxFreqY })
        }

        // Now draw rectangle on SPECTROGRAM canvas (reuse specCTX from above)
        // Calculate dimensions
        const rectX = Math.min(rectangleDragRef.current.startX, mouseX)
        const rectY = Math.min(rectangleDragRef.current.startY, mouseY)
        const rectWidth = Math.abs(mouseX - rectangleDragRef.current.startX)
        const rectHeight = Math.abs(mouseY - rectangleDragRef.current.startY)

        // Calculate bin and frequency info
        let dragOffsetBin = null
        if (specCalMethod !== "constant-q") {
            dragOffsetBin = calculateBinIndex(event)
        } else {
            dragOffsetBin = calculateBinIndexConstantQOffset(event)
        }

        const canvasHeight = specCanvasRef.current.height
        const minY = Math.min(rectangleDragRef.current.startY, mouseY)
        const maxY = Math.max(rectangleDragRef.current.startY, mouseY)
        const maxFrequency = getFrequencyAtYPosition(minY, canvasHeight, frequencies)
        const minFrequency = getFrequencyAtYPosition(maxY, canvasHeight, frequencies)

        // Duration in seconds for display (convert bins to time)
        const duration = Math.abs(dragOffsetBin - rectangleDragRef.current.startBin) * globalHopLength / globalSamplingRate

        // Draw rectangle with macOS-style selection appearance ON SPECTROGRAM
        // Fill with semi-transparent blue (macOS style)
        specCTX.fillStyle = 'rgba(0, 120, 255, 0.15)'
        specCTX.fillRect(rectX, rectY, rectWidth, rectHeight)

        // Draw solid blue border
        specCTX.strokeStyle = 'rgba(0, 120, 255, 0.8)'
        specCTX.lineWidth = 2
        specCTX.strokeRect(rectX, rectY, rectWidth, rectHeight)

        // Draw info text on rectangle only if rectangle is large enough
        if (rectWidth > 200 && rectHeight > 100) {
            specCTX.fillStyle = 'rgba(0, 0, 0, 0.85)'
            specCTX.fillRect(rectX + 5, rectY + 5, 250, 147)

            specCTX.font = '12px monospace'
            specCTX.fillStyle = 'rgba(255, 255, 255, 1)'
            const infoLines = [
                `Display Onset: ${rectangleDragRef.current.startTime.toFixed(4)}s`,
                `Display Offset: ${offsetTime.toFixed(4)}s`,
                `Real Onset: ${onsetReal.toFixed(4)}s`,
                `Real Offset: ${offsetReal.toFixed(4)}s`,
                `Duration: ${duration.toFixed(4)}s`,
                `Hop: ${globalHopLength}`,
                `nfft: ${nfft}`,
                `FreqMin: ${Math.round(minFrequency)}Hz`,
                `FreqMax: ${Math.round(maxFrequency)}Hz`,
                `Range: ${Math.round(maxFrequency - minFrequency)}Hz`
            ]
            infoLines.forEach((line, i) => {
                specCTX.fillText(line, rectX + 10, rectY + 20 + i * 14)
            })
        } else {
            // Show minimal info for small rectangles
            specCTX.font = '11px monospace'
            specCTX.fillStyle = 'rgba(255, 255, 255, 1)'
            specCTX.strokeStyle = 'rgba(0, 0, 0, 0.8)'
            specCTX.lineWidth = 3
            const miniText = `${duration.toFixed(3)}s`
            specCTX.strokeText(miniText, rectX + 5, rectY - 5)
            specCTX.fillText(miniText, rectX + 5, rectY - 5)
        }
    }

    const removeDragEventListeners = () => {
        specCanvasRef.current.removeEventListener('mousemove', dragListenerRef.current )//dragOnset)
        specCanvasRef.current.removeEventListener('mousemove', dragOffset)
        waveformCanvasRef.current.removeEventListener('mousemove', dragListenerRef.current )//dragOnset)
        waveformCanvasRef.current.removeEventListener('mousemove', dragOffset)
        labelCanvasRef.current.removeEventListener('mousemove', dragListenerRef.current )//dragOnset)
        labelCanvasRef.current.removeEventListener('mousemove', dragOffset)
        specCanvasRef.current.removeEventListener('mousemove', dragMaxFreqLine)
        specCanvasRef.current.removeEventListener('mousemove', dragMinFreqLine)
        specCanvasRef.current.removeEventListener('mousemove', dragActiveLabelOnset)
        waveformCanvasRef.current.removeEventListener('mousemove', dragActiveLabelOnset)
        specCanvasRef.current.removeEventListener('mousemove', dragActiveLabelOffset)
        waveformCanvasRef.current.removeEventListener('mousemove', dragActiveLabelOffset)
        specCanvasRef.current.removeEventListener('mousemove', dragRectangle)
        waveformCanvasRef.current.removeEventListener('mousemove', dragRectangle)
        labelCanvasRef.current.removeEventListener('mousemove', dragRectangle)
    }

    const handleMouseLeaveCanvases = (event) => {
        handleMouseUp(event)
        // Clear mouse position to disable frequency zoom when mouse leaves
        mousePositionRef.current = { x: null, y: null }

        // Clear the cursor lines from overlay canvases
        if (waveformOverlayCanvasRef.current) {
            const waveformOverlayCTX = waveformOverlayCanvasRef.current.getContext('2d', { alpha: true })
            waveformOverlayCTX.clearRect(0, 0, waveformOverlayCanvasRef.current.width, waveformOverlayCanvasRef.current.height)
        }
        if (specOverlayCanvasRef.current) {
            const specOverlayCTX = specOverlayCanvasRef.current.getContext('2d', { alpha: true })
            specOverlayCTX.clearRect(0, 0, specOverlayCanvasRef.current.width, specOverlayCanvasRef.current.height)
        }
        if (labelOverlayCanvasRef.current) {
            const labelOverlayCTX = labelOverlayCanvasRef.current.getContext('2d', { alpha: true })
            labelOverlayCTX.clearRect(0, 0, labelOverlayCanvasRef.current.width, labelOverlayCanvasRef.current.height)
        }
    }

    const handleRightClick = (event) => {
        // Don't proceed if audio is currently playing
        if (audioSnippet && !audioSnippet.paused) {
            event.preventDefault()
            return
        }

        // Don't proceed if the disableOnsetOffsetEdit is true
        if ( disableOnsetOffsetEdit ) {
            event.preventDefault()
            return
        }

        const mouseX = getMouseX(event)
        const mouseY = getMouseY(event)
        const labelToBeDeleted = checkIfClickedOnLabelToBeDeleted(event, mouseX, mouseY)

        if (!labelToBeDeleted) {
            event.preventDefault()
            return
        }

        // Only prevent default if we're actually deleting a label
        event.preventDefault()

        annotationTimestamps.current = [...annotationTimestamps.current, {
            "hash_id":hashID,
            "timestamp":getCurrentUTCTime().toISOString(),
            "action":"remove_annotation",
            "deviceInfo":getDeviceInfo()
        } ];
        
        deleteLabel(labelToBeDeleted)

        // Remove active label from other tracks, if the deleted label was the active one
        if (labelToBeDeleted.id === activeLabel?.id){
            emitter.emit('dataChange', {
                onsetBin: undefined,
                offsetBin: undefined,
                onsetTime: undefined,
                offsetTime: undefined,
                id: undefined,
                trackID: undefined,
                color: undefined,
            })
        }
    }

    const handleMouseMove = (event) => {
        // Track mouse position for zoom functionality
        if (event.target === specCanvasRef.current) {
            const rect = event.target.getBoundingClientRect()
            mousePositionRef.current = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            }
        }

        hoverLine(event)
        hoverLabel(event)

        // Don't draw hover info if we're in the middle of drawing a rectangle
        if (!rectangleDragRef.current || !rectangleDragRef.current.isActive) {
            drawHoverTimeInfo(event)
        }
    }

    const drawHoverTimeInfo = (event) => {
        if (!specCanvasRef.current || !labelCanvasRef.current) return;

        // Cancel any pending hover redraw to throttle updates
        if (hoverAnimationFrameRef.current) {
            cancelAnimationFrame(hoverAnimationFrameRef.current);
        }

        // Schedule the hover redraw for the next animation frame
        hoverAnimationFrameRef.current = requestAnimationFrame(() => {
            const mouseX = getMouseX(event)
            const canvasWidth = specCanvasRef.current.width
            const canvasHeight = specCanvasRef.current.height

            // Calculate column info
            const columnWidth = canvasWidth / globalNumSpecColumns
            const columnIndex = (mouseX / columnWidth)

            // Calculate the x position for the vertical line
            const x = Math.round(columnIndex * columnWidth)

            // Check if there's a label without an offset
            const newestLabel = labels[labels.length - 1]
            const hasIncompleteLabel = newestLabel && (!newestLabel.offsetBin || newestLabel.offsetBin === undefined || isNaN(newestLabel.offsetBin))

            // Draw vertical line on waveform overlay canvas
            if (waveformOverlayCanvasRef.current && displayWaveform) {
                const waveformOverlayCTX = waveformOverlayCanvasRef.current.getContext('2d', { alpha: true })
                waveformOverlayCTX.clearRect(0, 0, waveformOverlayCanvasRef.current.width, waveformOverlayCanvasRef.current.height)

                waveformOverlayCTX.save()
                waveformOverlayCTX.strokeStyle = 'rgba(255, 255, 0, 0.8)'
                waveformOverlayCTX.lineWidth = 2
                // Use dashed line if there's an incomplete label, solid otherwise
                waveformOverlayCTX.setLineDash(hasIncompleteLabel ? [10, 5] : [])
                waveformOverlayCTX.beginPath()
                waveformOverlayCTX.moveTo(x, 0)
                waveformOverlayCTX.lineTo(x, waveformOverlayCanvasRef.current.height)
                waveformOverlayCTX.stroke()
                waveformOverlayCTX.restore()
            }

            // Draw vertical line on spectrogram overlay canvas
            if (specOverlayCanvasRef.current) {
                const specOverlayCTX = specOverlayCanvasRef.current.getContext('2d', { alpha: true })
                specOverlayCTX.clearRect(0, 0, specOverlayCanvasRef.current.width, specOverlayCanvasRef.current.height)

                specOverlayCTX.save()
                specOverlayCTX.strokeStyle = 'rgba(255, 255, 0, 0.8)'
                specOverlayCTX.lineWidth = 2
                // Use dashed line if there's an incomplete label, solid otherwise
                specOverlayCTX.setLineDash(hasIncompleteLabel ? [10, 5] : [])
                specOverlayCTX.beginPath()
                specOverlayCTX.moveTo(x, 0)
                specOverlayCTX.lineTo(x, specOverlayCanvasRef.current.height)
                specOverlayCTX.stroke()
                specOverlayCTX.restore()
            }

            // Don't redraw labels on every mouse move - they're on a separate canvas
            // Labels should only be redrawn when they change or when spec loads

            // Draw vertical line on label overlay canvas
            if (labelOverlayCanvasRef.current && showLabelAndIndividualsCanvas) {
                const labelOverlayCTX = labelOverlayCanvasRef.current.getContext('2d', { alpha: true })
                labelOverlayCTX.clearRect(0, 0, labelOverlayCanvasRef.current.width, labelOverlayCanvasRef.current.height)

                // Draw vertical line
                labelOverlayCTX.save()
                labelOverlayCTX.strokeStyle = 'rgba(255, 255, 0, 0.8)'
                labelOverlayCTX.lineWidth = 2
                labelOverlayCTX.setLineDash(hasIncompleteLabel ? [10, 5] : [])
                labelOverlayCTX.beginPath()
                labelOverlayCTX.moveTo(x, 0)
                labelOverlayCTX.lineTo(x, labelOverlayCanvasRef.current.height)
                labelOverlayCTX.stroke()
                labelOverlayCTX.restore()

                // Draw dashed horizontal line from onset to mouse position if there's an incomplete label
                if (hasIncompleteLabel) {
                    const xOnset = calculateXPositionFromBin(newestLabel.onsetBin)
                    const y = calculateYPosition(newestLabel)

                    labelOverlayCTX.save()
                    labelOverlayCTX.strokeStyle = newestLabel.color
                    labelOverlayCTX.lineWidth = 2
                    labelOverlayCTX.setLineDash([10, 5])

                    // Draw horizontal dashed line from onset to current mouse position
                    labelOverlayCTX.beginPath()
                    labelOverlayCTX.moveTo(xOnset, y)
                    labelOverlayCTX.lineTo(x, y)
                    labelOverlayCTX.stroke()

                    // Draw short onset line marker
                    labelOverlayCTX.setLineDash([])
                    labelOverlayCTX.beginPath()
                    labelOverlayCTX.moveTo(xOnset, y - 3)
                    labelOverlayCTX.lineTo(xOnset, y + 1)
                    labelOverlayCTX.stroke()

                    labelOverlayCTX.restore()
                }
            }
        });
    }

    const hoverLine = (event) => {
        const mouseX = getMouseX(event)
        const mouseY = getMouseY(event)

        // if ( checkIfOccupiedByOnsetOrOffset(mouseX, mouseY) && event.target.className === 'label-canvas' /*|| checkIfClickedOnPlayhead(xHovered)*/){
        if ( checkIfOccupiedByOnsetOrOffset(mouseX, mouseY, event.target.className === 'label-canvas')){
            specCanvasRef.current.style.cursor = 'col-resize'
            waveformCanvasRef.current.style.cursor = 'col-resize'
            labelCanvasRef.current.style.cursor = 'col-resize'
        } else if ( checkIfOccupiedByMaxFreqLine(mouseY) || checkIfOccupiedByMinFreqLine(mouseY) ){
            specCanvasRef.current.style.cursor = 'row-resize'
        } else if ( checkIfOccupiedByActiveLabel(mouseX) ) {
            specCanvasRef.current.style.cursor = 'col-resize'
            waveformCanvasRef.current.style.cursor = 'col-resize'
        }
        else {
            specCanvasRef.current.style.cursor = 'default'
            waveformCanvasRef.current.style.cursor = 'default'
            labelCanvasRef.current.style.cursor = 'default'
        }
    }

    const hoverLabel = (event) => {
        if (lastHoveredLabel.labelObject && lastHoveredLabel.isHighlighted) {
            clearAndRedrawSpecAndWaveformCanvases(playheadRef.current.timeframe)
            lastHoveredLabel.isHighlighted = false
        }

        const mouseX = getMouseX(event)
        const mouseY = getMouseY(event)

        for (let label of labels){
            const onsetX = calculateXPositionFromBin(label.onsetBin)
            const offsetX = calculateXPositionFromBin(label.offsetBin)
            const bottomY = calculateYPosition(label)
            const topY = calculateYPosition(label) - HEIGHT_BETWEEN_INDIVIDUAL_LINES
            if (mouseX >= onsetX && mouseX <= offsetX && mouseY >= topY && mouseY <= bottomY && !lastHoveredLabel.isHighlighted && event.target.className === 'label-canvas' ){
                drawClustername(label)
                lastHoveredLabel.labelObject = label
                lastHoveredLabel.isHighlighted = true
                break;
            }
        }
    }

    const handleIndividualCanvasMouseMove = (event) => {
        const mouseX = event.clientX - event.target.getBoundingClientRect().x
        const mouseY = event.clientY - event.target.getBoundingClientRect().y
        const individualIndex = Math.floor(mouseY / HEIGHT_BETWEEN_INDIVIDUAL_LINES )
        const clusternamesAnchorOrigin = { x: event.target.offsetWidth, 
            y:  window.innerHeight - ( event.target.getBoundingClientRect().y + (individualIndex + 1) * HEIGHT_BETWEEN_INDIVIDUAL_LINES )
        }
        
        let selectedSpeciesId = null
        let selectedIndividualId = null
 
        let i = 0
        for (let speciesObj of speciesArray){
            for (let individual of speciesObj.individuals){
                if (i === individualIndex ){
                    selectedSpeciesId = speciesObj.id
                    selectedIndividualId = individual.id
                    break
                }
                i ++
            }
            if (selectedIndividualId!== null){
                break
            }
        }

        if ( selectedSpeciesId !== null &&  selectedIndividualId != null){
            setSelectedSpeciesId( selectedSpeciesId )
            setSelectedIndividualId( selectedIndividualId )
            setClusternamesAnchorOrigin( clusternamesAnchorOrigin )
            setSelectedIndividualGlobalIndex( individualIndex + 1)
        }   
    }

    const handleIndividualCanvasMouseLeave = (event) => {
        if (closeClusterNameListRef.current !== null){
            clearTimeout( closeClusterNameListRef.current )
        }
        closeClusterNameListRef.current = setTimeout( ()=>{
            setClusternamesAnchorOrigin(null)
            setSelectedSpeciesId( null )
            setSelectedIndividualId( null )
            setSelectedIndividualGlobalIndex( null )
        }, 50  )
    }

    const handleClusterNameListMouseMove = (event)=>{
        if (closeClusterNameListRef.current !== null){
            clearTimeout( closeClusterNameListRef.current )
        }
    }

    const handleClusterNameListMouseLeave = (event)=>{
        if (closeClusterNameListRef.current !== null){
            clearTimeout( closeClusterNameListRef.current )
        }
        setClusternamesAnchorOrigin(null)
        setSelectedSpeciesId( null )
        setSelectedIndividualId( null )
        setSelectedIndividualGlobalIndex( null )
    }


    const handleClickClustername = (selectedSpeciesId, selectedIndividualId, selectedClustername) => {
        const modifiedSpeciesArray = speciesArray.map(speciesObject => {
            if (speciesObject.id === selectedSpeciesId) {
                let selectedIndividualName = null
                for (let ind of speciesObject.individuals){
                    if (ind.id === selectedIndividualId){
                        selectedIndividualName = ind.name
                        break
                    }
                }
                if (selectedIndividualName === null){
                    return
                }

                // Activate selected clustername, deactivate all others
                const updatedClusternames = activateClustername(speciesObject.clusternames, selectedClustername.name)
                const updatedIndividuals = activateIndividual(speciesObject.individuals, selectedIndividualName)

                return new Species(
                    speciesObject.id,
                    speciesObject.name,
                    [...updatedIndividuals],
                    [...updatedClusternames],
                )
            } else {
                //Deactivate existing clusternames and individuals of all other species
                const updatedIndividuals = deactivateExistingIndividuals(speciesObject.individuals)
                const updatedClusternames = deactivateExistingClusternames(speciesObject.clusternames)
                return new Species(
                    speciesObject.id,
                    speciesObject.name,
                    [...updatedIndividuals],
                    [...updatedClusternames],
                )
            }
        })
        passSpeciesArrayToApp(modifiedSpeciesArray)
    }

    /* ++++++++++++++++++ Helper methods ++++++++++++++++++ */

    const getMouseX = (event) => {
        const rect = event.target.getBoundingClientRect()
        return event.clientX - rect.left
    }

    const getMouseY = (event) => {
        const rect = event.target.getBoundingClientRect()
        return event.clientY - rect.top
    }

    // Convert absolute bin index to pixel X position
    const calculateXPositionFromBin = (absoluteBin) => {
        if (absoluteBin === undefined || absoluteBin === null) {
            return 0
        }
        const viewStartBin = Math.floor(currentStartTime * globalSamplingRate) / globalHopLength
        const relativeBin = absoluteBin - viewStartBin
        const columnWidth = labelCanvasRef.current.width / globalNumSpecColumns
        return relativeBin * columnWidth
    }

    // Convert time to pixel X position (kept for playhead and time-based displays)
    const calculateXPositionFromTime = (timestamp) => {
        if (timestamp === undefined || timestamp === null) {
            return 0
        }
        const actualViewStartSample = Math.floor(currentStartTime * globalSamplingRate)
        const actualViewStartTime = actualViewStartSample / globalSamplingRate
        const sampleOffset = (timestamp - actualViewStartTime) * globalSamplingRate
        const frameIndex = sampleOffset / globalHopLength
        const columnWidth = labelCanvasRef.current.width / globalNumSpecColumns
        return frameIndex * columnWidth
    }

    const calculateYPosition = (label) => {
        return (label?.individualIndex + 1) * HEIGHT_BETWEEN_INDIVIDUAL_LINES
    }

    // Convert mouse click to absolute bin index from file start
    // absoluteBin = screenColumnIndex + viewStartSample / hopLength
    const calculateBinIndex = (event) => {
        const mouseX = getMouseX(event)
        const canvasWidth = specCanvasRef.current.width
        const actualViewStartSample = Math.floor(currentStartTime * globalSamplingRate)
        const columnWidth = canvasWidth / globalNumSpecColumns
        const screenColumnIndex = Math.floor(mouseX / columnWidth)
        return screenColumnIndex + actualViewStartSample / globalHopLength
    }

    const calculateBinIndexConstantQOnset = (event) => {
        const mouseX = getMouseX(event)
        const mouseY = getMouseY(event)

        const actualViewStartSample = Math.floor(currentStartTime * globalSamplingRate)
        const viewStartBin = actualViewStartSample / globalHopLength
        const ratio = (mouseX / specCanvasRef.current.width)
        const screenBin = globalNumSpecColumns * ratio
        const absoluteBin = screenBin + viewStartBin

        if (event.target.className==="waveform-canvas"){
            return absoluteBin
        }
        // event.target.className=="spec-canvas"
        const specCanvasHeight = specCanvasRef.current.height
        const yScaleRatio = specCanvasHeight / nBins
        const curve_width = (0.5 * binsPerOctave / minFreq)
        const offset_para = curve_width * Math.pow(2, -nBins / binsPerOctave)
        const effectiveY = (specCanvasHeight - mouseY) / yScaleRatio
        const timeDiff = 2 ** (effectiveY / ( - binsPerOctave )) * curve_width - offset_para
        const binDiff = timeDiff * globalSamplingRate / globalHopLength
        return absoluteBin + binDiff
    }

    const calculateBinIndexConstantQOffset = (event) => {
        const mouseX = getMouseX(event)
        const mouseY = getMouseY(event)

        const actualViewStartSample = Math.floor(currentStartTime * globalSamplingRate)
        const viewStartBin = actualViewStartSample / globalHopLength
        const ratio = (mouseX / specCanvasRef.current.width)
        const screenBin = globalNumSpecColumns * ratio
        const absoluteBin = screenBin + viewStartBin

        if (event.target.className==="waveform-canvas"){
            return absoluteBin
        }
        // event.target.className=="spec-canvas"
        const specCanvasHeight = specCanvasRef.current.height
        const yScaleRatio = specCanvasHeight / nBins
        const curve_width = (0.5 * binsPerOctave / minFreq)
        const offset_para = curve_width * Math.pow(2, -nBins / binsPerOctave)
        const effectiveY = (specCanvasHeight - mouseY) / yScaleRatio
        const timeDiff = 2 ** (effectiveY / ( - binsPerOctave )) * curve_width - offset_para
        const binDiff = timeDiff * globalSamplingRate / globalHopLength
        return absoluteBin - binDiff
    }

    const checkIfOccupiedByOnsetOrOffset = (mouseX, mouseY, isClickLabelCanvas) => {
        return checkIfClickedOnOnset(mouseX, mouseY, isClickLabelCanvas) || checkIfClickedOnOffset(mouseX, mouseY, isClickLabelCanvas)
    }

    const checkIfOccupiedByActiveLabel = (mouseX) => {
        // Active label is only drawn on the other tracks, so we ignore the active label that originated from this track
        if (!activeLabel || activeLabel.trackID === trackID) return

        return checkIfClickedOnActiveLabelOnset(mouseX) || checkIfClickedOnActiveLabelOffset(mouseX)
    }

    const checkIfClickedOnActiveLabelOnset = (mouseX) => {
        // Active label is only drawn on the other tracks, so we ignore the active label that originated from this track
        if (!activeLabel || activeLabel.trackID === trackID) return

        const activeLabelOnsetX = calculateXPositionFromBin(activeLabel.onsetBin)
        return activeLabelOnsetX >= mouseX - 5 && activeLabelOnsetX <= mouseX + 5
    }

    const checkIfClickedOnActiveLabelOffset = (mouseX) => {
        // Active label is only drawn on the other tracks, so we ignore the active label that originated from this track
        if (!activeLabel || activeLabel.trackID === trackID) return

        const activeLabelOffsetX = calculateXPositionFromBin(activeLabel.offsetBin)
        return activeLabelOffsetX >= mouseX - 5 && activeLabelOffsetX <= mouseX + 5
    }

    const checkIfClickedOnOnset = (mouseX, mouseY, isClickLabelCanvas) => {
        if (expandedLabel !== null){
            const xOnset = calculateXPositionFromBin(expandedLabel.onsetBin)
            const bottomY = calculateYPosition(expandedLabel)
            if ( xOnset >= mouseX - 5 && xOnset <= mouseX + 5 && ( (isClickLabelCanvas && mouseY <= bottomY ) || ( !isClickLabelCanvas ) ) ){
                for (let label of labels){
                    if (label.id === expandedLabel.id){
                        return label
                    }
                }
            }
        }

        if (!isClickLabelCanvas){
            return null
        }

        for (let label of labels){
            const xOnset = calculateXPositionFromBin(label.onsetBin)
            const bottomY = calculateYPosition(label)
            const topY = calculateYPosition(label) - HEIGHT_BETWEEN_INDIVIDUAL_LINES
            if (  xOnset >= mouseX - 5 && xOnset <= mouseX + 5 && mouseY >= topY && mouseY <= bottomY ){
                return label
            }
        }
    }

    const checkIfClickedWithinLabel = (event, mouseX) => {
        if (event.target.className !== 'waveform-canvas' && event.target.className !== 'spec-canvas') return

        for (let label of labels) {
            const onsetX = calculateXPositionFromBin(label.onsetBin)
            const offsetX = calculateXPositionFromBin(label.offsetBin)
            if (mouseX >= onsetX && mouseX <= offsetX) {
                return true
            }
        }
    }

    const checkIfClickedOnOffset = (mouseX, mouseY, isClickLabelCanvas) => {
        if ( expandedLabel !== null ){
            const xOffset = calculateXPositionFromBin(expandedLabel.offsetBin)
            const bottomY = calculateYPosition(expandedLabel)
            if ( xOffset >= mouseX - 5 && xOffset <= mouseX + 5  && ( (isClickLabelCanvas && mouseY <= bottomY ) || ( !isClickLabelCanvas ) ) ){
                for (let label of labels){
                    if (label.id === expandedLabel.id){
                        return label
                    }
                }
            }
        }

        if (!isClickLabelCanvas){
            return null
        }

        for (let label of labels){
            const xOffset = calculateXPositionFromBin(label.offsetBin)
            const bottomY = calculateYPosition(label)
            const topY = calculateYPosition(label) - HEIGHT_BETWEEN_INDIVIDUAL_LINES
            if ( xOffset >= mouseX - 5 && xOffset <= mouseX + 5 && mouseY >= topY && mouseY <= bottomY ){
                return label
            }
        }
    }

    const checkIfClickedOnLabel = (event, mouseX, mouseY) => {
        if (event.target.className !== 'label-canvas') return

        for (let label of labels) {
            const onsetX = calculateXPositionFromBin(label.onsetBin)
            const offsetX = calculateXPositionFromBin(label.offsetBin)
            const bottomY = calculateYPosition(label)
            const topY = calculateYPosition(label) - HEIGHT_BETWEEN_INDIVIDUAL_LINES
            if (mouseX >= onsetX && mouseX <= offsetX && mouseY >= topY && mouseY <= bottomY) {
                return label
            }
        }
    }

    const checkIfClickedOnLabelToBeDeleted = (event, mouseX, mouseY) => {
        const isClickLabelCanvas = event.target.className === 'label-canvas'
        if ( expandedLabel !== null ){
            const xOnset = calculateXPositionFromBin(expandedLabel.onsetBin)
            const xOffset = calculateXPositionFromBin(expandedLabel.offsetBin)
            const bottomY = calculateYPosition(expandedLabel)
            if ( mouseX >= xOnset - 5 && mouseX <=  xOffset + 5 && ( (isClickLabelCanvas && mouseY <= bottomY ) || ( !isClickLabelCanvas ) ) ){
                for (let label of labels){
                    if (label.id === expandedLabel.id){
                        return label
                    }
                }
            }
        }

        if (event.target.className !== 'label-canvas') return

        for (let label of labels) {
            const onsetX = calculateXPositionFromBin(label.onsetBin)
            const offsetX = calculateXPositionFromBin(label.offsetBin)
            const bottomY = calculateYPosition(label)
            const topY = calculateYPosition(label) - HEIGHT_BETWEEN_INDIVIDUAL_LINES
            if (mouseX >= onsetX && mouseX <= offsetX && mouseY >= topY && mouseY <= bottomY) {
                return label
            }
        }
    }

    const checkIfOccupiedByMaxFreqLine = (mouseY) => {
        if (!showFrequencyLines) return false
        return mouseY < frequencyLines.maxFreqY + 5 && mouseY > frequencyLines.maxFreqY - 5
    }
        
    const checkIfOccupiedByMinFreqLine = (mouseY) => {
        if (!showFrequencyLines) return false
        return mouseY < frequencyLines.minFreqY + 5 && mouseY > frequencyLines.minFreqY - 5
    }

    const checkIfNewOffsetIsValid = (currentOnsetBin, newOffsetBin) =>{
        for (let label of labels){
            if (label.onsetBin > currentOnsetBin && label.onsetBin < newOffsetBin){
                return false
            }
            if (label.offsetBin > currentOnsetBin && label.offsetBin < newOffsetBin){
                return false
            }
            if (label.onsetBin > newOffsetBin && label.onsetBin < currentOnsetBin){
                return false
            }
            if (label.offsetBin > newOffsetBin && label.offsetBin < currentOnsetBin){
                return false
            }
        }
        return true
    }

    const findClosestPositiveToZeroIndex = (arr) => {
        // Initialize a variable to store the index of the closest positive number
        let closestIndex = -1

        // Iterate through the array
        for (let i = 0; i < arr.length; i++) {
            let num = arr[i]
            // Check if the number is positive
            if (num > 0) {
                // If closestIndex is -1 (no positive number found yet) or the current number is closer to zero
                if (closestIndex === -1 || num < arr[closestIndex]) {
                    closestIndex = i
                }
            }
        }

        return closestIndex
    }

    const getAllIndividualIDs = (currentSpeciesArray) => {
        return currentSpeciesArray.flatMap(speciesObj => {
            return speciesObj.individuals.map(individual => individual.id)
        })
    }

    const getConfigSnapshot = () => {
        return {
            hopLength: globalHopLength,
            numSpecColumns: globalNumSpecColumns,
            samplingRate: globalSamplingRate,
            spectrogramType: specCalMethod,
            nfft: nfft,
            minFreq: minFreq,
            maxFreq: maxFreq,
            dbMin: dbMin,
            dbMax: dbMax,
        }
    }


    /* ++++++++++++++++++ Draw methods ++++++++++++++++++ */

    const drawAllCanvases = (spectrogram, frequenciesArray, newAudioArray, newLabels) => {
        // Cancel any existing animation frame
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        if (!specCanvasRef.current) return

        const specCVS = specCanvasRef.current;
        const specCTX = specCVS.getContext('2d', { willReadFrequently: true, alpha: false });

        const image = new Image();

        const labelCVS = labelCanvasRef.current
        const labelCTX = labelCVS.getContext('2d', { willReadFrequently: true, alpha: true });

        // Draw Spectrogram, Waveform and labels
        image.addEventListener('load', async () => {
            animationFrameRef.current = requestAnimationFrame( async ()=>{
                // Draw image at exact canvas size - backend should create it at target resolution
                // Use high-quality smoothing for crisp rendering
                specCTX.imageSmoothingEnabled = true;
                specCTX.imageSmoothingQuality = 'high';

                // Draw at exact canvas dimensions
                specCTX.drawImage(image, 0, 0, specCVS.width, specCVS.height);

                // Draw column gridlines
                // drawSpectrogramColumnGridlines();

                drawWaveform(newAudioArray)
                drawFrequenciesAxis(frequenciesArray)
                drawIndividualsCanvas()

                // Capture image data BEFORE drawing labels, so we can always redraw fresh labels on top
                // This prevents old labels from being baked into the cached image
                specImgData.current = specCTX.getImageData(0, 0, specCVS.width, specCVS.height);
                waveformImgData.current = waveformCanvasRef.current.getContext('2d').getImageData(0, 0, waveformCanvasRef.current.width, waveformCanvasRef.current.height);

                labelCTX.clearRect(0, 0, labelCVS.width, labelCVS.height)
                drawAllLabels(newLabels)
                // draw the updated frequencyLines (not necessarily updated frequencyLines)
                if ( expandedLabel !== null ){
                    const newMinFreqY = getYPositionAtFrequency(expandedLabel.minFreq, specCanvasRef.current.height, frequenciesArray)
                    const newMaxFreqY = getYPositionAtFrequency(expandedLabel.maxFreq, specCanvasRef.current.height, frequenciesArray)
                    drawFrequencyLines(frequenciesArray, { minFreqY:newMinFreqY, maxFreqY:newMaxFreqY })
                }
                drawPlayhead(playheadRef.current.timeframe)
            }
            )
        })
        image.src = `data:image/png;base64,${spectrogram}`;
    }

    const drawLine = (label, bin) => {
        const waveformCTX = waveformCanvasRef.current.getContext('2d')
        const specCTX = specCanvasRef.current.getContext('2d')
        const labelCTX = labelCanvasRef.current.getContext('2d')

        const x = calculateXPositionFromBin(bin)
        const y = calculateYPosition(label)

        const lineColor = label.color

        if (specCalMethod === 'constant-q'){
            if (bin === label.onsetBin){
                drawCurvedOnset(bin, lineColor)
            }
            if (bin === label.offsetBin){
                drawCurvedOffset(bin, lineColor)
            }
        } else {
            waveformCTX.beginPath()
            waveformCTX.setLineDash([1, 1])
            waveformCTX.moveTo(x, 0)
            waveformCTX.lineTo(x, waveformCanvasRef.current.height)
            waveformCTX.lineWidth = 2
            waveformCTX.strokeStyle = lineColor
            waveformCTX.stroke()
            waveformCTX.setLineDash([])

            specCTX.beginPath()
            specCTX.setLineDash([1, 1])
            specCTX.moveTo(x, 0)
            specCTX.lineTo(x, specCanvasRef.current.height)
            specCTX.lineWidth = 2
            specCTX.strokeStyle = lineColor
            specCTX.stroke()
            specCTX.setLineDash([])
        }

        labelCTX.beginPath()
        labelCTX.setLineDash([1, 1])
        labelCTX.moveTo(x, 0)
        labelCTX.lineTo(x, y)
        labelCTX.lineWidth = 2
        labelCTX.strokeStyle = lineColor
        labelCTX.stroke()
        labelCTX.setLineDash([])
    }

    const drawLineBetween = (label) => {
        const cvs = labelCanvasRef.current
        const ctx = cvs.getContext('2d', { willReadFrequently: true });

        const xOnset = calculateXPositionFromBin(label.onsetBin)
        const xOffset = calculateXPositionFromBin(label.offsetBin)
        let y = calculateYPosition(label)

        // Position annotate area labels one pixel higher, so they don't get cut in half at the canvas edge
        if (label.species === ANNOTATED_AREA){
            y--
        }

        const lineColor = label.color

        ctx.lineWidth = 2
        ctx.strokeStyle = lineColor

        // Draw horizontal line
        ctx.beginPath()
        ctx.moveTo(xOnset, y)
        ctx.lineTo(xOffset, y)
        ctx.stroke()

        // Draw short Onset line
        ctx.beginPath()
        ctx.moveTo(xOnset, y - 3 )
        ctx.lineTo(xOnset, y + 1)
        ctx.stroke()

        // Draw short Offset line
        ctx.beginPath()
        ctx.moveTo(xOffset, y - 3 )
        ctx.lineTo(xOffset, y + 1)
        ctx.stroke()


        // Draw diamond marker at the middle
        if (label.minFreq !== ''){
            const diamondSize = 5; // Size of the diamond marker
            ctx.beginPath();
            // ctx.moveTo((xOffset + xOnset)/2, y - diamondSize);   // Top of diamond
            // ctx.lineTo((xOffset + xOnset)/2 + diamondSize, y);   // Right of diamond
            ctx.moveTo((xOffset + xOnset)/2 + diamondSize, y);   // Right of diamond
            ctx.lineTo((xOffset + xOnset)/2, y + diamondSize);   // Bottom of diamond
            ctx.lineTo((xOffset + xOnset)/2 - diamondSize, y);   // Left of diamond
            ctx.closePath();
            ctx.stroke();  // Stroke the diamond marker, or you can use ctx.fill() to fill it
        }

    }

    const drawClustername = (label) => {
        const cvs = labelCanvasRef.current
        const ctx = cvs.getContext('2d', { willReadFrequently: true })

        const xClustername = ( calculateXPositionFromBin(label.onsetBin) + calculateXPositionFromBin(label.offsetBin) ) / 2
        const y = calculateYPosition(label)

        const lineColor = label.color

        ctx.font = "12px Arial"
        ctx.textAlign = "center"
        ctx.fillStyle = lineColor
        const text = label.clustername === 'Protected Area🔒' ? 'Protected Area' : label.clustername

        ctx.fillText(text, xClustername, y - 4);
    }

    const drawCurvedOnset = (curve_time, color) => {    
        // use the up-to-date parameters for CQT    
        let binsPerOctave = binsPerOctaveRef.current
        let minFreq = minFreqRef.current
        let nBins = nBinsRef.current

        const cvs = specCanvasRef.current
        const ctx = cvs.getContext('2d', { willReadFrequently: true })
        ctx.lineWidth = 2
        ctx.strokeStyle = color

        const yScaleRatio = cvs.height / nBins

        const curve_top_pos = calculateXPositionFromTime(curve_time)

        const curve_width = (0.5 * binsPerOctave / minFreq) / globalClipDuration * cvs.width
        const offset_para = curve_width * Math.pow(2, -nBins / binsPerOctave)

        let xs = []
        for (let i = 0; i < cvs.width; i += 0.1){
            xs.push(i)
        }

        xs = xs.filter(x => x >= curve_top_pos + offset_para - curve_width && x <= curve_top_pos)

        let ys = xs.map(x => cvs.height - -binsPerOctave * yScaleRatio * Math.log2((curve_top_pos + offset_para - x) / curve_width))

        let i = 0
        let previousX = null
        let previousY = null
        for (let x of xs){

            const x1 = previousX ? previousX : x
            const x2 = x
            const y1 = previousY ? previousY : ys[i]
            const y2 = ys[i]
            ctx.beginPath()
            ctx.moveTo(x1, y1)
            ctx.lineTo(x2, y2)
            ctx.stroke()
            previousX = x
            previousY = ys[i]
            i++
        }

        // Draw horizontal line connecting the bottom end of the curved line with the line in the label canvas
        let x1 = xs[0]
        let x2 = xs[xs.length-1]
        let y = cvs.height - 1

        ctx.beginPath()
        ctx.setLineDash([1, 1])
        ctx.moveTo(x1, y)
        ctx.lineTo(x2, y)
        ctx.lineWidth = 2
        ctx.strokeStyle = color
        ctx.stroke()
        ctx.setLineDash([])

        // Draw line inside the waveform
        const waveformCVS = waveformCanvasRef.current
        const waveformCTX = waveformCVS.getContext('2d', { willReadFrequently: true })

        const x = curve_top_pos
        const y1 = 0
        const y2 = waveformCVS.height

        waveformCTX.beginPath()
        waveformCTX.moveTo(x, y1)
        waveformCTX.lineTo(x, y2)
        waveformCTX.lineWidth = 2
        waveformCTX.strokeStyle = color
        waveformCTX.stroke()
    }

    const drawCurvedOffset = (curve_time, color) => {
        // use the up-to-date parameters for CQT    
        let binsPerOctave = binsPerOctaveRef.current
        let minFreq = minFreqRef.current
        let nBins = nBinsRef.current

        const cvs = specCanvasRef.current
        const ctx = cvs.getContext('2d', { willReadFrequently: true })
        
        ctx.lineWidth = 2
        ctx.strokeStyle = color

        const yScaleRatio = cvs.height / nBins

        const curve_top_pos = calculateXPositionFromTime(curve_time)
        // const curve_width = (0.5 * binsPerOctave / minFreq) * globalSamplingRate / globalHopLength
        const curve_width = (0.5 * binsPerOctave / minFreq) / globalClipDuration * cvs.width
        const offset_para = curve_width * Math.pow(2, -nBins / binsPerOctave)

        let xs = []
        for (let i = 0; i < cvs.width; i += 0.1){
            xs.push(i)
        }
        xs = xs.filter(x => x <= curve_top_pos - offset_para + curve_width && x >= curve_top_pos)

        let ys = xs.map(x => cvs.height - -binsPerOctave * yScaleRatio * Math.log2((x - (curve_top_pos - offset_para)) / curve_width))

        let i = 0
        let previousX = null
        let previousY = null
        for (let x of xs){
            const x1 = previousX ? previousX : x
            const x2 = x
            const y1 = previousY ? previousY : ys[i]
            const y2 = ys[i]
            ctx.beginPath()
            ctx.moveTo(x1, y1)
            ctx.lineTo(x2, y2)
            ctx.stroke()
            previousX = x
            previousY = ys[i]
            i++
        }

        // Draw horizontal line connecting the bottom end of the curved line with the line in the label canvas
        let x1 = xs[0]
        let x2 = xs[xs.length-1]
        let y = cvs.height - 1
        ctx.beginPath()
        ctx.setLineDash([1, 1])
        ctx.moveTo(x1, y)
        ctx.lineTo(x2, y)
        ctx.lineWidth = 2
        ctx.strokeStyle = color
        ctx.stroke()
        ctx.setLineDash([])

        // Draw horizontal line connecting the top end of the curved line with the line in the waveform canvas
        x1 = xs[findClosestPositiveToZeroIndex(ys)]
        x2 = curve_top_pos
        y = 1
        ctx.beginPath()
        ctx.setLineDash([1, 1])
        ctx.moveTo(x1, y)
        ctx.lineTo(x2, y)
        ctx.lineWidth = 2
        ctx.strokeStyle = color
        ctx.stroke()
        ctx.setLineDash([])

        // Draw line inside the waveform
        const waveformCVS = waveformCanvasRef.current
        const waveformCTX = waveformCVS.getContext('2d', { willReadFrequently: true })

        const x = curve_top_pos
        const y1 = 0
        const y2 = waveformCVS.height

        waveformCTX.beginPath()
        waveformCTX.moveTo(x, y1)
        waveformCTX.lineTo(x, y2)
        waveformCTX.lineWidth = 2
        waveformCTX.strokeStyle = color
        waveformCTX.stroke()
    }

    const drawAllLabels = (newLabels) => {
        const cvs = labelCanvasRef.current
        const ctx = cvs.getContext('2d', { willReadFrequently: true })
        ctx.clearRect(0, 0, cvs.width, cvs.height)

        // Draw dotted visual support lines
        for (let i = 1; i <= numberOfIndividuals; i++){
            const x1 = 0
            const x2 = cvs.width
            let y = i * HEIGHT_BETWEEN_INDIVIDUAL_LINES
            // Position last line one pixel higher, so they don't get cut in half at the canvas edge
            if (i === numberOfIndividuals){
                y--
            }

            if (i === activeIndividualIndex){
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)' // semi-transparent white
                ctx.fillRect(x1, y - HEIGHT_BETWEEN_INDIVIDUAL_LINES, cvs.width, HEIGHT_BETWEEN_INDIVIDUAL_LINES) // adjust height as needed
                ctx.fillStyle = '#ffffff'
            }

            ctx.beginPath()
            ctx.setLineDash([1, 3])
            ctx.moveTo(x1, y)
            ctx.lineTo(x2, y)
            ctx.lineWidth = 1
            ctx.strokeStyle = ctx.strokeStyle = '#ffffff'
            ctx.stroke()
            ctx.setLineDash([])

        }

        // Always draw active label except for the track where it originates from (to prevent the active label from overdrawing the original label)
        // Don't draw it if active label is being dragged, to avoid drawing the outdated active label
        const currentActiveLabel = activeLabelRef.current
        if (currentActiveLabel && currentActiveLabel?.trackID !== trackID && !draggedActiveLabel) {
            // Only draw if activeLabel has valid values
            if (currentActiveLabel.onsetBin !== undefined && currentActiveLabel.onsetBin !== null &&
                currentActiveLabel.trackID !== undefined && !isNaN(currentActiveLabel.onsetBin)) {
                drawActiveLabel(currentActiveLabel)
            }
        }

        let currentLabels = newLabels

        if (!currentLabels.length) return

        for (let label of currentLabels) {
            // If label is outside the viewport, don't draw it to save computing resource
            const viewStartBin = Math.floor(currentStartTime * globalSamplingRate) / globalHopLength
            const viewEndBin = viewStartBin + globalNumSpecColumns
            if ( (label.onsetBin < viewStartBin && label.offsetBin < viewStartBin) || (label.onsetBin > viewEndBin && label.offsetBin > viewEndBin)){
                continue
            }

            // If a user sets an onset without offset, the onset line will be drawn until he sets an offset, so he doesn't forget about it:
            if (!label.offsetBin || label.offsetBin === undefined || isNaN(label.offsetBin)){
                drawLine(label, label.onsetBin)
                continue  // Skip drawing the line between onset/offset
            }

            // If label is currently dragged (clickedLabel is true) draw the dragged label in full
            if (clickedLabel && label.id === clickedLabel?.id) {
                drawLine(label, label.onsetBin)
                drawLine(label, label.offsetBin)
                drawLineBetween(label)
                drawClustername(label)
            }

            // If no label is currently dragged (clickedLabel is false) draw the active label in full
            else if (!clickedLabel && activeLabel && label.id === activeLabel.id) {
                drawLine(label, label.onsetBin)
                drawLine(label, label.offsetBin)
                drawLineBetween(label)
                drawClustername(label)
            }

            // Draw expanded labels always in full (with vertical lines)
            else if (label.id === expandedLabel?.id) {
                drawLine(label, label.onsetBin)
                drawLine(label, label.offsetBin)
                drawLineBetween(label)
                drawClustername(label)
            }

            // Draw all other labels WITHOUT vertical lines (just horizontal line)
            else {
                drawLineBetween(label)
            }
        }
    }

    const drawFullLabel = (label) => {
        drawLine(label, label.onsetBin)
        // Only draw offset line if offset exists
        if (label.offsetBin !== undefined && label.offsetBin !== null) {
            drawLine(label, label.offsetBin)
            drawLineBetween(label)
            drawClustername(label)
        }
    }

    const drawOnsetOffsetValues = (label) => {
        // This function exists only for debugging purposes. It draws each bin index directly next to the line.
        const cvs = specCanvasRef.current
        const ctx = cvs.getContext('2d', { willReadFrequently: true })

        const xOnset = calculateXPositionFromBin(label.onsetBin) - 45
        const yOnset = cvs.height / 2

        const xOffset = calculateXPositionFromBin(label.offsetBin) + 45
        const yOffset = cvs.height / 2

        const lineColor = label.color

        ctx.font = "bold 16px Arial"
        ctx.textAlign = "center"
        ctx.fillStyle = lineColor
        const onsetText = "Bin: " + parseInt(label.onsetBin * 1000)/1000
        const offsetText = "Bin: " + parseInt(label.offsetBin * 1000)/1000

        ctx.fillText(onsetText, xOnset, yOnset);
        ctx.fillText(offsetText, xOffset, yOffset);

        // Also show time equivalent
        const xTimeOnset = calculateXPositionFromBin(label.onsetBin) - 55
        const yTimeOnset = cvs.height / 2 + 20

        const xTimeOffset = calculateXPositionFromBin(label.offsetBin) + 55
        const yTimeOffset = cvs.height / 2 + 20

        const onsetTime = label.onsetBin * globalHopLength / globalSamplingRate
        const offsetTime = label.offsetBin * globalHopLength / globalSamplingRate
        const timeOnsetText = "Time: " + parseInt(onsetTime * 1000)/1000
        const timeOffsetText = "Time: " + parseInt(offsetTime * 1000)/1000

        ctx.fillText(timeOnsetText, xTimeOnset, yTimeOnset);
        ctx.fillText(timeOffsetText, xTimeOffset, yTimeOffset);
    }

    const drawActiveLabel = (newActiveLabel) => {
        drawLine(newActiveLabel, newActiveLabel.onsetBin)
        if (newActiveLabel.offsetBin !== undefined && newActiveLabel.offsetBin !== null) {
            drawLine(newActiveLabel, newActiveLabel.offsetBin)
        }
    }

    const drawIndividualsCanvas = () => {
        const cvs = individualsCanvasRef.current
        const ctx = cvs.getContext('2d', { willReadFrequently: true })
        ctx.clearRect(0, 0, cvs.width, cvs.height )        

        ctx.strokeStyle = '#ffffff'
        ctx.fillStyle = '#ffffff'
        ctx.lineWidth = 1.5

        let i = 1
        for (let speciesObj of speciesArray){
            // Draw Individual names
            let indCount = 0
            for (let individual of speciesObj.individuals){
                const isIndActive = individual.isActive
                const y = i * HEIGHT_BETWEEN_INDIVIDUAL_LINES - HEIGHT_BETWEEN_INDIVIDUAL_LINES * 0.2
                if (isIndActive || i === selectedIndividualGlobalIndex ) {
                    const rectHeight = isIndActive? HEIGHT_BETWEEN_INDIVIDUAL_LINES: 1 * HEIGHT_BETWEEN_INDIVIDUAL_LINES
                    const rectYStart = isIndActive? (i -1) * HEIGHT_BETWEEN_INDIVIDUAL_LINES: (i -1) * HEIGHT_BETWEEN_INDIVIDUAL_LINES
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)' // semi-transparent white
                    ctx.fillRect(0, rectYStart, cvs.width, rectHeight) // adjust height as needed
                    ctx.fillStyle = '#ffffff' // Reset fill style for text
                }
                ctx.font = `${isIndActive?"bold 14px":"10px"} sans-serif`
                const textWidth = ctx.measureText(individual.name).width + ( isIndActive? HEIGHT_BETWEEN_INDIVIDUAL_LINES:0 )
                // const x = cvs.width - textWidth - 5
                const x = cvs.width * 0.6
                ctx.fillText(individual.name, x, y)

                // draw 
                if (indCount > 0){
                    ctx.beginPath()
                    ctx.setLineDash([1, 3])
                    ctx.moveTo(x, (i -1) * HEIGHT_BETWEEN_INDIVIDUAL_LINES)
                    ctx.lineTo(cvs.width, (i -1) * HEIGHT_BETWEEN_INDIVIDUAL_LINES)
                    ctx.strokeStyle = ctx.strokeStyle = '#ffffff'
                    ctx.stroke()
                    ctx.setLineDash([])
                }


                if (isIndActive){
                    ctx.beginPath()
                    ctx.arc( cvs.width - 0.5 * HEIGHT_BETWEEN_INDIVIDUAL_LINES, y - 0.3 * HEIGHT_BETWEEN_INDIVIDUAL_LINES , 
                             0.3 * HEIGHT_BETWEEN_INDIVIDUAL_LINES,
                             0, 2 * Math.PI
                     )                
                    ctx.fillStyle = activeClusterColor 
                    ctx.fill()    
                    ctx.fillStyle = '#ffffff' // Reset fill style for text
                }

                indCount ++
                i++
            }
            // Draw Species name
            const xSpeciesName = 5
            const ySpeciesName = (i - speciesObj.individuals.length) * HEIGHT_BETWEEN_INDIVIDUAL_LINES - HEIGHT_BETWEEN_INDIVIDUAL_LINES * 0.2
            const isSpeciesActive = speciesObj.individuals.find( (ind)=>ind.isActive )
            ctx.font = `${isSpeciesActive?"bold 16px":"12px"} sans-serif`
            const speciesName = speciesObj.name === UNKNOWN_SPECIES ? 'Unknown Species' : speciesObj.name
            ctx.fillText(speciesName, xSpeciesName, ySpeciesName )

            // Draw line separating Species, except for the last one (Annotated Area)
            if (speciesObj.name === ANNOTATED_AREA) continue
            const x1 = 0
            const x2 = cvs.width
            const y = (i - 1) * HEIGHT_BETWEEN_INDIVIDUAL_LINES 
            ctx.beginPath()
            ctx.moveTo(x1, y)
            ctx.lineTo(x2, y)
            ctx.strokeStyle = ctx.strokeStyle = '#ffffff'
            ctx.stroke()
        }
    }

    const clearAndRedrawSpecAndWaveformCanvases = (currentPlayheadTime, newFrequencyLines) => {
        if (!specCanvasRef.current || !waveformCanvasRef.current || !specImgData.current || !waveformImgData.current) return

        const specCVS = specCanvasRef.current
        const specCTX = specCVS.getContext('2d',{ willReadFrequently: true })
        const waveformCVS = waveformCanvasRef.current
        const waveformCTX = waveformCVS.getContext('2d', { willReadFrequently: true })

        specCTX.clearRect(0, 0, specCVS.width, specCVS.height)
        specCTX.putImageData(specImgData.current, 0, 0)
        waveformCTX.clearRect(0, 0, waveformCVS.width, waveformCVS.height)
        waveformCTX.putImageData(waveformImgData.current, 0, 0)

        // Redraw all labels since they're no longer baked into the cached image
        // This ensures new labels appear and old labels are always visible
        drawAllLabels(labels)

        if (newFrequencyLines!==undefined){
            drawFrequencyLines(frequenciesRef.current, newFrequencyLines)
        }else{
            drawFrequencyLines(frequenciesRef.current, frequencyLinesRef.current)
        }

        drawPlayhead(currentPlayheadTime)
    }


    /* ++++++++++++++++++ Label manipulation methods ++++++++++++++++++ */
    const addNewLabel = (onsetBin) => {
        if (!activeSpecies){
            toast.error('Add at least one species before annotating.')
            return
        }

        const individual = activeSpecies? activeSpecies.individuals.find(individual => individual.isActive): null
        const clustername = activeSpecies? activeSpecies.clusternames.find(clustername => clustername.isActive): null

        const allIndividualIDs = getAllIndividualIDs(speciesArray)
        const individualIndex = allIndividualIDs.indexOf(individual.id)

        const newMinFreq = '';
        const newMaxFreq = '';

        const newLabel = new Label(
            nanoid(),
            trackID,
            trackData.filename,
            onsetBin,
            undefined,
            newMinFreq,
            newMaxFreq,
            activeSpecies.name,
            individual.name,
            clustername.name,
            activeSpecies.id,
            individual.id,
            clustername.id,
            individualIndex,
            null,
            clustername.color,
            false,
            false,
            false,
            getConfigSnapshot()
        )

        setLabels( current => {
            return [...current, newLabel]
        })
        emitter.emit('dataChange', {
            onsetBin: newLabel.onsetBin,
            offsetBin: newLabel.offsetBin,
            onsetTime: binToTime(newLabel.onsetBin, globalHopLength, globalSamplingRate),
            offsetTime: binToTime(newLabel.offsetBin, globalHopLength, globalSamplingRate),
            id: newLabel.id,
            trackID: trackID,
            color: ACTIVE_LABEL_COLOR,
        })
    }

    const deleteLabel = (labelToBeDeleted) => {
        const filteredLabels = labels.filter(label => label !== labelToBeDeleted)
        setLabels(filteredLabels)

        // Clear cached image data immediately to prevent stale data from being restored
        // It will be recaptured when drawAllCanvases completes
        specImgData.current = null
        waveformImgData.current = null

        // Redraw all canvases to remove label lines from spec/waveform canvases
        if (spectrogram && frequencies && audioArray) {
            drawAllCanvases(spectrogram, frequencies, audioArray, filteredLabels)
        }

        if (labelToBeDeleted?.id === expandedLabel?.id){
            setExpandedLabel(null)
            setGlobalMouseCoordinates(null)
        }
    }

    const flipOnsetOffset = (label) => {
        const newOnset = label.offsetBin
        const newOffset = label.onsetBin

        label.onsetBin = newOnset
        label.offsetBin = newOffset

        return label
    }

    const dragOnset =  (event) => {
        if (disableOnsetOffsetEdit){
            return
        }

        clearAndRedrawSpecAndWaveformCanvases(playheadRef.current.timeframe)
        clickedLabel.onsetBin = calculateBinIndex(event)
    }


    const dragOffset = (event) => {
        if (disableOnsetOffsetEdit){
            return
        }

        clearAndRedrawSpecAndWaveformCanvases(playheadRef.current.timeframe)
        clickedLabel.offsetBin = calculateBinIndex(event)
    }

    const dragActiveLabelOnset = (event) => {
        if (disableOnsetOffsetEdit){
            return
        }

        clearAndRedrawSpecAndWaveformCanvases(playheadRef.current.timeframe)
        draggedActiveLabel.onsetBin = calculateBinIndex(event)
        drawLine(draggedActiveLabel, draggedActiveLabel.onsetBin)
        // Only draw offset line if offset exists
        if (draggedActiveLabel.offsetBin !== undefined && draggedActiveLabel.offsetBin !== null) {
            drawLine(draggedActiveLabel, draggedActiveLabel.offsetBin)
        }
    }

    const dragActiveLabelOffset = (event) => {
        if (disableOnsetOffsetEdit){
            return
        }

        clearAndRedrawSpecAndWaveformCanvases(playheadRef.current.timeframe)
        draggedActiveLabel.offsetBin = calculateBinIndex(event)
        drawLine(draggedActiveLabel, draggedActiveLabel.onsetBin)
        // Only draw offset line if offset exists
        if (draggedActiveLabel.offsetBin !== undefined && draggedActiveLabel.offsetBin !== null) {
            drawLine(draggedActiveLabel, draggedActiveLabel.offsetBin)
        }
    }

    const dragMaxFreqLine = (event) => {
        // prevent the y value from being negative
        let newMaxFreqY = Math.max(0, getMouseY(event))
        if (newMaxFreqY >= draggedFrequencyLinesObject.minFreqY - 5 ) return

        if (newMaxFreqY <= 2){
            newMaxFreqY = 0
        }
        draggedFrequencyLinesObject.maxFreqY = newMaxFreqY
        
        clearAndRedrawSpecAndWaveformCanvases(playheadRef.current.timeframe)
    }

    const dragMinFreqLine = (event) => {
        let newMinFreqY = getMouseY(event)
        if (newMinFreqY <= draggedFrequencyLinesObject.maxFreqY + 5 ) return
        
        // Adjust the minFreq line manually to allow it to be dragged to the very bottom of the canvas
        if (newMinFreqY >= specCanvasRef.current.height - 2) {
            newMinFreqY = specCanvasRef.current.height
        }
        draggedFrequencyLinesObject.minFreqY = newMinFreqY

        clearAndRedrawSpecAndWaveformCanvases(playheadRef.current.timeframe)
    }

    const magnet = (bin) => {
        if (!allowAnnotationOverlap){
            for (let label of labels) {
                if (bin > label.onsetBin && bin < label.offsetBin) {
                    const distToOnset = Math.abs(bin - label.onsetBin);
                    const distToOffset = Math.abs(bin - label.offsetBin);

                    if (distToOnset < distToOffset) {
                        return label.onsetBin;
                    } else {
                        return label.offsetBin;
                    }
                }
            }
        }

        return bin;
    };


    const updateLabelsWithSpeciesArrayData = () => {
        const allIndividualIDs = getAllIndividualIDs(speciesArray)

        // Iterate over the labels array
        return labels.map(label => {
            // Create an updated label with old values
            const updatedLabel = new Label(
                label.id,
                trackID,
                trackData.filename,
                label.onsetBin,
                label.offsetBin,
                label.minFreq,
                label.maxFreq,
                label.species,
                label.individual,
                label.clustername,
                label.speciesID,
                label.individualID,
                label.clusternameID,
                label.individualIndex,
                label.annotator,
                label.color,
                label.uncertainSpeices,
                label.uncertainIndividual,
                label.uncertainClustername,
                label.configSnapshot,
                label.originalConfigSnapshot,
                label.onsetTime,
                label.offsetTime
            )

            // Iterate over speciesArray and update the potentially new names, colors and individualIndexes to updatedLabel
            for (const speciesObj of speciesArray) {
                if (updatedLabel.speciesID === speciesObj.id) {
                    updatedLabel.species = speciesObj.name
                }
                for (const individual of speciesObj.individuals) {
                    if (updatedLabel.individualID === individual.id) {
                        updatedLabel.individual = individual.name
                        updatedLabel.individualIndex = allIndividualIDs.indexOf(individual.id)
                    }
                }
                for (const clustername of speciesObj.clusternames) {
                    if (updatedLabel.clusternameID === clustername.id) {
                        updatedLabel.clustername = clustername.name
                        updatedLabel.color = clustername.color
                    }
                }
            }

            return updatedLabel
        })
            // Remove labels that have a species, Individual or clustername that have been deleted in Annotation Label Component
            .filter(label =>
                label.speciesID !== deletedItemID &&
                label.individualID !== deletedItemID &&
                label.clusternameID !== deletedItemID
            )
    }

    const assignSpeciesInformationToImportedLabels = (currentSpeciesArray, genericLabelObjectsArray) => {
        const allIndividualIDs = getAllIndividualIDs(currentSpeciesArray)
        const currentConfig = getConfigSnapshot()

        // Check if any labels are legacy (missing onsetBin/offsetBin) and show a one-time toast
        const hasLegacyLabels = genericLabelObjectsArray.some(label =>
            label.configSnapshot.onsetBin === undefined || label.configSnapshot.offsetBin === undefined
        )
        if (hasLegacyLabels) {
            toast.info('Legacy annotations detected. Labels will be imported using the current nfft and hop length.', { autoClose: 6000 })
        }

        // Iterate over the imported labels array
        return genericLabelObjectsArray.map( label => {

            // WhisperSeg currently doesn't support Frequency Annotation, so if the imported label has no frequency, assign empty string
            // const newMinFreq = (label.minFreq || label.minFreq===0 )? label.minFreq : ''
            // const newMaxFreq = (label.maxFreq || label.maxFreq===0 )? label.maxFreq : ''
            const newMinFreq = ( (label.minFreq || label.minFreq===0) && label.minFreq !== -1 )? label.minFreq : ''
            const newMaxFreq = ( (label.maxFreq || label.maxFreq===0) && label.maxFreq !== -1 )? label.maxFreq : ''

            // Get bin indices: use stored bins if available, otherwise convert from time
            let onsetBin, offsetBin
            // originalImportConfig: the config from the CSV, used for stable re-export
            let originalImportConfig = null

            // Ground truth time: either from CSV onset/offset columns, or computed from stored bins
            let onsetTime, offsetTime

            if (label.configSnapshot.onsetBin !== undefined && label.configSnapshot.offsetBin !== undefined) {
                // New-format CSV: bins are stored directly in configSnapshot
                const importOnsetBin = label.configSnapshot.onsetBin
                const importOffsetBin = label.configSnapshot.offsetBin

                // Strip onsetBin/offsetBin from the imported configSnapshot to get the original config
                const { onsetBin: _ob, offsetBin: _offb, ...importedConfig } = label.configSnapshot
                originalImportConfig = importedConfig

                // Compute ground truth time from import bins + import config
                const importNfft = Number(importedConfig.nfft) || currentConfig.nfft
                const importHop = Number(importedConfig.hopLength) || currentConfig.hopLength
                const importSr = Number(importedConfig.samplingRate) || globalSamplingRate
                const time = binsToTime(importOnsetBin, importOffsetBin, importNfft, importHop, importSr)
                onsetTime = time.onset
                offsetTime = time.offset
            } else {
                // Legacy CSV: onset/offset are time values — these are the ground truth
                onsetTime = label.onset
                offsetTime = label.offset
            }

            // Convert ground truth time to bins in the current config
            const importedBins = importTimeToBins(onsetTime, offsetTime, currentConfig.nfft, currentConfig.hopLength, globalSamplingRate)
            onsetBin = importedBins.onsetBin
            offsetBin = importedBins.offsetBin

            const updatedLabel = new Label(
                nanoid(),
                trackID,
                trackData.filename,
                onsetBin,
                offsetBin,
                newMinFreq,
                newMaxFreq,
                label.species,
                label.individual,
                label.clustername,
                null,
                null,
                null,
                null,
                null,
                null,
                label?.uncertainSpeices ?? false,
                label?.uncertainIndividual ?? false,
                label?.uncertainClustername ?? false,
                currentConfig,
                originalImportConfig,
                onsetTime,
                offsetTime
            )

            // Iterate over speciesArray and assign the new label it's correct IDs and color from existing
            for (const speciesObj of currentSpeciesArray) {
                if (updatedLabel.species === speciesObj.name) {
                    updatedLabel.speciesID = speciesObj.id
                    for (const individual of speciesObj.individuals) {
                        if (updatedLabel.individual === individual.name) {
                            updatedLabel.individualID = individual.id
                            updatedLabel.individualIndex = allIndividualIDs.indexOf(individual.id)
                        }
                    }
                    for (const clustername of speciesObj.clusternames) {
                        if (updatedLabel.clustername === clustername.name) {
                            updatedLabel.clusternameID = clustername.id
                            updatedLabel.color = clustername.color
                        }
                    }
                }
            }

            return updatedLabel
        })
    }

    const assignCurrentConfigToLabelsWithoutIt = (importedLabels) => {
        // For CSV Files created with legacy Callmark, which did not support configSnapshot, use the current track config and assign it to each label.
        const currentConfig = getConfigSnapshot()
        for (const label of importedLabels){
            if (!label.configSnapshot){
                label.configSnapshot = currentConfig;
            }
        }
        return importedLabels
    }


    /* ++++++++++++++++++ Audio methods ++++++++++++++++++ */
    const getAudio = async (newStartTime, newClipDuration) => {
        // Don't try to retrieve audio if there's no file uploaded, it will cause an error
        if (!spectrogram) return

        // maximally play 10 min audio at a time
        const effectiveAudioClipDuration = Math.min( newClipDuration, 300 ) 

        // Prevent user from clicking the play button twice in a row and playing the audio twice at the same time
        if (audioSnippet && !audioSnippet.paused) return

        // If the user plays the same audio clip multiple times without changing start or end time, just play the
        // existing audio clip and don't request new audio clip from the backend each time
        // comment out this for now since it triggers unstable behaviors
        // if (newStartTime === playWindowTimes?.startTime && effectiveAudioClipDuration === playWindowTimes?.clipDuration){
        //     playAudio()
        //     return
        // }

        // Else, start process to get a new audio snippet from the backend
        setAudioSnippet(null)
        setPlayWindowTimes( {startTime: newStartTime, clipDuration: effectiveAudioClipDuration} )

        annotationTimestamps.current = [...annotationTimestamps.current, {
            "hash_id":hashID,
            "timestamp":getCurrentUTCTime().toISOString(),
            "action":"play_audio",
            "deviceInfo":getDeviceInfo()
        } ];

        const path = import.meta.env.VITE_BACKEND_SERVICE_ADDRESS+'get-audio-clip-wav'
        try {
            const response = await axios.post(path, {
                audio_id: audioId,
                start_time: newStartTime,
                clip_duration: effectiveAudioClipDuration
            })
            handleNewAudio(response.data.wav)
        } catch (error) {
            toast.error('Something went wrong trying to play back the audio. Check the console for more information.')
            console.error("Error fetching audio clip:", error)
        }
    }

    const handleNewAudio = (newAudioBase64String) => {
        const audio = new Audio(`data:audio/ogg;base64,${newAudioBase64String}`)
        setAudioSnippet(audio)
    }

    const playAudio = () => {
        if (audioSnippetOffsetRef.current>0){
            audioSnippet.currentTime = audioSnippet.currentTime + audioSnippetOffsetRef.current
            audioSnippetOffsetRef.current = 0
        }
        audioSnippet.play()
        loop()
    }

    function loop(){
        clearAndRedrawSpecAndWaveformCanvases(Math.min(trackData.audioDuration, playWindowTimes?.startTime + audioSnippet.currentTime) )

        if ( playWindowTimes?.startTime + audioSnippet.currentTime >= trackData.audioDuration ){
            stopAudio()
            setTimeout(()=>setIsControllingAudioPlay(!isControllingAudioPlay), 50)
            return
        }
        
        if (pauseAudioRef.current){
            pauseAudioRef.current = false
            audioSnippetOffsetRef.current = audioSnippet.currentTime
            pauseAudio()
            return
        }

        if (audioSnippet.paused ){

            if (  playWindowTimes?.startTime + audioSnippet.currentTime >= currentEndTime - 1e-3 ){
                if ( trackData.audioDuration - currentEndTime >= globalClipDuration  ){
                    setCurrentStartTime(currentEndTime)
                    setCurrentEndTime( Math.min( currentEndTime + globalClipDuration ) )
                    getAudio( currentEndTime, globalClipDuration )
                    return
                }else{
                    if (trackData.audioDuration - currentEndTime > 0){
                        const remainingTime = trackData.audioDuration - currentEndTime 
                        const shiftTime = Math.min(globalClipDuration - remainingTime, currentEndTime )
                        const newStartTime = currentEndTime - shiftTime
                        const newEndTime = newStartTime + globalClipDuration
                        setCurrentStartTime(newStartTime)
                        setCurrentEndTime(newEndTime )
                        audioSnippetOffsetRef.current = shiftTime
                        getAudio( newStartTime, globalClipDuration )
                        return
                    }else{
                        stopAudio()
                        setTimeout(()=>setIsControllingAudioPlay(!isControllingAudioPlay), 50)
                        return
                    }
                }
            }else{
                // pauseAudio()
                stopAudio()
                setTimeout(()=>setIsControllingAudioPlay(!isControllingAudioPlay), 50)
                return
            }
        }
        
        window.requestAnimationFrame(() => loop() )
    }

    const pauseAudio = () => {
        if (!audioSnippet) return
        audioSnippet.pause()
        updatePlayhead(playWindowTimes?.startTime + audioSnippet.currentTime)
    }

    const stopAudio = () => {
        if (!audioSnippet) return

        audioSnippet.pause()
        audioSnippet.currentTime = 0//playWindowTimes?.startTime
        updatePlayhead(0)

        clearAndRedrawSpecAndWaveformCanvases(null)
    }

    const updatePlayhead = (newTimeframe) => {
        playheadRef.current.timeframe = newTimeframe
    }

    const drawPlayhead = (timeframe) => {
        // Only draw playhead when timeframe exists and audio is actually playing
        // Check audioSnippet directly instead of state to avoid stale state during animation loop
        if (!timeframe || !audioSnippet || audioSnippet.paused) return

        const specCVS = specCanvasRef.current
        const specCTX = specCVS.getContext('2d', { willReadFrequently: true });
        const waveformCVS = waveformCanvasRef.current
        const waveformCTX = waveformCVS.getContext('2d', { willReadFrequently: true });

        const x = calculateXPositionFromTime(timeframe)
        const playHeadColor = '#ff0000'

        specCTX.lineWidth = 2
        specCTX.strokeStyle = playHeadColor
        waveformCTX.lineWidth = 2
        waveformCTX.strokeStyle = playHeadColor
        waveformCTX.fillStyle = playHeadColor

        specCTX.beginPath()
        specCTX.moveTo(x, 0)
        specCTX.lineTo(x, specCVS.height)
        specCTX.stroke()

        waveformCTX.beginPath()
        waveformCTX.moveTo(x, 0)
        waveformCTX.lineTo(x, waveformCVS.height)
        waveformCTX.moveTo(x, 1)
        waveformCTX.lineTo(x+3, 6)
        waveformCTX.lineTo(x, 12)
        waveformCTX.lineTo(x-3, 6)
        waveformCTX.lineTo(x, 1)
        waveformCTX.fill();
        waveformCTX.stroke()
    }


    /* ++++++++++++++++++ Waveform ++++++++++++++++++ */

    const getAudioArray = async () => {
        // Use ref to avoid stale audioId from closure
        const currentAudioId = audioIdRef.current || audioId
        if (!currentAudioId) {
            return null
        }

        const path = import.meta.env.VITE_BACKEND_SERVICE_ADDRESS+'get-audio-clip-for-visualization'

        // Use the same quantized start time as the spectrogram
        const actualViewStartSample = Math.floor(currentStartTime * globalSamplingRate)
        const actualViewStartTime = actualViewStartSample / globalSamplingRate

        // Calculate the actual duration that matches the spectrogram
        const numSamples = (globalNumSpecColumns - 1) * globalHopLength + nfft
        const actualDuration = numSamples / globalSamplingRate

        // Create cache key based on view parameters including canvas width
        const cacheKey = `${currentAudioId}_${actualViewStartTime}_${globalHopLength}_${globalNumSpecColumns}_${nfft}_${specCalMethod}_${canvasWidth}`

        // Return cached data if available
        if (waveformCacheKey.current === cacheKey && waveformDataCache.current) {
            return waveformDataCache.current
        }

        const requestParameters = {
            audio_id: currentAudioId,
            start_time: actualViewStartTime,  // Use quantized time that matches spectrogram
            clip_duration: actualDuration,  // Use calculated duration that matches spectrogram
            target_length: canvasWidth,  // Resample to canvas width for perfect pixel alignment
            // Pass spectrogram parameters for exact alignment
            hop_length: globalHopLength,
            num_spec_columns: globalNumSpecColumns,
            n_fft: nfft,
            spec_cal_method: specCalMethod,
            sampling_rate: globalSamplingRate  // Use same sampling rate as spectrogram
        }

        try {
            const response = await axios.post(path, requestParameters);
            // Backend now returns {min_vals, max_vals} instead of wav_array
            const data = response.data

            // Cache the result
            waveformDataCache.current = data
            waveformCacheKey.current = cacheKey

            return data
        } catch(error) {
            toast.error('Something went wrong trying to get the audio waveform. Check the console for more information.')
            console.error("Error fetching audio array for waveform:", error)
        }
    }

    const drawWaveform = (waveformData) => {
        if (!waveformCanvasRef.current || !waveformData || !displayWaveform) return

        const canvas = waveformCanvasRef.current
        const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: true })
        canvas.width = canvasWidth

        const centerY = canvas.height / 2
        ctx.strokeStyle = WAVEFORM_COLOR

        // Handle BBC audiowaveform style min/max pairs
        if (waveformData.min_vals && waveformData.max_vals) {
            // Draw filled bars with connecting lines
            const minVals = waveformData.min_vals
            const maxVals = waveformData.max_vals
            const numPoints = minVals.length

            ctx.fillStyle = WAVEFORM_COLOR
            ctx.strokeStyle = WAVEFORM_COLOR
            ctx.lineWidth = 1
            // Don't use ratio - the backend already sent us data matching the view
            const pixelWidth = canvas.width
            const barWidth = pixelWidth / numPoints

            // First draw all the bars - edge to edge, no gaps
            for (let i = 0; i < numPoints; i++) {
                const x = i * barWidth
                const yMin = centerY - waveformScale * minVals[i]
                const yMax = centerY - waveformScale * maxVals[i]
                const barHeight = Math.abs(yMax - yMin) || 1
                ctx.fillRect(x, Math.min(yMin, yMax), barWidth, barHeight)
            }

            // Then draw connecting lines on top (max envelope)
            ctx.beginPath()
            for (let i = 0; i < numPoints; i++) {
                const x = i * barWidth + barWidth / 2  // Center of each bar
                const y = centerY - waveformScale * maxVals[i]
                if (i === 0) {
                    ctx.moveTo(x, y)
                } else {
                    ctx.lineTo(x, y)
                }
            }
            ctx.stroke()

            // Draw connecting lines for min envelope
            ctx.beginPath()
            for (let i = 0; i < numPoints; i++) {
                const x = i * barWidth + barWidth / 2  // Center of each bar
                const y = centerY - waveformScale * minVals[i]
                if (i === 0) {
                    ctx.moveTo(x, y)
                } else {
                    ctx.lineTo(x, y)
                }
            }
            ctx.stroke()
        } else if (waveformData.wav_array || Array.isArray(waveformData)) {
            // Fallback: single array format
            const audioData = waveformData.wav_array || waveformData
            ctx.strokeStyle = WAVEFORM_COLOR
            ctx.lineWidth = 1
            ctx.beginPath()

            for (let i = 0; i < audioData.length; i++) {
                const x = i * canvas.width / audioData.length
                const y = centerY - waveformScale * audioData[i]
                if (i === 0) {
                    ctx.moveTo(x, y)
                } else {
                    ctx.lineTo(x, y)
                }
            }
            ctx.stroke()
        } else {
            return
        }

        waveformImgData.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
    }

    const waveformZoomIn = () => {
        setWaveformScale(prevState => prevState * 1.3)
     }

     const waveformZoomOut = () => {
         setWaveformScale(prevState => Math.max(prevState * 0.7, 0.1))
     }

    const toggleDisplayWaveform = () => {
        if (!spectrogram) return
        setDisplayWaveform(!displayWaveform)
    }


    /* ++++++++++++++++++ Tracks ++++++++++++++++++ */

    const handleRemoveTrack = () => {
        if (!confirm('Removing this track will delete any annotations you have made in it.')) return

        stopAudio()
        removeTrackInApp(trackID)
    }

    /* ++++++++++++++++++ Track Container ++++++++++++++++++ */
    const handleMouseLeaveTrackContainer = () => {
        // Don't delete labels without offsets - allow user to move time and add offset later
        // const newestLabel = labels[labels.length -1]
        // if (newestLabel && !newestLabel.offsetBin){
        //     deleteLabel(newestLabel)
        //     emitter.emit('dataChange', {
        //         onset: undefined,
        //         offset: undefined,
        //         id: undefined,
        //         trackID: undefined,
        //         color: undefined,
        //     })
        // }
    }

    /* ++++++++++++++++++ Frequencies Axis ++++++++++++++++++ */
    const drawFrequenciesAxis = (frequenciesArray) => {
        if (!frequenciesCanvasRef.current) return

        const cvs = frequenciesCanvasRef.current
        const ctx = cvs.getContext('2d', { willReadFrequently: true, alpha: true })
        ctx.clearRect(0, 0, cvs.width, cvs.height);

        ctx.strokeStyle = '#ffffff'
        ctx.fillStyle = '#ffffff'
        ctx.lineWidth = 1.5

        // Get correct frequencies
        const specCanvasHeight = specCanvasRef.current.height
        const distanceBetweenLines = specCanvasHeight / 6

        const linePositions = []
        for (let i = specCanvasHeight; i >= 0; i-= distanceBetweenLines){
            linePositions.push(i)
        }

        const selectedFrequencies = linePositions.map( y => getFrequencyAtYPosition(y, specCanvasHeight, frequenciesArray))

        // Draw the frequencies
        let y = cvs.height
        const x1 = cvs.width - 10
        const x2 = cvs.width
        let i = 0
        for (let freq of selectedFrequencies){
            let textY = y
            let freqText = `${(freq / 10) * 10}`
            if (!showWaveform){
                if (i === 0){
                    freqText += ' Hz'
                }
                if (i > 0 && i < 6){
                    textY += 4
                }
                if (i === 6){
                    textY += 8
                }
            }
            ctx.beginPath()
            ctx.moveTo(x1,y)
            ctx.lineTo(x2, y)
            ctx.stroke()
            ctx.fillText(freqText, 0, textY);
            y -= distanceBetweenLines
            i++
        }

        if (showWaveform){
            ctx.fillText('Hz', 0, 10);
        }

    }

    const handleClickFrequencyLinesBtn = () => {
        // setShowFrequencyLines(true)
        // // setFrequencyLines({...frequencyLines})
        // setFrequencyLines({maxFreqY: 0, minFreqY: specCanvasHeight})
        // allowUpdateMinFreqGivenLineY.current = true
        // allowUpdateMaxFreqGivenLineY.current = true

        setShowFrequencyLines(true)
        setFrequencyLines({maxFreqY: -10, minFreqY: specCanvasHeight + 10})
        allowUpdateMinFreqGivenLineY.current = false
        allowUpdateMaxFreqGivenLineY.current = false
        setNumFreqLinesToAnnotate(2)
    }

    const handleClickRemoveAnnotatedFreqBtn = ()=>{
        setNumFreqLinesToAnnotate(0)
        passExpandedLabelToTrack( {...expandedLabel, minFreq:'', maxFreq:''} )
        allowUpdateMinFreqGivenLineY.current = false
        allowUpdateMaxFreqGivenLineY.current = false
    }

    const getFrequencyAtYPosition = (y, canvasHeight, frequenciesArray) => {
        // Use array.length - 1 to match the inverse function
        let index = Math.round(((canvasHeight - y) / canvasHeight) * (frequenciesArray.length - 1));
        index = Math.min(index, frequenciesArray.length - 1);
        index = Math.max(0, index);
        return frequenciesArray[index];
    };
    
    const getYPositionAtFrequency = (frequency, canvasHeight, frequenciesArray) => {
        if ( frequency === '' ) return -20
        if ( frequency < frequenciesArray[0] - 1 ) return canvasHeight + 20  // -1 to make sure frequency is really small enough
        if ( frequency > frequenciesArray[frequenciesArray.length - 1] + 1 ) return -20 // +1 to make sure frequency is really large enough

        let closestIndex = frequenciesArray.reduce((closestIdx, currentFreq, currentIdx) => {
            return Math.abs(currentFreq - frequency) < Math.abs(frequenciesArray[closestIdx] - frequency)
                ? currentIdx
                : closestIdx;
        }, 0);
    
        let y = Math.round((1 - closestIndex / (frequenciesArray.length - 1)) * canvasHeight);
        return Math.max(0, Math.min(canvasHeight, y));
    };
    

    const drawFrequencyLines = (frequenciesArray, frequencyLines) => {
        if (!showFrequencyLines) return

        const cvs = specCanvasRef.current
        const ctx = cvs.getContext('2d', { willReadFrequently: true, alpha: true })

        ctx.strokeStyle = FREQUENCY_LINES_COLOR
        ctx.fillStyle = FREQUENCY_LINES_COLOR
        // ctx.lineWidth = 1
        const triangleHeight = 7

        // Determine if there is enough space between the frequency lines to display the frequencies as the correct position
        const enoughSpaceBetweenLines = frequencyLines.minFreqY - frequencyLines.maxFreqY > 22

        // Draw Max Frequency
        let x1 = 0
        let x2 = cvs.width
        let y = frequencyLines.maxFreqY
        let textY = enoughSpaceBetweenLines ? y + 10 : y - 10
        const currentMaxFreq = `${getFrequencyAtYPosition(y, cvs.height, frequenciesArray)} Hz`

        ctx.lineWidth = y > 0 ? 1 : 2

        ctx.beginPath()
        ctx.moveTo(x1, y)
        ctx.lineTo(x2, y)
        ctx.stroke()
        ctx.fillText(currentMaxFreq, 0, textY)

        // Draw Top Triangle
        x1 = 5
        x2 = x1 + triangleHeight
        let x3 = x2 + triangleHeight
        let y1 = frequencyLines.maxFreqY
        let y2 = frequencyLines.maxFreqY - triangleHeight
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.lineTo(x3, y1)
        ctx.fill()

        // Draw Min Frequency
        x1 = 0
        x2 = cvs.width
        y = frequencyLines.minFreqY
        textY = enoughSpaceBetweenLines ? y - 4 : y + 17
        const currentMinFreq = `${getFrequencyAtYPosition(y, cvs.height, frequenciesArray)} Hz`

        ctx.lineWidth = y < cvs.height ? 1 : 2

        ctx.beginPath()
        ctx.moveTo(x1, y)
        ctx.lineTo(x2, y)
        ctx.stroke()
        ctx.fillText(currentMinFreq, 0, textY)

        // Draw Bottom Triangle
        x1 = 5
        x2 = x1 + triangleHeight
        x3 = x2 + triangleHeight
        y1 = frequencyLines.minFreqY
        y2 = frequencyLines.minFreqY + triangleHeight
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.lineTo(x3, y1)
        ctx.fill()
    }

    const handleKeyUp = useCallback( (event)=>{
        // Only handle arrow keys when label window is open for the current track
        if ( (event.key === 'ArrowLeft'|| event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown' )
              && expandedLabel!== null && expandedLabel.trackID == trackID ){

                event.preventDefault()
                event.stopPropagation()

            if (browseLabelsRef.current){
                clearTimeout(browseLabelsRef.current  )
            }

            browseLabelsRef.current = setTimeout(()=>{
                if (event.key === 'ArrowLeft'|| event.key === 'ArrowRight'){
                    const labelsOfSameIndividual = labels.filter( (label)=> label.speciesID === expandedLabel.speciesID && label.individualID === expandedLabel.individualID  ).sort( (a,b) => {
                        // First compare onset
                        if (a.onsetBin !== b.onsetBin) {
                            return a.onsetBin - b.onsetBin;
                        }
                        // If onsets are equal, compare ids
                        return a.id.localeCompare(b.id);
                    } )
                    
                    // If there is only one segments, then just do nothing
                    if ( labelsOfSameIndividual.length <= 1 ){
                        return
                    }

                    let i = 0
                    for( i = 0; i < labelsOfSameIndividual.length; i ++  ){
                        if (labelsOfSameIndividual[i].id === expandedLabel.id ){
                            break
                        }
                    }
                                       
                    let nextLabelIndex = i
                    if (event.key === 'ArrowLeft'){
                        nextLabelIndex --
                        if (nextLabelIndex < 0){
                            nextLabelIndex = labelsOfSameIndividual.length - 1
                        }
                    }else{
                        nextLabelIndex = (nextLabelIndex + 1) % labelsOfSameIndividual.length 
                    }

                    let labelToBeExpanded = labelsOfSameIndividual[ nextLabelIndex ]

                    setExpandedLabel(labelToBeExpanded)
                    setActiveLabel(labelToBeExpanded)

                    emitter.emit('dataChange', {
                        onsetBin: labelToBeExpanded.onsetBin,
                        offsetBin: labelToBeExpanded.offsetBin,
                        onsetTime: binToTime(labelToBeExpanded.onsetBin, globalHopLength, globalSamplingRate),
                        offsetTime: binToTime(labelToBeExpanded.offsetBin, globalHopLength, globalSamplingRate),
                        id: labelToBeExpanded.id,
                        trackID: trackID,
                        color: ACTIVE_LABEL_COLOR,
                    })
                }else{
                    // Mouse up or down
                    let labelsOfIndex = {}
                    for ( let i = 0; i < labels.length; i ++ ){
                        if (!(labels[i].individualIndex in labelsOfIndex  )){
                            labelsOfIndex[labels[i].individualIndex ] = []
                        }
                        labelsOfIndex[labels[i].individualIndex ].push( labels[i] )
                    }
                    const validIndividualIndices = Object.keys( labelsOfIndex ).sort((a,b)=> a-b).map((a)=> +a)
                    if (validIndividualIndices.length === 0){
                        return
                    }
                    let nextIndividualIndex = null
                    if (event.key === 'ArrowUp'){
                        for (let i = 0; i < validIndividualIndices.length - 1 ; i ++){
                            if ( validIndividualIndices[i] < expandedLabel.individualIndex &&  validIndividualIndices[i+1]>= expandedLabel.individualIndex){
                                nextIndividualIndex = validIndividualIndices[i]
                                break
                            }
                        }
                        if (nextIndividualIndex === null ){
                            nextIndividualIndex = validIndividualIndices[validIndividualIndices.length-1]
                        }
                    }else{ // ArrowDown
                        for (let i = 1; i < validIndividualIndices.length ; i ++){
                            if ( validIndividualIndices[i-1] <= expandedLabel.individualIndex &&  validIndividualIndices[i]> expandedLabel.individualIndex){
                                nextIndividualIndex = validIndividualIndices[i]
                                break
                            }
                        }
                        if (nextIndividualIndex === null ){
                            nextIndividualIndex = validIndividualIndices[0]
                        }
                    }
                    
                    const sortedLabelsOfNextIndividual = labelsOfIndex[nextIndividualIndex].sort( (a,b) => {
                        return Math.abs( a.onsetBin - expandedLabel.onsetBin ) - Math.abs( b.onsetBin - expandedLabel.onsetBin )
                    } ) 

                    let labelToBeExpanded = sortedLabelsOfNextIndividual[ 0 ]

                    // if the next label_to_be_expanded is the expanded label itself, then do nothing
                    if ( expandedLabel !== null && labelToBeExpanded!== null && expandedLabel.id === labelToBeExpanded.id ){
                        return 
                    }

                    setExpandedLabel(labelToBeExpanded)
                    setActiveLabel(labelToBeExpanded)

                    emitter.emit('dataChange', {
                        onsetBin: labelToBeExpanded.onsetBin,
                        offsetBin: labelToBeExpanded.offsetBin,
                        onsetTime: binToTime(labelToBeExpanded.onsetBin, globalHopLength, globalSamplingRate),
                        offsetTime: binToTime(labelToBeExpanded.offsetBin, globalHopLength, globalSamplingRate),
                        id: labelToBeExpanded.id,
                        trackID: trackID,
                        color: ACTIVE_LABEL_COLOR,
                    })
                }
            }, 50 )
        }
    }, [ expandedLabel, globalMouseCoordinates ])

    const getUpdatedLabelsGivenSpecParaChange=( specCalMethod, binsPerOctave, minFreq, nBins, nfft, samplingRate, hopLength )=>{
        if ( !specCalMethod || !labels || labels.length === 0){
            return labels.map( (label)=>label )
        }
        if (specCalMethod === "constant-q"){
            if (!binsPerOctave || minFreq === undefined || minFreq === "" || !nBins ){
                return labels.map( (label)=>label )
            }
        }else{
            if (!nfft || !hopLength || !globalSamplingRate ){
                return labels.map( (label)=>label )
            }
        }
        const newConfig = { nfft, hopLength, samplingRate }
        const updatedLabels = labels.map( (label)=>{
            // Recompute bins from stored ground truth time
            if (label.onsetTime === undefined || label.offsetTime === undefined) {
                // Label without time (e.g. onset-only in progress) — simple hop ratio
                const oldHop = label.configSnapshot.hopLength || hopLength
                const ratio = oldHop / hopLength
                return new Label(
                    label.id, label.trackID, label.filename,
                    label.onsetBin * ratio, label.offsetBin,
                    label.minFreq, label.maxFreq,
                    label.species, label.individual, label.clustername,
                    label.speciesID, label.individualID, label.clusternameID,
                    label.individualIndex, label.annotator, label.color,
                    label.uncertainSpeices, label.uncertainIndividual, label.uncertainClustername,
                    newConfig, label.originalConfigSnapshot,
                    label.onsetTime, label.offsetTime
                )
            }
            const newBins = importTimeToBins(label.onsetTime, label.offsetTime, nfft, hopLength, samplingRate)
            const updatedLabel = new Label(
                label.id,
                label.trackID,
                label.filename,
                newBins.onsetBin,
                newBins.offsetBin,
                label.minFreq,
                label.maxFreq,
                label.species,
                label.individual,
                label.clustername,
                label.speciesID,
                label.individualID,
                label.clusternameID,
                label.individualIndex,
                label.annotator,
                label.color,
                label.uncertainSpeices,
                label.uncertainIndividual,
                label.uncertainClustername,
                newConfig,
                label.originalConfigSnapshot,
                label.onsetTime,
                label.offsetTime
            )
            return updatedLabel
        } )
        return updatedLabels

    }


    /* ++++++++++++++++++ UseEffect Hooks ++++++++++++++++++ */
    useEffect( ()=>{
        const shouldDisable = expandedLabel !== null
        setDisableKeyEvent( shouldDisable )
        disableKeyEventRef.current = shouldDisable // Keep ref in sync

        if (expandedLabel=== null){
            return
        }

        const expandedLabelOnsetTime = binToTime(expandedLabel.onsetBin, globalHopLength, globalSamplingRate)
        const expandedLabelOffsetTime = binToTime(expandedLabel.offsetBin, globalHopLength, globalSamplingRate)

        if (expandedLabelOnsetTime >= currentEndTime ){
            const newStartTime = Math.max( Math.min( expandedLabelOnsetTime -  globalClipDuration * 0.1,  globalAudioDuration - globalClipDuration ), 0)
            const newEndTime = newStartTime + globalClipDuration
            setCurrentStartTime( newStartTime )
            setCurrentEndTime(newEndTime)
        }else{
            if (expandedLabelOffsetTime <= currentStartTime ){
                const newEndTime = Math.max( Math.min( expandedLabelOffsetTime + globalClipDuration * 0.1, globalAudioDuration ), globalClipDuration  )
                const newStartTime = newEndTime - globalClipDuration
                setCurrentStartTime( newStartTime )
                setCurrentEndTime(newEndTime)
            }
        }

    }, [expandedLabel, globalMouseCoordinates] )


    useEffect( ()=>{
        
        window.addEventListener( "keyup", handleKeyUp )

        return ()=>{
            window.removeEventListener( "keyup", handleKeyUp )
            if (browseLabelsRef.current){
                clearTimeout( browseLabelsRef.current )
            }
        }
    }, [expandedLabel, labels, activeLabel ] )

    useEffect( ()=>{
        let activeIndIndex = 1
        let i = 1
        let activeColor = DEFAULT_UNKNOWN_CLUSTERNAME_COLOR
        for (let speciesObj of speciesArray){
            // Draw Individual names
            for (let individual of speciesObj.individuals){
                const isIndActive = individual.isActive
                if (isIndActive) {
                    activeIndIndex = i
                    const activeCluster = speciesObj.clusternames.find((item)=>item.isActive)
                    if (activeCluster!== null){
                        activeColor = activeCluster.color 
                    }               
                }
                i++
            }
        }
        setActiveIndividualIndex( activeIndIndex )
        setActiveClusterColor( activeColor )
    }, [ speciesArray ] );


    // update spectrogram canvas height
    useEffect(()=>{ setSpecCanvasHeight(globalSpecCanvasHeight) }, [ globalSpecCanvasHeight ])


    useEffect( () => {
        if (!spectrogram || !audioArray) return
        drawAllCanvases(spectrogram, frequencies, audioArray, labels)
    }, [
        // waveformScale, 
        // showWaveform, 

        // showFrequencyLines,  
        trackData.visible, 
        canvasWidth, 
        specCanvasHeight, 
        activeIndividualIndex, 
        activeClusterColor,

        //// The following three state must NOT be listened to, because it will trigger mis-alignment between spectrogram and label
        // labels, 
        // spectrogram,
        // frequencies,  
        // audioArray 
    ] )  

    // When a user adds a new label, thus creating a new active label in the other tracks
    useEffect( () => {
        if (!spectrogram) return

        if (activeLabel!==null && !(binToTime(activeLabel.onsetBin, globalHopLength, globalSamplingRate) >= currentEndTime || binToTime(activeLabel.offsetBin, globalHopLength, globalSamplingRate) <= currentStartTime)){
            clearAndRedrawSpecAndWaveformCanvases(playheadRef.current.timeframe)
        }

        // Update the original label with the new onset or offset from the dragged active label
        if (trackID === activeLabel?.trackID || activeSpecies.name === ANNOTATED_AREA) {
            const updatedLabels = labels.map(label => {

                if (label.id === activeLabel.id) {
                    const currentConfig = getConfigSnapshot()
                    const binsChanged = label.onsetBin !== activeLabel.onsetBin || label.offsetBin !== activeLabel.offsetBin

                    // If bins changed (user drag/draw), recompute time from new bins.
                    // If bins didn't change (config switch — labels already updated), preserve stored time.
                    let onsetTime, offsetTime
                    if (binsChanged && activeLabel.onsetBin !== undefined && activeLabel.offsetBin !== undefined) {
                        const time = binsToTime(activeLabel.onsetBin, activeLabel.offsetBin, currentConfig.nfft, currentConfig.hopLength, globalSamplingRate)
                        onsetTime = time.onset
                        offsetTime = time.offset
                    } else {
                        onsetTime = label.onsetTime
                        offsetTime = label.offsetTime
                    }

                    return new Label(
                        label.id,
                        label.trackID,
                        label.filename,
                        activeLabel.onsetBin,
                        activeLabel.offsetBin,
                        label.minFreq,
                        label.maxFreq,
                        label.species,
                        label.individual,
                        label.clustername,
                        label.speciesID,
                        label.individualID,
                        label.clusternameID,
                        label.individualIndex,
                        label.annotator,
                        label.color,
                        label.uncertainSpeices,
                        label.uncertainIndividual,
                        label.uncertainClustername,
                        currentConfig,
                        label.originalConfigSnapshot,
                        onsetTime,
                        offsetTime
                    )

                } else {
                    return label
                }
            })
            setLabels(updatedLabels)
            drawAllCanvases(spectrogram, frequencies, audioArray, updatedLabels)
        }
    }, [activeLabel] )

    // When user zoomed or scrolled, or when the spectrogram's brightness and contrast is modified
    useEffect( () => {
            if (!globalClipDuration || !trackData.audioID) return

            // Don't reload spectrogram if we're in the middle of a frequency zoom (A/S keys)
            if (isFrequencyZoomingRef.current) {
                return
            }

            if (audioSnippet) {
                audioSnippet.pause()
                audioSnippet.currentTime = currentStartTime
            }

            annotationTimestamps.current = [...annotationTimestamps.current, {
                "hash_id":hashID,
                "timestamp":getCurrentUTCTime().toISOString(),
                "action":"browsing_spectrogram",
                "deviceInfo":getDeviceInfo()
            } ];
            setSpectrogramIsLoading(true)
            getSpecAndAudioArray()
    }, [
         currentStartTime,
         globalClipDuration,
         audioId, specBrightness, specContrast, colorMap])

    // When a user adds, deletes, renames or recolors species, individuals or clusternames in the SpeciesMenu Component
    useEffect(() => {
        if (!speciesArray) return

        const updatedLabels = updateLabelsWithSpeciesArrayData()
        setLabels(updatedLabels)
        drawAllCanvases(spectrogram, frequencies, audioArray, updatedLabels)

    }, [speciesArray])

    // Keyboard event listeners for 'F' key (frequency rectangle mode)
    // HOLD MODE: Hold F to enable frequency annotation, release F to disable
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'f' || event.key === 'F') {
                // Ignore repeated keydown events when key is held
                if (event.repeat) {
                    return
                }

                // Don't handle F key if key events are disabled (use ref for current value)
                if (disableKeyEventRef.current) {
                    return
                }

                // Don't handle if user is typing in an input field
                const target = event.target
                if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                    return
                }

                isFrequencyModeKeyRef.current = true
            }
        }

        const handleKeyUp = (event) => {
            if (event.key === 'f' || event.key === 'F') {
                // Don't handle keyup if it fires while label window is open
                // This prevents premature clearing when user holds F across annotations
                if (disableKeyEventRef.current) {
                    return
                }

                isFrequencyModeKeyRef.current = false
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [])

    // Keyboard event listener for 'Q' key (reset playhead and restart audio from start of window)
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'q' || event.key === 'Q') {
                // Reset playhead to the start of the current window
                updatePlayhead(currentStartTime)
                clearAndRedrawSpecAndWaveformCanvases(currentStartTime)

                // Stop any currently playing audio and restart from the beginning
                if (audioSnippet) {
                    audioSnippet.pause()
                    audioSnippet.currentTime = 0
                }

                // Start playing audio from the beginning of the window
                getAudio(currentStartTime, globalClipDuration)
            }

            if (event.key === 'w' || event.key === 'W') {
                // Reset playhead to the start of the current window
                updatePlayhead(currentStartTime)
                clearAndRedrawSpecAndWaveformCanvases(currentStartTime)

                // Stop any currently playing audio
                if (audioSnippet) {
                    audioSnippet.pause()
                    audioSnippet.currentTime = 0
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [currentStartTime, audioSnippet, globalClipDuration, spectrogram, frequencies, audioArray, labels])

    // Arrow keys - emit events for App.jsx to handle (ONLY for trackIndex 0)
    useEffect(() => {
        // Only the first track should handle arrow keys to avoid duplicate events
        if (trackData.trackIndex !== 0) {
            return
        }

        const handleArrowKeys = (event) => {
            // Only handle arrow keys
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
                return
            }

            // Skip if any label window is open (let handleKeyUp handle it instead)
            if (expandedLabel !== null) {
                return
            }

            // Skip if user is typing in an input field
            const target = event.target
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                return
            }

            event.preventDefault()
            event.stopPropagation()

            // Emit events for App.jsx to handle
            // Note: We allow event.repeat to enable continuous scrolling when key is held
            if (event.key === 'ArrowLeft') {
                emitter.emit('arrowScrollLeft')
            }
            else if (event.key === 'ArrowRight') {
                emitter.emit('arrowScrollRight')
            }
            else if (event.key === 'ArrowUp') {
                emitter.emit('arrowZoomIn')
            }
            else if (event.key === 'ArrowDown') {
                emitter.emit('arrowZoomOut')
            }
        }

        window.addEventListener('keydown', handleArrowKeys)
        return () => window.removeEventListener('keydown', handleArrowKeys)
    }, [trackData.trackIndex, expandedLabel])

    // Keep refs in sync with state
    useEffect(() => {
        minFreqRef.current = minFreq
        maxFreqRef.current = maxFreq
    }, [minFreq, maxFreq])

    // Sync frequencies ref with state
    useEffect(() => {
        frequenciesRef.current = frequencies
    }, [frequencies])

    // Sync labels ref with state
    useEffect(() => {
        labelsRef.current = labels
    }, [labels])

    // Sync activeLabel ref with state and emit center time for zoom centering
    useEffect(() => {
        activeLabelRef.current = activeLabel
        if (activeLabel && activeLabel.onsetBin !== undefined && activeLabel.offsetBin !== undefined) {
            const onsetTime = binToTime(activeLabel.onsetBin, globalHopLength, globalSamplingRate)
            const offsetTime = binToTime(activeLabel.offsetBin, globalHopLength, globalSamplingRate)
            const centerTime = (onsetTime + offsetTime) / 2
            labelCenterTimeRef.current = centerTime
            emitter.emit('labelCenterTimeChange', centerTime)
        } else {
            labelCenterTimeRef.current = null
            emitter.emit('labelCenterTimeChange', null)
        }
    }, [activeLabel, globalHopLength, globalSamplingRate])

    // Sync frequencyLines ref with state
    useEffect(() => {
        frequencyLinesRef.current = frequencyLines
    }, [frequencyLines])

    // Sync spectrogramIsLoading ref with state
    useEffect(() => {
        spectrogramIsLoadingRef.current = spectrogramIsLoading
    }, [spectrogramIsLoading])

    // Sync audioId ref with state to avoid stale closures
    useEffect(() => {
        if (audioId) {
            audioIdRef.current = audioId
        }
    }, [audioId])

    // Keyboard event listeners for frequency zoom: 'A' to zoom in, 'S' to zoom out
    // Single zoom per key press (like clicking +/- buttons)
    useEffect(() => {
        const handleKeyDown = (event) => {
            const keyLower = event.key.toLowerCase()

            // Handle frequency zoom keys (a/s)
            if (keyLower !== 'a' && keyLower !== 's') return

            // Prevent repeat events while key is held down
            if (event.repeat) return

            // Don't handle if user is typing in an input field
            const target = event.target
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                return
            }

            // Don't zoom if already loading
            if (spectrogramIsLoadingRef.current) {
                return
            }

            // Only allow frequency zoom if mouse is currently over this track's spectrogram
            if (!specCanvasRef.current || mousePositionRef.current.x == null || mousePositionRef.current.y == null) {
                return
            }

            event.preventDefault()

            // Calculate new frequency range
            const mouseY = mousePositionRef.current.y
            const canvasHeight = specCanvasRef.current.height
            const currentFrequencies = frequenciesRef.current

            if (!canvasHeight || !currentFrequencies || currentFrequencies.length === 0) return

            // Use Nyquist frequency as the absolute maximum (half the sampling rate)
            const absoluteMaxFreq = globalSamplingRate / 2

            const currentMin = parseFloat(minFreqRef.current) || 0
            const currentMax = parseFloat(maxFreqRef.current) || absoluteMaxFreq
            const range = currentMax - currentMin

            let centerFreq = getFrequencyAtYPosition(mouseY, canvasHeight, currentFrequencies)

            // Clamp centerFreq to current range to prevent both min/max moving together
            centerFreq = Math.max(currentMin, Math.min(currentMax, centerFreq))

            // Zoom factor: 'a' zooms in (0.8x range), 's' zooms out (1.25x range)
            const zoomFactor = keyLower === 'a' ? 0.8 : 1.25

            const newRange = range * zoomFactor

            const distanceFromMin = centerFreq - currentMin
            const ratioFromBottom = distanceFromMin / range

            let newMin = centerFreq - (newRange * ratioFromBottom)
            let newMax = centerFreq + (newRange * (1 - ratioFromBottom))

            if (newMin < 0) {
                newMax = newMax - newMin
                newMin = 0
            }
            if (newMax > absoluteMaxFreq) {
                newMin = newMin - (newMax - absoluteMaxFreq)
                newMax = absoluteMaxFreq
            }
            newMin = Math.max(0, newMin)
            newMax = Math.min(absoluteMaxFreq, newMax)

            if (newMax - newMin < 100) return

            const finalMinFreq = Math.round(newMin)
            const finalMaxFreq = Math.round(newMax)

            console.log(`A/S ZOOM: trackID=${trackID}, key=${keyLower}, newMin=${finalMinFreq}, newMax=${finalMaxFreq}, currentHopLength=${globalHopLength}, currentClipDuration=${globalClipDuration}`)

            // Update state and refs
            setMinFreq(finalMinFreq)
            setMaxFreq(finalMaxFreq)
            minFreqRef.current = finalMinFreq
            maxFreqRef.current = finalMaxFreq

            // Set flag to prevent time-zoom useEffect from firing
            isFrequencyZoomingRef.current = true

            // Call backend to get new spectrogram with updated frequency range
            setSpectrogramIsLoading(true)
            getSpecAndAudioArray().finally(() => {
                // Reset flag after a short delay to ensure all state updates have been processed
                // This prevents the time-zoom useEffect from firing due to any state changes
                setTimeout(() => {
                    isFrequencyZoomingRef.current = false
                    console.log(`A/S ZOOM COMPLETED: flag reset`)
                }, 100)
            })
        }

        window.addEventListener('keydown', handleKeyDown)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [globalSamplingRate, globalHopLength, globalClipDuration])

    // When a CSV File is uploaded (or labels are passed through the URL parameter)
    useEffect( () => {
        if (!importedLabels) return

        let newImportedLabels = importedLabels.filter( label => label.channelIndex === trackData.channelIndex && label.filename === trackData.filename)
        newImportedLabels = assignCurrentConfigToLabelsWithoutIt(newImportedLabels)
        newImportedLabels = assignSpeciesInformationToImportedLabels(speciesArray, newImportedLabels)

        setLabels((prevLabels) => [...prevLabels, ...newImportedLabels])
        // draw all canvases when importing annotations (import from csv or Whisperseg)
        drawAllCanvases(spectrogram, frequencies, audioArray, [...labels, ...newImportedLabels])

    }, [importedLabels])

    // When a new audio file was uploaded
    useEffect( () => {
        /*
            console.log('[DEBUG] 🔍 useEffect[trackData.audioID] triggered')
            console.log('[DEBUG]   trackData.audioID:', trackData.audioID)
            console.log('[DEBUG]   audioIdRef.current:', audioIdRef.current)
            console.log('[DEBUG]   strictMode:', strictMode)
            console.log('[DEBUG]   importedLabels:', importedLabels)
            console.log('[DEBUG]   projectData:', projectData)

         */

            if (!trackData.audioID) {
                //console.log('[DEBUG] ❌ No audioID, returning early')
                return
            }

            // If this is the first time seeing this audioID, initialize it in storage and ref
            // without clearing labels (labels might have been created already)
            if (audioIdRef.current === null || audioIdRef.current === undefined) {
                //console.log('[DEBUG] 🆕 First time initialization - setting audioID without clearing labels')
                audioIdRef.current = trackData.audioID
                labelsStorage.set(`${trackID}_audioID`, trackData.audioID)
                setAudioId(trackData.audioID)
                // Don't proceed to clear labels - this is just initialization
                return
            }

            // IMPORTANT: Only clear labels if audioID actually changed to a different file
            // Don't clear labels on component re-renders where audioID is the same
            if (audioIdRef.current === trackData.audioID) {
                //console.log('[DEBUG] ✅ audioID unchanged, skipping label clear')
                return
            }

            //console.log('[DEBUG] ⚠️ audioID changed! Will proceed to clear labels. Old:', audioIdRef.current, 'New:', trackData.audioID)

            // Update track specific values and persist to storage
            audioIdRef.current = trackData.audioID
            labelsStorage.set(`${trackID}_audioID`, trackData.audioID)
            //console.log('[DEBUG] Saved new audioID to storage:', trackData.audioID)
            setAudioId(trackData.audioID)
            setSpectrogramIsLoading(true)

            // Clear old spectrogram data and canvases
            setSpectrogram(null)
            setAudioArray(null)
            setFrequencies([])
            if (specCanvasRef.current) {
                const ctx = specCanvasRef.current.getContext('2d', { willReadFrequently: true })
                ctx.clearRect(0, 0, specCanvasRef.current.width, specCanvasRef.current.height)
            }
            if (waveformCanvasRef.current) {
                const ctx = waveformCanvasRef.current.getContext('2d', { willReadFrequently: true })
                ctx.clearRect(0, 0, waveformCanvasRef.current.width, waveformCanvasRef.current.height)
            }

            // Close Label Window
            setExpandedLabel(null)

            // Clear active label when changing tracks
            emitter.emit('dataChange', {
                onsetBin: undefined,
                offsetBin: undefined,
                onsetTime: undefined,
                offsetTime: undefined,
                id: undefined,
                trackID: undefined,
                color: undefined,
            })

            // In strict mode, if imported labels exist don't delete the labels of this track
            if (strictMode && importedLabels) return

            // If Zip Folder was imported previously, don't delete the labels of this track
            if (projectData) {
                //console.log('[DEBUG] ✅ projectData exists, not clearing labels')
                return
            }

            // In free mode delete all existing labels of this track
            //console.log('[DEBUG] 💥 CALLING setLabels([]) - This is where labels are cleared!')
            //console.trace('[DEBUG] Stack trace for setLabels([]):')
            setLabels([])

    }, [trackData.audioID])

    // When a new audio snippet is returned from the backend
    useEffect( () => {
        if (!audioSnippet) return
        playAudio()
    }, [audioSnippet] )

    // When globalAudioDuration is updated in the App component
    useEffect( () => {
        if (!globalAudioDuration || !trackData.audioID ) return

        // Don't reset zoom if we're in the middle of a frequency zoom
        if (isFrequencyZoomingRef.current) {
            return
        }

        const audioIDChanged = previousAudioIDRef.current !== trackData.audioID
        const durationChanged = previousGlobalAudioDurationRef.current !== globalAudioDuration

        if (!audioIDChanged && !durationChanged) {
            return
        }

        previousAudioIDRef.current = trackData.audioID
        previousGlobalAudioDurationRef.current = globalAudioDuration

        playheadRef.current.timeframe = 0

        // This makes the zoom in level to show the newest track fully (necessary for upload by url)
        if (strictMode){
            // Calculate duration based on actual samples: (numColumns - 1) * hopLength + nfft
            const numSamples = (globalNumSpecColumns - 1) * globalHopLength + nfft
            const newDuration = numSamples / globalSamplingRate
            const newMaxScrollTime = Math.max(globalAudioDuration - newDuration, 0)
            const newStartTime = 0
            const newEndTime = newStartTime + newDuration
            updateClipDurationAndTimes(globalHopLength, newDuration, newMaxScrollTime, newStartTime, newEndTime)
            return
        }

        // This makes the zoom in level to show the largest track fully (better for multiple files locally)
        const newHopLength = Math.floor( (globalAudioDuration * globalSamplingRate) / globalNumSpecColumns )
        // Calculate duration based on actual samples: (numColumns - 1) * hopLength + nfft
        const numSamples = (globalNumSpecColumns - 1) * newHopLength + nfft
        const newDuration = numSamples / globalSamplingRate
        const newMaxScrollTime = Math.max(globalAudioDuration - newDuration, 0)
        const newStartTime = 0
        const newEndTime = newStartTime + newDuration
        updateClipDurationAndTimes(newHopLength, newDuration, newMaxScrollTime, newStartTime, newEndTime)

    }, [trackData.audioID, globalAudioDuration] )


    // When the user clicks the Export button in Export.jsx, Submit button in App.jsx, or ZipImport button in ZipImport.jsx
    useEffect( () => {
        if (!exportRequest && !submitRequest && !zipExportRequest) return
        // sort the labels in ascending order of the onset before passing them to the App
        const sortedLabels = [...labels].sort( (a,b)=> a.onsetBin - b.onsetBin )
        addLabelsToApp(sortedLabels)

        if (zipExportRequest){
            const configSnapshot = getConfigSnapshot()
            const trackMetaData = {...trackData, ...configSnapshot}
            delete trackMetaData.trackID;
            delete trackMetaData.trackIndex;
            delete trackMetaData.visible;
            delete trackMetaData.frequencies;
            delete trackMetaData.hopLength;
            delete trackMetaData.spectrogram;
            passTrackMetaObjToApp( trackMetaData )
        }
    }, [exportRequest, submitRequest, zipExportRequest])


    useEffect(()=>{
    },[expandedLabel])

    // Set up emitter event handler to pass new active label between sibling Track.jsx components
    useEffect(() => {
        const handler = (newActiveLabel) => {
            activeLabelRef.current = newActiveLabel
            setActiveLabel(newActiveLabel)
        }

        const updateOnFocusTrackID = (onFocusTrackId)=>{
            if ( trackID !== onFocusTrackId ){
                setExpandedLabel( null )
            }
        }

        const expandedLabelHandler = (newActiveLabel) => {
            if (expandedLabel!==null && expandedLabel.trackID === trackID){
                setExpandedLabel({
                    ...expandedLabel,
                    onsetBin: newActiveLabel.onsetBin,
                    offsetBin: newActiveLabel.offsetBin,
                })
            }
        }

        emitter.on('dataChange', handler)
        emitter.on('expandedLabelHandler', expandedLabelHandler)
        emitter.on('updateOnFocusTrackID', updateOnFocusTrackID)

        // Clean up the event listener on unmount
        return () => {
            emitter.off('dataChange', handler)
            emitter.off('expandedLabelHandler', expandedLabelHandler)
            emitter.off('updateOnFocusTrackID', updateOnFocusTrackID)
        }
    }, [expandedLabel])

    // Set up resetPlayhead event handler to reset playhead when navigating/zooming/changing nfft
    useEffect(() => {
        const resetPlayheadHandler = (newTimeframe) => {
            updatePlayhead(newTimeframe)
            clearAndRedrawSpecAndWaveformCanvases(newTimeframe)
        }

        emitter.on('resetPlayhead', resetPlayheadHandler)

        // Clean up the event listener on unmount
        return () => {
            emitter.off('resetPlayhead', resetPlayheadHandler)
        }
    }, [spectrogram, frequencies, audioArray, labels])

    // Set up visibility change handler, to refresh canvases when user switches to another tab
    // I found this is only necessary when using Chrome on macOS
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                drawAllCanvases(spectrogram, frequencies, audioArray, labels)
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            // Clean up any pending hover animation frames
            if (hoverAnimationFrameRef.current) {
                cancelAnimationFrame(hoverAnimationFrameRef.current)
            }
        }
    }, [spectrogram, frequencies, audioArray, labels, activeLabel, frequencyLines, showFrequencyLines])

    // When input window is open, disable scrolling, so users can use the arrow keys inside the input fields
    useEffect(() => {
        if (expandedLabel) {
            setAnyWindowsOpen(true);
        } else {
            setAnyWindowsOpen(false);
        }
    }, [expandedLabel]);
    //ignore showLocalConfigWindow for allowing/disabling key scroll

    useEffect(() => {
        if (specCanvasRef!==null && frequencyLines!==null && frequencies!==null){
            if (frequencyLines.minFreqY > specCanvasRef.current.height && frequencyLines.maxFreqY < 0 ) return
            if (!expandedLabel) return

            // only update frequency range when the frequency lines are dragged or when initialize the frequency after clicking the Annotate Frequency button
            const currentMinFreq = expandedLabel.minFreq
            const currentMaxFreq = expandedLabel.maxFreq

            const newFrequencyRanges = {
                minFreq: !allowUpdateMinFreqGivenLineY.current ? currentMinFreq : getFrequencyAtYPosition(frequencyLines.minFreqY, specCanvasRef.current.height, frequencies) ,
                maxFreq: !allowUpdateMaxFreqGivenLineY.current ? currentMaxFreq : getFrequencyAtYPosition(frequencyLines.maxFreqY, specCanvasRef.current.height, frequencies)
            }
            setfrequencyRanges(newFrequencyRanges)
            }
    }, [frequencyLines]);

    useEffect(
        ()=>{
            // setShowFrequencyLines(false);
        }, [frequencies]
    );

    useEffect(()=>{
        if (expandedLabel == null||frequencyRanges == null) return
        setExpandedLabel( {...expandedLabel, ...frequencyRanges } )
    },[ frequencyRanges ]);


    useEffect(()=>{
        setIsPlayingAudio(audioSnippet && !audioSnippet.paused)
    }, [audioSnippet, isControllingAudioPlay, spectrogram])

    useEffect(() => {

        if (!expandedLabel){
            setNumFreqLinesToAnnotate(0)
        }else{
            if (disableOnsetOffsetEdit){
                if (expandedLabel.minFreq!=="" && expandedLabel.maxFreq!==""){
                    setNumFreqLinesToAnnotate(0)
                }else{
                    if ( expandedLabel.minFreq!=="" || expandedLabel.maxFreq!=="" ){
                        setNumFreqLinesToAnnotate(1)
                    }else{
                        setNumFreqLinesToAnnotate(2)
                    }
                }
            }
        }

        if (!expandedLabel){
            setShowFrequencyLines(false);
            allowUpdateMinFreqGivenLineY.current = false
            allowUpdateMaxFreqGivenLineY.current = false
        }else{
            setShowFrequencyLines(true);
            // note: do not add the else logic here no purpose, one cannot trigger allowUpdateMinFreqGivenLineY based on the value of minFreq automatically.
            if (expandedLabel.minFreq===""){
                allowUpdateMinFreqGivenLineY.current = false
            }
            if (expandedLabel.maxFreq===''){
                allowUpdateMaxFreqGivenLineY.current = false
            }
        }

        // update the frequencyLines based on the updated expandedLabel
        if (specCanvasRef!==null && frequencyLines!==null && frequencies!==null && expandedLabel!==null){
            const newMinFreqY = getYPositionAtFrequency(expandedLabel.minFreq, specCanvasRef.current.height, frequencies)
            const newMaxFreqY = getYPositionAtFrequency(expandedLabel.maxFreq, specCanvasRef.current.height, frequencies)
            // This is needed for updating the frequency lines when clicking a annotated segment
            if ( newMinFreqY!==frequencyLines.minFreqY || newMaxFreqY!==frequencyLines.maxFreqY ){
                setFrequencyLines( { minFreqY:newMinFreqY, maxFreqY:newMaxFreqY } )
            }
            clearAndRedrawSpecAndWaveformCanvases(playheadRef.current.timeframe, { minFreqY:newMinFreqY, maxFreqY:newMaxFreqY } )
        }

        // remove the uncompleted label in labels if exists.
        if ( labels!==null && expandedLabel!==null ){
            let updatedLabel = new Label(
                expandedLabel.id,
                expandedLabel.trackID,
                expandedLabel.filename,
                expandedLabel.onsetBin,
                expandedLabel.offsetBin,
                expandedLabel.minFreq,
                expandedLabel.maxFreq,
                expandedLabel.species,
                expandedLabel.individual,
                expandedLabel.clustername,
                expandedLabel.speciesID,
                expandedLabel.individualID,
                expandedLabel.clusternameID,
                expandedLabel.individualIndex,
                expandedLabel.annotator,
                expandedLabel.color,
                expandedLabel.uncertainSpeices,
                expandedLabel.uncertainIndividual,
                expandedLabel.uncertainClustername,
                expandedLabel.configSnapshot,
                expandedLabel.originalConfigSnapshot,
                expandedLabel.onsetTime,
                expandedLabel.offsetTime
            )
            const updatedLabels = labels.filter( label => label.id !== expandedLabel.id && label.offsetBin )
            updatedLabels.push(updatedLabel)
            passLabelsToTrack(updatedLabels)
        }
     },[ expandedLabel ])

    useEffect(()=>{
        if (!globalClipDuration || !trackData.audioID) return
        clearAndRedrawSpecAndWaveformCanvases(playheadRef.current.timeframe)
        
        const specCVS = specCanvasRef.current;
        const specCTX = specCVS.getContext('2d', { willReadFrequently: true, alpha: false });
        specCTX.clearRect(0, 0, specCVS.width, specCVS.height);

        drawFrequenciesAxis(frequencies);

    },[ specCanvasHeight ]);

    useEffect(()=>{
        setDisplayWaveform( showAllWaveforms );
    },[ showAllWaveforms ]);

    // listen to waveformScale, not listen to audioArray to avoid multiple triggering 
    useEffect(()=>{
        if (!audioArray || !displayWaveform) return
        // const canvas = waveformCanvasRef.current
        // const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: true })
        // ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawWaveform( audioArray )

        drawAllLabels(labels)  // draw the active label vertical lines in waveform canvas
    },[ waveformScale, displayWaveform ]);


    useEffect(()=>{
        setShowLabelAndIndividualsCanvas( showAllAnnotationCanvases );
    },[ showAllAnnotationCanvases ]);

    useEffect(()=>{
        if (!showLabelAndIndividualsCanvas || !labelCanvasRef.current ) return
        if (!globalClipDuration || !trackData.audioID) return
        const labelCVS = labelCanvasRef.current
        const labelCTX = labelCVS.getContext('2d', { willReadFrequently: true, alpha: true });
        labelCTX.clearRect(0, 0, labelCVS.width, labelCVS.height)

        drawIndividualsCanvas()

        drawAllLabels(labels)
    },[ showLabelAndIndividualsCanvas, selectedIndividualGlobalIndex ]);

    useEffect(()=>{
        setSpecBrightness( globalSpecBrightness )
        setSliderSpecBrightnessValue( globalSpecBrightness )
    },[ globalSpecBrightness ]);

    useEffect(()=>{
        setSpecContrast( globalSpecContrast )
        setSliderSpecContrastValue( globalSpecContrast )
    },[ globalSpecContrast ]);

    useEffect(()=>{
        setColorMap( globalColorMap )
    },[ globalColorMap ]);


    return (
        <div>
            {
                !trackData.visible ?
                    <div className='hidden-track-container'>
                        <Tooltip title={`Show Track ${trackData.trackIndex}`}>
                            <IconButton style={toggleVisibilityBtn}
                                        onClick={() => toggleTrackVisibility(trackID)}>
                                <VisibilityIcon style={icon}/>
                            </IconButton>
                        </Tooltip>
                        {`Track ${trackData.trackIndex} - ${trackName ? trackName + ' -' : ''} ${trackData.filename ? trackData.filename : 'No audio'}`}

                    </div>
                :
                <div
                    className='track-container'
                    onMouseLeave={handleMouseLeaveTrackContainer}
                >
                    <Box display="flex" flexDirection="column" width="100vw">
                        <Box display="flex" flexDirection="row">
                            {/* Box_left */}
                            <Box display="flex" flexDirection="column">
                                <Box display="flex" flexDirection="row">
                                    <Box
                                        sx={{paddingLeft:"0px"}}
                                        width={`${controlPanelWidth}px`}
                                        height={`${WAVEFORM_CVS_HEIGHT + specCanvasHeight}px`}
                                        border={0}
                                        display="flex"
                                        flexDirection="row" // Arrange buttons in a row to allow wrapping
                                        flexWrap="wrap" // Enable wrapping to form a grid layout
                                        alignContent="flex-start" // Align content to the top of the container
                                        style={{ overflowY: 'auto', overflowX: 'hidden' }} // Restrict overflow to vertical with hidden horizontal scroll
                                    >
                                            <Box sx={{paddingTop:"2px"}}
                                            >
                                                <LocalFileUpload
                                                    filename={trackData.filename}
                                                    trackID={trackID}
                                                    specCalMethod={specCalMethod}
                                                    nfft={nfft}
                                                    binsPerOctave={binsPerOctave}
                                                    minFreq={minFreq}
                                                    maxFreq={maxFreq}
                                                    passSpectrogramIsLoadingToTrack={passSpectrogramIsLoadingToTrack}
                                                    handleUploadResponse={handleUploadResponse}
                                                    handleMultipleLocalFileUploads={handleMultipleLocalFileUploads}
                                                    handleUploadError={handleUploadError}
                                                    strictMode={strictMode}
                                                    projectData={projectData}
                                                    colorMap={colorMap}
                                                    passFilesUploadingToApp={passFilesUploadingToApp}
                                                    setUploadProgress={setUploadProgress}
                                                    MAX_FILE_SIZE={MAX_FILE_SIZE}
                                                />
                                            </Box>
                                            <TextField
                                                value={trackName}
                                                onChange={(e) => setTrackName(e.target.value)}
                                                placeholder="Track Name"
                                                variant="filled"
                                                size="small"
                                                sx={{
                                                    width: 170,
                                                    '& .MuiInputBase-root': { height: 28 },
                                                    '& .MuiInputBase-input': { padding: '2px 6px', color: 'white' }
                                                }}
                                            />
                                            <Tooltip title="Delete Track">
                                                <div>
                                                    <IconButton
                                                        style={{...activeIconBtnStyle, ...(strictMode && iconBtnDisabled)}}
                                                        // sx={{paddingBottom:"-5px"}}
                                                        disabled={strictMode}
                                                        onClick={handleRemoveTrack}
                                                    >
                                                        <DeleteIcon style={{...activeIcon}}/>
                                                    </IconButton>
                                                </div>
                                            </Tooltip>
                                            <Tooltip title={`Hide Track ${trackData.trackIndex}`}>
                                                <IconButton
                                                    style={{...toggleVisibilityBtn, ...{paddingTop:"2px"}}}
                                                    onClick={() => toggleTrackVisibility(trackID)}
                                                >
                                                    <VisibilityOffIcon style={icon}/>
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title={displayWaveform ? 'Hide Waveform' : 'Show Waveform'}>
                                                <IconButton
                                                    style={{
                                                        position: 'relative',
                                                        paddingBottom: "15px",
                                                        marginTop: "8px",
                                                        marginRight: "15px",
                                                        marginLeft: "8px",
                                                    }}
                                                    onClick={ toggleDisplayWaveform }
                                                    >
                                                    {/* First Icon */}
                                                    <GraphicEqIcon
                                                        style={{
                                                        position: 'absolute',
                                                        top: '0',
                                                        left: '0',
                                                        // fontSize: '24px',
                                                        color: "white"
                                                        }}
                                                    />
                                                    {/* Second Icon */}
                                                    { displayWaveform?
                                                        <VisibilityOffIcon
                                                            style={{
                                                            position: 'absolute',
                                                            top: '-5',
                                                            left: '15px', // Adjust for overlap
                                                            fontSize: '16px',
                                                            color: "white"
                                                            }}
                                                        />:
                                                        <VisibilityIcon
                                                            style={{
                                                            position: 'absolute',
                                                            top: '-5',
                                                            left: '15px', // Adjust for overlap
                                                            fontSize: '16px',
                                                            color: "white"
                                                            }}
                                                        />
                                                    }
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title={`${showLabelAndIndividualsCanvas ? 'Hide' : 'Show'} Annotations Panel`}>
                                                <IconButton
                                                    style={{
                                                        position: 'relative',
                                                        paddingBottom: "15px",
                                                        marginTop: "8px",
                                                        marginRight: "15px",
                                                        marginLeft: "8px",
                                                    }}
                                                    onClick={ ()=>{ setShowLabelAndIndividualsCanvas(!showLabelAndIndividualsCanvas) } }
                                                    >
                                                    {/* First Icon */}
                                                    <LineStyleIcon
                                                        style={{
                                                        position: 'absolute',
                                                        top: '0',
                                                        left: '0',
                                                        // fontSize: '24px',
                                                        color: "white"
                                                        }}
                                                    />
                                                    {/* Second Icon */}
                                                    { showLabelAndIndividualsCanvas?
                                                        <VisibilityOffIcon
                                                            style={{
                                                            position: 'absolute',
                                                            top: '-5',
                                                            left: '15px', // Adjust for overlap
                                                            fontSize: '16px',
                                                            color: "white"
                                                            }}
                                                        />:
                                                        <VisibilityIcon
                                                            style={{
                                                            position: 'absolute',
                                                            top: '-5',
                                                            left: '15px', // Adjust for overlap
                                                            fontSize: '16px',
                                                            color: "white"
                                                            }}
                                                        />
                                                    }
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Move Track Up">
                                                <div>
                                                <IconButton
                                                    style={{...activeIconBtnStyle, ...(trackData.trackIndex === 0 && iconBtnDisabled)}}
                                                    disabled={trackData.trackIndex === 0}
                                                    onClick={() => moveTrackUp(trackID)}
                                                >
                                                    <VerticalAlignTopIcon style={activeIcon}/>
                                                </IconButton>
                                                </div>
                                            </Tooltip>
                                            <Tooltip title="Move Track Down">
                                                <div>
                                                <IconButton
                                                    style={{...activeIconBtnStyle, ...(trackData.trackIndex === lastTrackIndex && iconBtnDisabled)}}
                                                    disabled={trackData.trackIndex === lastTrackIndex}
                                                    onClick={() => moveTrackDown(trackID)}
                                                >
                                                    <VerticalAlignBottomIcon style={activeIcon}/>
                                                </IconButton>
                                                </div>
                                            </Tooltip>
                                            <WhisperSeg
                                                audioId={audioId}
                                                minFreq={minFreq}
                                                labels={labels}
                                                speciesArray={speciesArray}
                                                passLabelsToTrack={passLabelsToTrack}
                                                passWhisperSegIsLoadingToTrack={passWhisperSegIsLoadingToTrack}
                                                activeIconBtnStyle={activeIconBtnStyle}
                                                activeIcon={activeIcon}
                                                strictMode={strictMode && !strictDevMode}
                                                passSpeciesArrayToApp={passSpeciesArrayToApp}
                                                assignSpeciesInformationToImportedLabels={assignSpeciesInformationToImportedLabels}
                                                assignCurrentConfigToLabelsWithoutIt={assignCurrentConfigToLabelsWithoutIt}
                                                tokenInference={tokenInference}
                                                tokenFinetune={tokenFinetune}
                                                passTokenInferenceToWhisperSeg={passTokenInferenceToWhisperSeg}
                                                passTokenFinetuneToWhisperSeg={passTokenFinetuneToWhisperSeg}
                                                authToken={authToken}
                                                setAuthToken={setAuthToken}
                                                isAuthenticated={isAuthenticated}
                                                setIsAuthenticated={setIsAuthenticated}
                                                nfft={nfft}
                                                globalSamplingRate={globalSamplingRate}
                                            />
                                        <div className='audio-controls'>
                                        {/* audioSnippet && !audioSnippet.paused */}
                                            <IconButton
                                                style={iconBtn}
                                                onClick={() =>{
                                                        if (isPlayingAudio){
                                                            pauseAudioRef.current=true; 
                                                            pauseAudio()
                                                        }else{
                                                            getAudio(currentStartTime, globalClipDuration)
                                                        }
                                                        setIsControllingAudioPlay(!isControllingAudioPlay)
                                                    }
                                                }
                                            >
                                                {isPlayingAudio? <PauseIcon style={activeIcon}/>:<PlayArrowIcon style={activeIcon}/>}
                                            </IconButton>
                                            
                                            {/* <IconButton
                                                style={iconBtn}
                                                onClick={() => getAudio(currentStartTime, globalClipDuration)}
                                            >
                                                <PlayArrowIcon style={activeIcon}/>
                                            </IconButton>
                                            <IconButton style={iconBtn} onClick={ ()=>{ pauseAudioRef.current=true; pauseAudio()}}>
                                                <PauseIcon style={activeIcon}/>
                                            </IconButton> */}
                                            <IconButton style={iconBtn} onClick={()=>{
                                                                                        audioSnippetOffsetRef.current = 0
                                                                                        stopAudio();
                                                                                    }}>
                                                <StopIcon style={activeIcon}/>
                                            </IconButton>
                                        </div>
                                        <SpectrogramParameters
                                            specCalMethod={specCalMethod}
                                            nfft={nfft}
                                            binsPerOctave={binsPerOctave}
                                            minFreq={minFreq}
                                            maxFreq={maxFreq}
                                            passShowLocalConfigWindowToTrack={passShowLocalConfigWindowToTrack}
                                            passSpecCalMethodToTrack={passSpecCalMethodToTrack}
                                            passNfftToTrack={passNfftToTrack}
                                            passBinsPerOctaveToTrack={passBinsPerOctaveToTrack}
                                            passMinFreqToTrack={passMinFreqToTrack}
                                            passMaxFreqToTrack={passMaxFreqToTrack}
                                            submitLocalParameters={submitLocalParameters}
                                            strictMode={strictMode}
                                            strictDevMode={strictDevMode}
                                            spectrogram={spectrogram}
                                            globalSamplingRate={globalSamplingRate}
                                            spectrogramIsLoading={spectrogramIsLoading}
                                            setAnyWindowsOpen={setAnyWindowsOpen}
                                            dbMin={dbMin}
                                            dbMax={dbMax}
                                            setDbMin={setDbMin}
                                            setDbMax={setDbMax}
                                            colorMap={colorMap}
                                            setColorMap={setColorMap}
                                            specCanvasHeight={specCanvasHeight}
                                            setSpecCanvasHeight={setSpecCanvasHeight}
                                            disableKeyEvent={disableKeyEvent}
                                            />
                                        {
                                            expandedLabel &&
                                            <LabelWindow
                                                key={expandedLabel.id}
                                                speciesArray={speciesArray}
                                                labels={labels}
                                                expandedLabel={expandedLabel}
                                                passLabelsToTrack={passLabelsToTrack}
                                                passExpandedLabelToTrack={passExpandedLabelToTrack}
                                                getAllIndividualIDs={getAllIndividualIDs}
                                                audioId={audioId}
                                                getAudio={getAudio}
                                                handleClickFrequencyLinesBtn={handleClickFrequencyLinesBtn}
                                                handleClickRemoveAnnotatedFreqBtn={handleClickRemoveAnnotatedFreqBtn}
                                                numFreqLinesToAnnotate={numFreqLinesToAnnotate}
                                                globalHopLength={globalHopLength}
                                                globalSamplingRate={globalSamplingRate}
                                            />
                                        }
                                    </Box>
                                    <Box display="flex" flexDirection="column">
                                        {/* Area B */}
                                        <Box
                                        width={`${specYAxisWidth}px`}
                                        height={`${WAVEFORM_CVS_HEIGHT}px`}
                                        border={0}
                                        display={ displayWaveform? "flex":"none"} 
                                        >
                                                <div 
                                                    className={audioArray ? 'waveform-buttons' : 'hidden'}
                                                >
                                                    <IconButton style={freqBtn} onClick={waveformZoomIn}>
                                                        <ZoomInIcon style={icon}/>
                                                    </IconButton>
                                                    <IconButton style={freqBtn} onClick={waveformZoomOut}>
                                                        <ZoomOutIcon style={icon}/>
                                                    </IconButton>
                                                </div>
                                        </Box>
                                        {/* Area D */}
                                        <Box
                                        width={`${specYAxisWidth}px`}
                                        height={`${specCanvasHeight}px`}
                                        border={0}
                                        style={{"marginTop":"-20px"}}
                                        >
                                            <canvas
                                                className={showWaveform ? 'frequencies-canvas' : 'frequencies-canvas-small'}
                                                ref={frequenciesCanvasRef}
                                                width={specYAxisWidth}
                                                height={specCanvasHeight+20} //{showWaveform ? FREQ_CVS_HEIGHT : specCanvasHeight }
                                                // style={{"paddingTop":"50px"}}
                                            />
                                        </Box>
                                    </Box>
                                </Box>
                                {/* Area F */}
                                <Box
                                    width={`${TRACK_SIDEBAR_WIDTH}px`}
                                    height={showLabelAndIndividualsCanvas?"50px":"0px"}
                                    border={0}
                                    sx={{paddingLeft:"0px"}}
                                >
                                    <canvas
                                        className={showLabelAndIndividualsCanvas ? 'individuals-canvas' : 'hidden'}
                                        ref={individualsCanvasRef}
                                        width={TRACK_SIDEBAR_WIDTH}
                                        height={numberOfIndividuals * HEIGHT_BETWEEN_INDIVIDUAL_LINES }
                                        onMouseMove={handleIndividualCanvasMouseMove}
                                        onMouseLeave={handleIndividualCanvasMouseLeave}
                                    />
                                    {
                                        clusternamesAnchorOrigin && selectedSpeciesId !== null && selectedIndividualId !== null ? (
                                        createPortal(
                                            <Box sx={{maxWidth:"300px", 
                                                // height:"100px",
                                                // overflowY:"auto", 
                                                backgroundColor:"#21303f",
                                                position:"fixed",
                                                left:`${clusternamesAnchorOrigin.x}px`,
                                                bottom:`${clusternamesAnchorOrigin.y}px`,
                                                zIndex:100
                                            }} 
                                            onMouseMove={handleClusterNameListMouseMove}
                                            onMouseLeave={handleClusterNameListMouseLeave}
                                            >
                                                {
                                                    speciesArray.find((species)=> species.id === selectedSpeciesId ).clusternames.map(
                                                        (clustername, index)=>{
                                                            return <div key={index} className="hover-button"
                                                                        style={{width:"200px", height:"30px", overflow: "hidden",
                                                                            textOverflow: "ellipsis",
                                                                            whiteSpace: "nowrap",
                                                                            textAlign:"left",
                                                                            fontSize:"12pt",
                                                                            fontWeight: clustername.isActive?700:500,
                                                                            display:"flex",
                                                                            flexDirection:"row",
                                                                            margin:"5px",
                                                                        }}
                                                                        onClick={()=>{handleClickClustername(selectedSpeciesId, selectedIndividualId, clustername);
                                                                                      setClusternamesAnchorOrigin(null);
                                                                                      setSelectedSpeciesId( null );
                                                                                      setSelectedIndividualId( null );
                                                                                      setSelectedIndividualGlobalIndex( null );
                                                                         }}
                                                                    >
                                                                        <div style={{width:"5px", height:"100%", backgroundColor:`${clustername.color}`, marginRight:"10px",
                                                                                    display:"flex", flexShrink:0,
                                                                                }}></div>
                                                                        {clustername.name}
                                                                    </div>
                                                        }
                                                    )

                                                }
                                            </Box>
                                            ,
                                            document.body
                                        )
                                        ) : null
                                    }
                                </Box>
                            </Box>
                            {/* Box_right */}
                            <Box 
                                onMouseLeave={handleMouseLeaveCanvases}
                                display="flex" flexDirection="column" flex="1">
                                {/* Area C*/}
                                <Box height={`${WAVEFORM_CVS_HEIGHT}px`} border={0} >
                                        <div className='waveform-spec-labels-canvases-container' >
                                            <canvas
                                                    className={showWaveform ? 'waveform-canvas' : 'hidden'}
                                                    ref={waveformCanvasRef}
                                                    width={canvasWidth}
                                                    height={WAVEFORM_CVS_HEIGHT}
                                                    onMouseDown={handleLMBDown}
                                                    onMouseUp={handleMouseUp}
                                                    onContextMenu={handleRightClick}
                                                    onMouseMove={handleMouseMove}
                                                />
                                            {/* Overlay canvas for the waveform */}
                                            <canvas
                                                className="waveform-overlay-canvas"
                                                ref={waveformOverlayCanvasRef}
                                                width={canvasWidth}
                                                height={WAVEFORM_CVS_HEIGHT}
                                                style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} // Pass-through style
                                            />
                                        </div>
                                </Box>
                                {/* Area E */}
                                <Box
                                        height={`${specCanvasHeight}px`}
                                        border={0}
                                        flex="1"
                                        >
                                            <div  className='waveform-spec-labels-canvases-container'>
                                                <canvas
                                                    className='spec-canvas'
                                                    ref={specCanvasRef}
                                                    width={canvasWidth}
                                                    height={specCanvasHeight}
                                                    onMouseDown={handleLMBDown}
                                                    onMouseUp={handleMouseUp}
                                                    onContextMenu={handleRightClick}
                                                    onMouseMove={handleMouseMove}
                                                />
                                            <canvas
                                                className="spec-overlay-canvas"
                                                ref={specOverlayCanvasRef}
                                                width={canvasWidth}
                                                height={specCanvasHeight}
                                                style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} // Pass-through style
                                            />
                                            </div>
                                </Box>
                                {/* Area G */}
                                <Box
                                        flex="1"
                                        height={showLabelAndIndividualsCanvas?`${numberOfIndividuals * HEIGHT_BETWEEN_INDIVIDUAL_LINES}px`:"0px"}
                                        border={0}
                                    >
                                        <div className='waveform-spec-labels-canvases-container'>
                                                <canvas
                                                    className={showLabelAndIndividualsCanvas ? 'label-canvas' : 'hidden'}
                                                    ref={labelCanvasRef}
                                                    width={canvasWidth}
                                                    height={numberOfIndividuals * HEIGHT_BETWEEN_INDIVIDUAL_LINES}
                                                    onMouseDown={handleLMBDown}
                                                    onMouseUp={handleMouseUp}
                                                    onContextMenu={handleRightClick}
                                                    onMouseMove={handleMouseMove}
                                                />
                                                <canvas
                                                    className="label-overlay-canvas"
                                                    ref={labelOverlayCanvasRef}
                                                    width={canvasWidth}
                                                    height={numberOfIndividuals * HEIGHT_BETWEEN_INDIVIDUAL_LINES}
                                                    style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} // Pass-through style
                                                />

                                                {spectrogramIsLoading || whisperSegIsLoading ?
                                                    <Box sx={{width: '100%'}}><LinearProgress/></Box> : ''}
                                        </div>
                                </Box>
                            </Box>
                        </Box>

                    </Box>

                </div>

            }
        </div>
    )
}

export default Track;