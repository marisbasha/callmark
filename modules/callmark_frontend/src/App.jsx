// React
import React, {useCallback, useEffect, useRef, useState} from 'react'

// External dependencies
import axios from "axios";
import {nanoid} from "nanoid";
import {toast, ToastContainer} from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Tooltip from '@mui/material/Tooltip';
import {Box} from '@mui/material';
import IconButton from '@mui/material/IconButton';
import AddBoxIcon from '@mui/icons-material/AddBox';
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import DoneAllIcon from '@mui/icons-material/DoneAll';
import SettingsIcon from '@mui/icons-material/Settings';
import FastForwardIcon from '@mui/icons-material/FastForward';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import DisplaySettingsIcon from '@mui/icons-material/DisplaySettings';

// Internal dependencies
import Export from "./Export.jsx";
import ImportCSV from "./ImportCSV.jsx";
import Track from "./Track.jsx";
import GlobalConfig from "./GlobalConfig.jsx";
import SpeciesMenu from "./SpeciesMenu.jsx";
import LoadingCircle from './LoadingCircle.jsx';
import {useOpenWindowsContext} from './OpenWindowsContext.jsx';
import TimeAxis from './TimeAxis';
import ViewPort from './ViewPort';
import Banner from "./Banner.jsx";
import ZipImport from "./ZipImport.jsx";
import ZipExport from "./ZipExport.jsx";
import useTimeSynchronization from './useTimeSynchronization';
import {combineChunks, uploadFileInChunks, binsToExportTime} from "./utils.js";
import emitter from './eventEmitter';

import {
    ANNOTATED_AREA,
    ANNOTATED_AREA_CLUSTERNAME,
    ANNOTATED_AREA_COLOR,
    ANNOTATED_AREA_INDIVIDUAL_FULLY_ANNOTATED,
    ANNOTATED_AREA_INDIVIDUAL_TRAIN_WHISPERSEG,
    Clustername,
    createSpeciesFromImportedLabels,
    DEFAULT_UNKNOWN_CLUSTERNAME_COLOR,
    Individual,
    Species,
    UNKNOWN_CLUSTERNAME,
    UNKNOWN_INDIVIDUAL,
    UNKNOWN_SPECIES,
} from './species.js'
import {globalControlsBtn, globalControlsBtnDisabled, icon, iconBtn, iconBtnDisabled} from "./buttonStyles.js"


// Global Variables
const SCROLL_STEP_RATIO = 0.2
const TRACK_SIDEBAR_WIDTH = 350
const TRACK_PADDING_RIGHT = 15
const INITIAL_LABEL_PANNEL_HEIGHT = 100
const VIEWPORT_TIME_AXIS_HEIGHT = 105
const WINDOW_PADDING_BOTTOM = 15
const UNCERTAINTYSUFFIX = "<|--UNCERTAIN--|>"
const MAX_FILE_SIZE = 10000 * 1024 * 1024;  // max file size: 10 GB

function App() {
    // Tracks
    const [tracks, setTracks] = useState([
        {
            trackID: nanoid(),
            trackIndex: 0,
            channelIndex: null,
            visible: true,
            audioID: null,
            filename: null,
            audioDuration: null,
            frequencies: null,
            spectrogram: null,
        }
    ])
    const tracksRef = useRef(tracks);

    const [disableOnsetOffsetEdit, setDisableOnsetOffsetEdit] = useState(false);

    // Global Layout
    const [canvasWidth, setCanvasWidth] = useState(window.innerWidth - TRACK_SIDEBAR_WIDTH - TRACK_PADDING_RIGHT)
    const resizeWindowRef = useRef(null)
    const [isAdjustingLabelHeight, setIsAdjustingLabelHeight] = useState(false);
    const [labelPannelHeight, setLabelPannelHeight] = useState(INITIAL_LABEL_PANNEL_HEIGHT);
    const [prevLabelPannelHeight, setPrevLabelPannelHeight] = useState(INITIAL_LABEL_PANNEL_HEIGHT);
    const [allTracksHeight, setAllTracksHeight] = useState( Math.max(100, window.innerHeight - INITIAL_LABEL_PANNEL_HEIGHT - VIEWPORT_TIME_AXIS_HEIGHT - WINDOW_PADDING_BOTTOM) );
    const [startDragBarY, setStartDragBarY]  = useState( null );
    const [labelPanelBarYShift, setLabelPanelBarYShift] = useState( 0 );
    const speciesMenuRef = useRef(null);
    const [menuHeight, setMenuHeight] = useState(0);

    // Audio Sync
    const [globalAudioDuration, setGlobalAudioDuration] = useState(null)
    const [globalClipDuration, setGlobalClipDuration] = useState(null)
    const [currentStartTime, setCurrentStartTime] = useState(0)
    const [currentEndTime, setCurrentEndTime] = useState(0)
    const [maxScrollTime, setMaxScrollTime] = useState(0)
    const [scrollStep, setScrollStep] = useState(0)
    const [globalHopLength, setGlobalHopLength] = useState('')
    const [globalNumSpecColumns, setGlobalNumSpecColumns] = useState('')
    const [globalSamplingRate, setGlobalSamplingRate] = useState('')

    const [userGivenStartTime, setUserGivenStartTime] = useState(0)

    // Global Configurations
    const [defaultConfig, setDefaultConfig] = useState(null)
    const [showGlobalConfigWindow, setShowGlobalConfigWindow] = useState(false)

    // Parameter Control
    const [ disableKeyEvent, setDisableKeyEvent ] = useState(false);

    // Zip Import/Export
    const [projectData, setProjectData] = useState(null)

    // Labels Import/Export
    const [importedLabels, setImportedLabels] = useState(null)
    const [allLabels, setAllLabels] = useState([])
    const [exportRequest, setExportRequest] = useState(false)
    const [submitRequest, setSubmitRequest] = useState(false)
    const [zipExportRequest, setZipExportRequest] = useState(false)
    const [trackMetaObjectsList, setTrackMetaObjectsList] = useState([])

    // Strict Mode
    const [strictMode, setStrictMode] = useState(false)
    const [annotationInstance, setAnnotationInstance] = useState(null)
    const [userName, setUserName] = useState(null)
    const [hashID, setHashID] = useState(null)
    const [readOnlyMode, setReadOnlyMode] = useState(false) // Later default to false, for testing remain true
    // 17-Dev 2024: temporal solution for investigator mode
    const [strictDevMode, setStrictDevMode] = useState(true)
    const [dataSource, setDataSource] = useState(null)

    // Layout
    const [specCanvasHeight, setSpecCanvasHeight] = useState(350);
    const [showAllWaveforms, setShowAllWaveforms] = useState(true);
    const [showAllAnnotationCanvases, setShowAllAnnotationCanvases] = useState(true);

    // Spectrogram
    const [ specBrightness, setSpecBrightness ] = useState(1.0);
    const [ specContrast, setSpecContrast ] = useState(1.0);
    const [ sliderSpecBrightnessValue, setSliderSpecBrightnessValue] = useState(1);
    const [ sliderSpecContrastValue, setSliderSpecContrastValue] = useState(1);
    const [ colorMap, setColorMap] = useState('inferno');

    // Annotation
    const [isMarkingAnnotationArea, setIsMarkingAnnotationArea] = useState(false);
    const [allowAnnotationOverlap, setAllowAnnotationOverlap] = useState(true)

    // Get UTC time from reliable time provider
    const { getCurrentUTCTime, getUTCTimestamp, isLoading, error } = useTimeSynchronization();

    // Get device info
    // Browser and OS info through navigator
    const getBrowserInfo = () => {
        const userAgent = navigator.userAgent;
        const platform = navigator.platform;
        const language = navigator.language;
        const vendor = navigator.vendor;
        const cookieEnabled = navigator.cookieEnabled;
        const online = navigator.onLine;
        
        return {
        userAgent,
        platform,
        language,
        vendor,
        cookieEnabled,
        online
        };
    };
  
    // Screen properties
    const getScreenInfo = () => {
        return {
        width: window.screen.width,
        height: window.screen.height,
        colorDepth: window.screen.colorDepth,
        pixelDepth: window.screen.pixelDepth,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight,
        orientation: window.screen.orientation.type
        };
    };

    // All Device properties
    const getDeviceInfo = () => {
        const browserInfo = getBrowserInfo();
        const screenInfo = getScreenInfo();
        return {
            screenWidth: screenInfo.width,
            screenHeight: screenInfo.height
        };
    };


    // Species Array
    const [speciesArray, setSpeciesArray] = useState(() => {
        const annotatedAreaIndividual = new Individual(nanoid(), ANNOTATED_AREA_INDIVIDUAL_TRAIN_WHISPERSEG)
        const annotatedAreaClustername = new Clustername(nanoid(), ANNOTATED_AREA_CLUSTERNAME, ANNOTATED_AREA_COLOR)
        const annotatedAreaIndividualFullyAnnotated = new Individual(nanoid(), ANNOTATED_AREA_INDIVIDUAL_FULLY_ANNOTATED)
        
        annotatedAreaIndividual.isActive = false
        annotatedAreaClustername.isActive = false
        annotatedAreaIndividualFullyAnnotated.isActive = false
        const annotatedAreaLabel = new Species(nanoid(), ANNOTATED_AREA, [annotatedAreaIndividual, annotatedAreaIndividualFullyAnnotated],  [annotatedAreaClustername])

        const newIndividual = new Individual(nanoid(), UNKNOWN_INDIVIDUAL)
        const newClustername = new Clustername(nanoid(), UNKNOWN_CLUSTERNAME, DEFAULT_UNKNOWN_CLUSTERNAME_COLOR)
        const newSpecies = new Species(nanoid(),UNKNOWN_SPECIES, [newIndividual], [newClustername] )

        return [newSpecies, annotatedAreaLabel]
    })
    const [deletedItemID, setDeletedItemID] = useState(null)

    // Audio upload
    const [filesUploading, setFilesUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // WhisperSeg
    const [tokenInference, setTokenInference] = useState('')
    const [tokenFinetune, setTokenFinetune] = useState('')
    const [authToken, setAuthToken] = useState('')
    const [isAuthenticated, setIsAuthenticated] = useState(false)

    // Keyboard Interactions
    // Note: Arrow key handling is now done in Track.jsx via event emitters

    // Keep track of Open Windows
    const { anyWindowsOpen } = useOpenWindowsContext()

    // mouse click time array
    const annotationTimestamps = useRef([])
    const onZoomInRef = useRef(null)
    const onZoomOutRef = useRef(null)
    const labelCenterTimeRef = useRef(null)

    /* ++++++++++++++++++ Pass methods ++++++++++++++++++ */

    function passClipDurationToApp( newClipDuration ){
        setGlobalClipDuration( newClipDuration )
    }

    function passCurrentStartTimeToApp( newCurrentStartTime ){
        setCurrentStartTime( newCurrentStartTime )
    }

    function passCurrentEndTimeToApp( newCurrentEndTime ){
        setCurrentEndTime( newCurrentEndTime )
    }

    function passMaxScrollTimeToApp( newMaxScrollTime ){
        setMaxScrollTime( newMaxScrollTime )
    }

    function passScrollStepToApp( newScrollStep ){
        setScrollStep( newScrollStep )
    }

    function passSpeciesArrayToApp ( newSpeciesArray ){
        setSpeciesArray( newSpeciesArray )
    }

    function passGlobalNumSpecColumnsToApp( newNumSpecColumns ){
        setGlobalNumSpecColumns( newNumSpecColumns )
    }

    function passGlobalSamplingRateToApp( newSamplingRate ){
        setGlobalSamplingRate( newSamplingRate )
    }

    function passShowGlobalConfigWindowToApp ( boolean ){
        setShowGlobalConfigWindow( boolean )
    }

    function passDeletedItemIDToApp( newDeletedItemID ){
        setDeletedItemID( newDeletedItemID )
    }

    function addLabelsToApp( newLabels ) {
        setAllLabels( previousLabels => [...previousLabels, ...newLabels] )
    }

    function deleteAllLabelsInApp() {
        setAllLabels( [] )
    }

    function passExportRequestToApp( boolean ){
        setExportRequest( boolean )
    }

    function passZipExportRequestToApp( boolean ){
        setZipExportRequest( boolean )
    }

    function passImportedLabelsToApp( newImportedLabels ){
        setImportedLabels( newImportedLabels )
    }

    function passFilesUploadingToApp( boolean ){
        setFilesUploading( boolean )
    }

    const passTokenInferenceToWhisperSeg = ( newToken ) => {
        setTokenInference( newToken )
    }

    const passTokenFinetuneToWhisperSeg = ( newToken ) => {
        setTokenFinetune( newToken )
    }

    const passProjectDataToApp = (newProjectData) => {
        setProjectData( newProjectData )
    }

    const passTrackMetaObjToApp = (newTrackMetaData) => {
        setTrackMetaObjectsList( prevState => [ ...prevState, newTrackMetaData ])
    }

    const removeAllTrackMetaObjectsInApp = () => {
        setTrackMetaObjectsList([])
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

    /* ++++++++++++++++++ Audio Tracks ++++++++++++++++++ */
    
    function addTrack(){
        const updatedTracks = tracks.map(track => track)
        const newIndex = updatedTracks.length
        updatedTracks.push(
            {
                trackID: nanoid(),
                trackIndex: newIndex,
                channelIndex: null,
                visible: true,
                audioID: null,
                filename: null,
                audioDuration: null,
                frequencies: null,
                spectrogram: null
            }
        )

        setTracks(updatedTracks)
    }

    function removeTrackInApp( trackID ){
        let updatedTracks = tracks.filter(track => track.trackID !== trackID)
        updatedTracks = updatedTracks.map( (track, index) => {
            return {
                ...track,
                trackIndex: index
            }
        })
        setTracks(updatedTracks)

        setDefaultConfig(null)
    }

    function toggleTrackVisibility( trackID ){
        const updatedTracks = tracks.map( track => {
            if (track.trackID === trackID){
                return {
                    ...track,
                    visible: !track.visible
                }
            }
            return track
        })

        setTracks(updatedTracks)
    }

    function moveTrackUp( clickedTrackID ){
        const clickedTrack = tracks.find(track => track.trackID === clickedTrackID)

        if (clickedTrack.trackIndex < 1) return

        const newIndexClickedTrack = clickedTrack.trackIndex - 1

        // Remove clicked track from tracks Array
        let updatedTracks = tracks.filter(track => track.trackID !== clickedTrackID)

        // Reinsert the clicked track at the new index
        updatedTracks.splice(newIndexClickedTrack, 0, clickedTrack);

        // Update trackIndex for all tracks
        updatedTracks = updatedTracks.map( (track, index) => {
            return {
                ...track,
                trackIndex: index,
            }
        })

        setTracks(updatedTracks)

    }

    function moveTrackDown( clickedTrackID ){
        const clickedTrack = tracks.find(track => track.trackID === clickedTrackID)

        if (clickedTrack.trackIndex >= tracks.length - 1) return

        const newIndexClickedTrack = clickedTrack.trackIndex + 1

        // Remove clicked track from tracks Array
        let updatedTracks = tracks.filter(track => track.trackID !== clickedTrackID)

        // Reinsert the clicked track at the new index
        updatedTracks.splice(newIndexClickedTrack, 0, clickedTrack);

        // Update trackIndex for all tracks
        updatedTracks = updatedTracks.map( (track, index) => {
            return {
                ...track,
                trackIndex: index,
            }
        })

        setTracks(updatedTracks)
    }

    function renderTracks() {

        return tracks.map((track) => {
            return (
                <Track
                    key={track.trackID}
                    trackID={track.trackID}
                    speciesArray={speciesArray}
                    deletedItemID={deletedItemID}
                    globalAudioDuration={globalAudioDuration}
                    globalClipDuration={globalClipDuration}
                    currentStartTime={currentStartTime}
                    currentEndTime={currentEndTime}
                    setCurrentStartTime={setCurrentStartTime}
                    setCurrentEndTime={setCurrentEndTime}
                    removeTrackInApp={removeTrackInApp}
                    globalHopLength={globalHopLength}
                    globalNumSpecColumns={globalNumSpecColumns}
                    globalSamplingRate={globalSamplingRate}
                    updateClipDurationAndTimes={updateClipDurationAndTimes}
                    strictMode={strictMode}
                    strictDevMode={strictDevMode}
                    importedLabels={importedLabels}
                    handleUploadResponse={handleUploadResponse}
                    handleMultipleLocalFileUploads={handleMultipleLocalFileUploads}
                    trackData={track}
                    passFilesUploadingToApp={passFilesUploadingToApp}
                    addLabelsToApp={addLabelsToApp}
                    exportRequest={exportRequest}
                    submitRequest={submitRequest}
                    zipExportRequest={zipExportRequest}
                    toggleTrackVisibility={toggleTrackVisibility}
                    moveTrackUp={moveTrackUp}
                    moveTrackDown={moveTrackDown}
                    lastTrackIndex={tracks[tracks.length - 1].trackIndex}
                    passSpeciesArrayToApp={passSpeciesArrayToApp}
                    tokenInference={tokenInference}
                    tokenFinetune={tokenFinetune}
                    passTokenInferenceToWhisperSeg={passTokenInferenceToWhisperSeg}
                    passTokenFinetuneToWhisperSeg={passTokenFinetuneToWhisperSeg}
                    authToken={authToken}
                    setAuthToken={setAuthToken}
                    isAuthenticated={isAuthenticated}
                    setIsAuthenticated={setIsAuthenticated}
                    globalSpecCanvasHeight={specCanvasHeight}
                    showAllWaveforms={showAllWaveforms}
                    showAllAnnotationCanvases={showAllAnnotationCanvases}
                    globalSpecBrightness={specBrightness}
                    globalSpecContrast={specContrast}
                    globalColorMap={colorMap}
                    annotationTimestamps={annotationTimestamps}
                    getCurrentUTCTime={getCurrentUTCTime}
                    getDeviceInfo={getDeviceInfo}
                    hashID={hashID}
                    canvasWidth={canvasWidth}
                    TRACK_SIDEBAR_WIDTH={TRACK_SIDEBAR_WIDTH}
                    DEFAULT_UNKNOWN_CLUSTERNAME_COLOR={DEFAULT_UNKNOWN_CLUSTERNAME_COLOR}
                    disableKeyEvent={disableKeyEvent}
                    setDisableKeyEvent={setDisableKeyEvent}
                    userGivenStartTime={userGivenStartTime}
                    disableOnsetOffsetEdit={disableOnsetOffsetEdit}
                    setUploadProgress={setUploadProgress}
                    MAX_FILE_SIZE={MAX_FILE_SIZE}
                    projectData={projectData}
                    passTrackMetaObjToApp={passTrackMetaObjToApp}
                    allowAnnotationOverlap={allowAnnotationOverlap}
                />
            )
        })
    }


    /* ++++++++++++++++++ Controls ++++++++++++++++++ */

    function onZoomIn(){
        const centerTime = labelCenterTimeRef.current
        const newHopLength =  Math.max( Math.floor(globalHopLength / 2), 1)
        const newDuration = newHopLength / globalSamplingRate * globalNumSpecColumns
        const newMaxScrollTime = Math.max(globalAudioDuration - newDuration, 0)
        let newStartTime
        if (centerTime != null) {
            newStartTime = Math.max(0, Math.min(newMaxScrollTime, centerTime - newDuration / 2))
        } else {
            newStartTime = Math.min( newMaxScrollTime, currentStartTime)
        }
        const newEndTime = newStartTime + newDuration
        updateClipDurationAndTimes(newHopLength, newDuration, newMaxScrollTime, newStartTime, newEndTime)
        emitter.emit('resetPlayhead', newStartTime)
    }

    function onZoomOut(){
        const centerTime = labelCenterTimeRef.current
        const currentMaxHopLength = Math.floor( (globalAudioDuration * globalSamplingRate) / globalNumSpecColumns )
        const newHopLength = globalHopLength * 2 / globalSamplingRate * globalNumSpecColumns > globalAudioDuration? currentMaxHopLength : globalHopLength * 2
        const newDuration = newHopLength / globalSamplingRate * globalNumSpecColumns
        const newMaxScrollTime = Math.max(globalAudioDuration - newDuration, 0)
        let newStartTime
        if (centerTime != null) {
            newStartTime = Math.max(0, Math.min(newMaxScrollTime, centerTime - newDuration / 2))
        } else {
            newStartTime = Math.min( newMaxScrollTime, currentStartTime)
        }
        const newEndTime = newStartTime + newDuration
        updateClipDurationAndTimes(newHopLength, newDuration, newMaxScrollTime, newStartTime , newEndTime)
        emitter.emit('resetPlayhead', newStartTime)
    }

    onZoomInRef.current = onZoomIn
    onZoomOutRef.current = onZoomOut

    const leftScroll = useCallback(() => {
        let newStartTime;
        setCurrentStartTime(prevStartTime => {
            const newTime = Math.max(prevStartTime - scrollStep, 0)
            // Align to sample boundaries to match backend's int(start_time * sr)
            const sampleIndex = Math.floor(newTime * globalSamplingRate)
            newStartTime = sampleIndex / globalSamplingRate
            return newStartTime
        })
        setCurrentEndTime(prevEndTime => {
            const newTime = Math.max(prevEndTime - scrollStep, globalClipDuration)
            const sampleIndex = Math.floor(newTime * globalSamplingRate)
            return sampleIndex / globalSamplingRate
        })
        emitter.emit('resetPlayhead', newStartTime)
    }, [scrollStep, globalClipDuration, globalSamplingRate])

    const rightScroll = useCallback(() => {
        let newStartTime;
        setCurrentStartTime(prevStartTime => {
            const newTime = Math.min(prevStartTime + scrollStep, maxScrollTime)
            // Align to sample boundaries to match backend's int(start_time * sr)
            const sampleIndex = Math.floor(newTime * globalSamplingRate)
            newStartTime = sampleIndex / globalSamplingRate
            return newStartTime
        })
        setCurrentEndTime(prevEndTime => {
            const newTime = Math.min(prevEndTime + scrollStep, globalAudioDuration)
            const sampleIndex = Math.floor(newTime * globalSamplingRate)
            return sampleIndex / globalSamplingRate
        })
        emitter.emit('resetPlayhead', newStartTime)
    }, [scrollStep, maxScrollTime, globalAudioDuration, globalSamplingRate])

    const fastLeftScroll = () => {
        let newStartTime;
        setCurrentStartTime(prevStartTime => {
            const newTime = Math.max(prevStartTime - globalClipDuration * 0.9, 0)
            // Align to sample boundaries to match backend's int(start_time * sr)
            const sampleIndex = Math.floor(newTime * globalSamplingRate)
            newStartTime = sampleIndex / globalSamplingRate
            return newStartTime
        })
        setCurrentEndTime(prevEndTime => {
            const newTime = Math.max(prevEndTime - globalClipDuration * 0.9, globalClipDuration)
            const sampleIndex = Math.floor(newTime * globalSamplingRate)
            return sampleIndex / globalSamplingRate
        })
        emitter.emit('resetPlayhead', newStartTime)
    };

    const fastRightScroll = () => {
        let newStartTime;
        setCurrentStartTime(prevStartTime => {
            const newTime = Math.min(prevStartTime + globalClipDuration * 0.9, maxScrollTime)
            // Align to sample boundaries to match backend's int(start_time * sr)
            const sampleIndex = Math.floor(newTime * globalSamplingRate)
            newStartTime = sampleIndex / globalSamplingRate
            return newStartTime
        })
        setCurrentEndTime(prevEndTime => {
            const newTime = Math.min(prevEndTime + globalClipDuration * 0.9, globalAudioDuration)
            const sampleIndex = Math.floor(newTime * globalSamplingRate)
            return sampleIndex / globalSamplingRate
        })
        emitter.emit('resetPlayhead', newStartTime)
    };

    function updateClipDurationAndTimes(newHopLength, newDuration, newMaxScrollTime, newStartTime, newEndTime){
        setGlobalHopLength(newHopLength)
        setGlobalClipDuration(newDuration)
        setMaxScrollTime(newMaxScrollTime)
        setCurrentStartTime( newStartTime )
        setCurrentEndTime(newEndTime)
        setScrollStep( newDuration * SCROLL_STEP_RATIO )
    }

    function handleClickSubmitBtn(){
        setSubmitRequest(true)
    }

    async function submitAnnotationTimestamps(){ 
        const path = import.meta.env.VITE_BACKEND_SERVICE_ADDRESS+`/annotation/annotation-time/`
        const requestParameters = {
            log: annotationTimestamps.current
        }
        const headers = {
            'Content-Type': 'application/json',
            'accept': 'application/json'
        }
        try {
            await axios.post(path, requestParameters, { headers } )
            // refresh the action list after successful submission
            annotationTimestamps.current = []
        } catch (error) {
            // toast.error('Something went wrong trying to submit the annotation time. Check the console for more information.')
        }
    }

    async function submitAllAnnotations(){

        const path = import.meta.env.VITE_BACKEND_SERVICE_ADDRESS+`/post-annotations/${hashID}`

        let newLabelsArray = allLabels.filter( label => ( label.onsetBin>=0 && label.offsetBin >= 0 ) )

        // Check if user set annotated area
        if (!newLabelsArray.some(label => label.species === ANNOTATED_AREA && label.individual === ANNOTATED_AREA_INDIVIDUAL_FULLY_ANNOTATED)) {
            toast.error('Provide at least one annotated area before submitting your annotations.')
            return
        }
        
        // Assign each label it's correct trackIndex
        newLabelsArray = newLabelsArray.map( label => {
            const correctChannelIndex = tracks.find( track => track.trackID === label.trackID).channelIndex
            return {
                ...label,
                channelIndex: correctChannelIndex
            }
        })

        const timeStamp =  new Date().toISOString().slice(0, 19).replace('T', ' ')
          
        // Only keep properties that are relevant for the backend
        const modifiedLabels = newLabelsArray.map(labelObj => {
            // update species, individual and clustername if uncertainty is specified
            const newSpeciesName = labelObj.uncertainSpeices? labelObj.species + UNCERTAINTYSUFFIX : labelObj.species
            const newIndividualName = labelObj.uncertainIndividual? labelObj.individual + UNCERTAINTYSUFFIX : labelObj.individual
            const newClusterName = labelObj.uncertainClustername? labelObj.clustername + UNCERTAINTYSUFFIX : labelObj.clustername

            const exportTime = binsToExportTime(labelObj.onsetBin, labelObj.offsetBin, labelObj.configSnapshot.nfft, labelObj.configSnapshot.hopLength, labelObj.configSnapshot.samplingRate)
            return {
                // convert bins to corrected time for the backend
                onset: exportTime.onset,
                offset: exportTime.offset,
                minFrequency: labelObj.minFreq !== ""? labelObj.minFreq : -1 ,
                maxFrequency: labelObj.maxFreq !== ""? labelObj.maxFreq : -1 ,
                species: newSpeciesName,
                individual: newIndividualName,
                clustername: newClusterName,
                filename: labelObj.filename,
                channelIndex: labelObj.channelIndex,
                username: userName,
                timestamp: timeStamp,
                configSnapshot: labelObj.configAtCreation
            }
        })

        if (modifiedLabels.length === 0){
            if (tracks.length === 0){
                toast.error('There are currently no audio uploaded. Upload audio and try again.')
                return
            }
            modifiedLabels.push(
                {
                    onset: -1,
                    offset: -1,
                    minFrequency: -1,
                    maxFrequency: -1,
                    species: "Unknown",
                    individual: "Unknown",
                    clustername: "Unknown",
                    filename: tracks[0].filename,
                    channelIndex: 0,
                    username: userName,
                    timestamp: timeStamp,
                    configSnapshot: {}
                }
            )
        }

        const requestParameters = {
            annotations: modifiedLabels,
            data_source: dataSource
        }

        const headers = {
            'Content-Type': 'application/json',
            'accept': 'application/json'
        }

        try {
            await axios.post(path, requestParameters, { headers } )
            toast.success('Annotations submitted successfully!')
        } catch (error) {
            toast.error('Something went wrong trying to submit the annotations. Please contact the admin team.')
        }

    }

    /* ++++++++++++++++++ Audio File Upload ++++++++++++++++++ */

    async function uploadFileByURL(audioPayload, onProgress) {
        const path = import.meta.env.VITE_BACKEND_SERVICE_ADDRESS + 'upload-by-url-stream'
        const requestParameters = {
            audio_url: audioPayload.url,
            hop_length: audioPayload.hop_length,
            num_spec_columns: audioPayload.num_spec_columns,
            sampling_rate: audioPayload.sampling_rate,
            spec_cal_method: audioPayload.spec_cal_method,
            n_fft: audioPayload.nfft,
            bins_per_octave: audioPayload.bins_per_octave,
            min_frequency: audioPayload.f_low,
            max_frequency: audioPayload.f_high
        }

        try {
            const response = await fetch(path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestParameters)
            })

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let result = null
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                // SSE events are separated by double newlines
                const events = buffer.split('\n\n')
                // Keep the last part as it may be incomplete
                buffer = events.pop()

                for (const event of events) {
                    const lines = event.split('\n')
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6))
                                if (data.progress !== undefined && onProgress) {
                                    onProgress(data.progress)
                                }
                                if (data.stage === 'done' && data.result) {
                                    result = { data: data.result }
                                }
                                if (data.stage === 'error') {
                                    throw new Error(data.error || 'Unknown server error')
                                }
                            } catch (e) {
                                if (e.message && !e.message.includes('JSON')) {
                                    throw e
                                }
                            }
                        }
                    }
                }
            }

            return result
        } catch (error) {
            console.error("Error uploading file:", error)
            setFilesUploading(false)
            toast.error('Error while uploading. Please contact the admin team.')
            return null
        }
    }

    async function processAudioFilesSequentially(audioFilesArray){
        const loadingProgressStep = 100 / audioFilesArray.length;

        setUploadProgress(1)

        const allResponses = []
        let completedFiles = 0

        for (let audioPayload of audioFilesArray) {
            // temporal solution: overwrite the spec_cal_method from log-mel to linear
            if ( audioPayload.spec_cal_method === "log-mel" ){
                audioPayload.spec_cal_method = "linear"
            }

            const baseProgress = completedFiles * loadingProgressStep

            // Real progress from server via SSE
            const newResponse = await uploadFileByURL(audioPayload, (serverProgress) => {
                const totalProgress = baseProgress + (serverProgress / 100) * loadingProgressStep
                setUploadProgress(Math.max(1, totalProgress))
            })

            if (newResponse) {
                allResponses.push({...newResponse, filename: audioPayload.filename})
            }

            completedFiles++
            setUploadProgress(completedFiles * loadingProgressStep)
        }

        if (allResponses.length > 0) {
            handleURLUploadResponses(allResponses)
        } else {
            toast.error("All file uploads failed. Please try again.")
            setFilesUploading(false)
        }
    }

    const handleUploadResponse = (newResponse, filename, clickedTrackID) => {
        const newChannels = newResponse.data.channels
        let channelIndex = 0

        let updatedTracks = tracks.reduce((acc, track) => {
            // Skip tracks before the clicked track (=return them unchanged)
            if (track.trackID !== clickedTrackID) {
                acc.push(track)
                return acc
            }

            // Update the clicked track with the first channel's data
            acc.push({
                ...track,
                channelIndex: channelIndex,
                audioID: newChannels[channelIndex].audio_id,
                filename: filename,
                audioDuration: newChannels[channelIndex].audio_duration,
                frequencies: newChannels[channelIndex].freqs,
                spectrogram: newChannels[channelIndex].spec,
            })
            channelIndex++

            // Create additional tracks for remaining channels
            while (channelIndex < newChannels.length) {
                acc.push({
                    trackID: nanoid(),
                    trackIndex: null,
                    channelIndex: channelIndex,
                    visible: true,
                    audioID: newChannels[channelIndex].audio_id,
                    filename: filename,
                    audioDuration: newChannels[channelIndex].audio_duration,
                    frequencies: newChannels[channelIndex].freqs,
                    spectrogram: newChannels[channelIndex].spec,
                })
                channelIndex++
            }

            return acc
        }, [])

        // Assign tracks the correct index
        updatedTracks = updatedTracks.map( (track, index) => {
            return {
                ...track,
                trackIndex: index,
            }
        })

        setTracks(updatedTracks)

        // Update Global Values
        const newConfigurations = newResponse.data.configurations
        updateGlobalValues(newConfigurations)
    }

    const handleMultipleLocalFileUploads = (allResponses, clickedTrackID) => {
        if (!allResponses || allResponses.length === 0) return

        // For single file, use the existing handler
        if (allResponses.length === 1) {
            const { response, filename } = allResponses[0]
            handleUploadResponse(response, filename, clickedTrackID)
            return
        }

        // For multiple files:
        // - Replace the clicked track with the first file's first channel
        // - Insert remaining channels/files after the clicked track
        const newTracksToInsert = []
        let firstTrackData = null

        for (let fileIndex = 0; fileIndex < allResponses.length; fileIndex++) {
            const uploadResult = allResponses[fileIndex]
            const { response, filename } = uploadResult
            const newChannels = response.data.channels
            const config = response.data.configurations

            // Create a track for each channel in the uploaded file
            for (let channelIndex = 0; channelIndex < newChannels.length; channelIndex++) {
                const channel = newChannels[channelIndex]
                const trackData = {
                    trackID: nanoid(),
                    trackIndex: null, // Will be set later
                    channelIndex: channelIndex,
                    visible: true,
                    audioID: channel.audio_id,
                    filename: filename,
                    audioDuration: channel.audio_duration,
                    frequencies: channel.freqs,
                    spectrogram: channel.spec,
                    specCalMethod: config.spec_cal_method,
                    nfft: config.n_fft,
                    binsPerOctave: config.bins_per_octave,
                    minFreq: config.min_frequency,
                    maxFreq: config.max_frequency
                }

                // First track replaces the clicked track (keep the trackID)
                if (fileIndex === 0 && channelIndex === 0) {
                    const clickedTrack = tracks.find(t => t.trackID === clickedTrackID)
                    firstTrackData = {
                        ...trackData,
                        trackID: clickedTrackID, // Keep the original track ID
                        trackIndex: clickedTrack?.trackIndex || 0
                    }
                } else {
                    // Remaining tracks are inserted after
                    newTracksToInsert.push(trackData)
                }
            }
        }

        // Build updated tracks array: replace clicked track and insert others after it
        let updatedTracks = []
        for (const track of tracks) {
            if (track.trackID === clickedTrackID) {
                // Replace the clicked track with the first file's data
                updatedTracks.push(firstTrackData)
                // Insert all remaining tracks after it
                updatedTracks = updatedTracks.concat(newTracksToInsert)
            } else {
                updatedTracks.push(track)
            }
        }

        // Assign correct indices
        updatedTracks = updatedTracks.map((track, index) => ({
            ...track,
            trackIndex: index
        }))

        setTracks(updatedTracks)

        // Update global values from the first response
        const newConfigurations = allResponses[0].response.data.configurations
        updateGlobalValues(newConfigurations)
    }

    const handleURLUploadResponses = (allResponses) => {
        let i = 0
        const allNewTracks = []

        for (const response of allResponses){
            const newChannels = response.data.channels
            const config = response.data.configurations
            let channelIndex = 0
            for (const channel of newChannels){
                allNewTracks.push({
                    trackID: nanoid(),
                    trackIndex: i,
                    channelIndex: channelIndex,
                    visible: true,
                    audioID: channel.audio_id,
                    filename: response.filename,
                    audioDuration: channel.audio_duration,
                    frequencies: channel.freqs,
                    spectrogram: channel.spec,
                    specCalMethod: config.spec_cal_method,
                    nfft: config.n_fft,
                    binsPerOctave: config.bins_per_octave,
                    minFreq: config.min_frequency,
                    maxFreq: config.max_frequency
                })
                channelIndex++
                i++
            }
        }

        setTracks(allNewTracks)

        // Update Global Values with the values of the first Response
        const newConfigurations = allResponses[0].data.configurations
        updateGlobalValues(newConfigurations)
    }

    const updateGlobalValues = (newConfigurations) => {
        const hopLength = newConfigurations.hop_length
        const numSpecColumns = newConfigurations.num_spec_columns
        const samplingRate = newConfigurations.sampling_rate

        const defaultConfig = {
            hop_length: hopLength,
            num_spec_columns: numSpecColumns,
            sampling_rate: samplingRate
        }

        setGlobalHopLength( hopLength )
        setGlobalNumSpecColumns( numSpecColumns )
        setGlobalSamplingRate( samplingRate )
        setDefaultConfig( defaultConfig )
    }


    async function processAudioFilesFromZipFolder (audioFilesArray){
        const loadingProgressStep = 100 / audioFilesArray.length;

        setFilesUploading(true)
        setUploadProgress(0)

        const allResponses = []
        let cumulativeProgress = 0

        for (let audioFile of audioFilesArray) {
            if (audioFile) {
                const newResponse = await streamUploadLocalFile(audioFile);
                if (newResponse) {
                    allResponses.push({...newResponse, filename: audioFile.name})
                }
            }

            cumulativeProgress += loadingProgressStep
            setUploadProgress(cumulativeProgress)
        }

        if (allResponses.length > 0) {
            handleURLUploadResponses(allResponses)
        } else {
            toast.error("All file uploads failed. Please try again.")
            setFilesUploading(false)
        }
    }

    const streamUploadLocalFile =  async( file ) => {
        if (!file) return;

        try {
            // Upload file in chunks
            const uniqueFileId = await uploadFileInChunks(file);
            // Request server to combine chunks
            await combineChunks(uniqueFileId, file.name);

            const formData = new FormData();
            formData.append('unique_file_id', uniqueFileId);
            formData.append('file_name', file.name);
            formData.append('spec_cal_method', 'linear');
            formData.append('n_fft', '1024');
            formData.append('bins_per_octave', '31');
            formData.append('min_frequency', '50');
            formData.append('max_frequency', '16000');
            formData.append('color_map', colorMap);
            // later pass specific track data here from config.json() such as spec_cal_method, nfft, minfreq etc.

            const path = import.meta.env.VITE_BACKEND_SERVICE_ADDRESS + '/upload_from_combined_chunks';
            const response = await axios.post(path, formData);

            return response

        } catch (error){
            console.error('Error stream upload local file:', error);
            toast.error( "File Uploading failed. Please retry or try smaller audio files."  )
        }
    }

    /* ++++++++++++++++++ Helper methods ++++++++++++++++++ */

    const extractLabels = (audioFilesArray) => {
        const allLabels = []
        for (let audioFile of audioFilesArray){
            for (const channelIndex in audioFile.labels.channels){
                let labels = audioFile.labels.channels[channelIndex]
                labels = labels.map( anno => { 
                    const uncertainSpeices = anno.species.endsWith( UNCERTAINTYSUFFIX )
                    const newSpeices = uncertainSpeices? anno.species.slice(0, -UNCERTAINTYSUFFIX.length ):anno.species
                    const uncertainIndividual = anno.individual.endsWith( UNCERTAINTYSUFFIX )
                    const newIndividual = uncertainIndividual? anno.individual.slice(0, -UNCERTAINTYSUFFIX.length ):anno.individual
                    const uncertainClustername = anno.clustername.endsWith( UNCERTAINTYSUFFIX )
                    const newClustername = uncertainClustername? anno.clustername.slice(0, -UNCERTAINTYSUFFIX.length ):anno.clustername
                    
                    return {...anno, 
                        filename: audioFile.filename, 
                        channelIndex: Number(channelIndex),
                        species:newSpeices,
                        individual:newIndividual,
                        clustername:newClustername,
                        uncertainSpeices:uncertainSpeices,
                        uncertainIndividual:uncertainIndividual,
                        uncertainClustername:uncertainClustername
                    } } 
            
                )
                allLabels.push(...labels)
            }
        }
        return allLabels
    }

    const getAnnotationFromHashID = async (hashID, dataSource) => {
        const path = import.meta.env.VITE_BACKEND_SERVICE_ADDRESS + `/get-annotations/${hashID}`

        try {
            const response = await axios.get(path, {
                params: {
                    data_source: dataSource
                }
            })

            const annotationVersions = response.data
            if (annotationVersions.length > 0){
                return [...annotationVersions]
                    .sort((a,b) => new Date(b.version) - new Date(a.version))[0]
                    .annotations
                    .filter(label => (label.onset >= 0 && label.offset >= 0))
            } else {
                return []
            }
        } catch (error){
            return []
        }
    }

    const extractLabelsUsingFileNames = async (audioFilesArray, hashID, dataSource) => {
        const allLabels = []
        for (let audioFile of audioFilesArray){
            const annotations = await getAnnotationFromHashID( hashID, dataSource )
            const labels = annotations.map( anno => {
                const uncertainSpeices = anno.species.endsWith( UNCERTAINTYSUFFIX )
                const newSpeices = uncertainSpeices? anno.species.slice(0, -UNCERTAINTYSUFFIX.length ):anno.species
                const uncertainIndividual = anno.individual.endsWith( UNCERTAINTYSUFFIX )
                const newIndividual = uncertainIndividual? anno.individual.slice(0, -UNCERTAINTYSUFFIX.length ):anno.individual
                const uncertainClustername = anno.clustername.endsWith( UNCERTAINTYSUFFIX )
                const newClustername = uncertainClustername? anno.clustername.slice(0, -UNCERTAINTYSUFFIX.length ):anno.clustername
                
                // DEAL WITH NAME MAPPING LOADING FROM HASH ID AND FROM CSV
                return { 
                    channelIndex:Number(anno.channelIndex),
                    filename:anno.filename,
                    onset:anno.onset,
                    offset:anno.offset,
                    minFreq:anno.minFrequency,
                    maxFreq:anno.maxFrequency,
                    species:newSpeices,
                    individual:newIndividual,
                    clustername:newClustername,
                    uncertainSpeices:uncertainSpeices,
                    uncertainIndividual:uncertainIndividual,
                    uncertainClustername:uncertainClustername
                }
            } )
            allLabels.push(...labels)
        }
        return allLabels
    }


    const checkIfAtLeastOneAudioFileWasUploaded = () => {
        for (const track of tracks){
            if (track.filename){
                return true
            }
        }
    }


    /* ++++++++++++++++++ handle Window Resize ++++++++++++++++++ */
    const handleWindowResize = useCallback(()=>{
        // this is to implement handle window resize function with a debounce function
        if (resizeWindowRef.current){
            clearTimeout( resizeWindowRef.current )
        }
        resizeWindowRef.current = setTimeout(
            ()=>{
                setCanvasWidth(window.innerWidth - TRACK_SIDEBAR_WIDTH - TRACK_PADDING_RIGHT )
                setAllTracksHeight( Math.max(100, window.innerHeight - labelPannelHeight - VIEWPORT_TIME_AXIS_HEIGHT - WINDOW_PADDING_BOTTOM) )
            }, 200
        )
    }, [ labelPannelHeight ] );

    /* ++++++++++++++++++ handle Drag Label Pannel Bar ++++++++++++++++++ */
    const handleLabelPannelBarMouseDown = (e)=>{
        setStartDragBarY( e.clientY )
        setPrevLabelPannelHeight( labelPannelHeight )
        setIsAdjustingLabelHeight( true )
    }

    const handleDragingLabelPannelBar = useCallback((e)=>{
        setLabelPanelBarYShift( e.clientY - startDragBarY)
    }, [isAdjustingLabelHeight])

    const handleStopDragingLabelPannelBar = useCallback( (e)=>{
        setIsAdjustingLabelHeight( false )
    }, [] )



    /* ++++++++++++++++++ useEffect Hooks ++++++++++++++++++ */
   // Arrow key event listeners with debouncing
    useEffect(() => {
        let lastEventTime = 0
        const DEBOUNCE_MS = 50  // Prevent rapid-fire duplicate events (50ms)

        const handleArrowScrollLeft = () => {
            const now = Date.now()
            if (now - lastEventTime < DEBOUNCE_MS) return
            lastEventTime = now
            // Click the actual button to ensure exact same behavior
            document.getElementById('left-scroll-btn')?.click()
        }
        const handleArrowScrollRight = () => {
            const now = Date.now()
            if (now - lastEventTime < DEBOUNCE_MS) return
            lastEventTime = now
            // Click the actual button to ensure exact same behavior
            document.getElementById('right-scroll-btn')?.click()
        }
        const handleArrowZoomIn = () => {
            const now = Date.now()
            if (now - lastEventTime < DEBOUNCE_MS) return
            lastEventTime = now
            onZoomInRef.current?.()
        }
        const handleArrowZoomOut = () => {
            const now = Date.now()
            if (now - lastEventTime < DEBOUNCE_MS) return
            lastEventTime = now
            onZoomOutRef.current?.()
        }

        const handleLabelCenterTimeChange = (centerTime) => {
            labelCenterTimeRef.current = centerTime
        }

        emitter.on('arrowScrollLeft', handleArrowScrollLeft)
        emitter.on('arrowScrollRight', handleArrowScrollRight)
        emitter.on('arrowZoomIn', handleArrowZoomIn)
        emitter.on('arrowZoomOut', handleArrowZoomOut)
        emitter.on('labelCenterTimeChange', handleLabelCenterTimeChange)

        return () => {
            emitter.off('arrowScrollLeft', handleArrowScrollLeft)
            emitter.off('arrowScrollRight', handleArrowScrollRight)
            emitter.off('arrowZoomIn', handleArrowZoomIn)
            emitter.off('arrowZoomOut', handleArrowZoomOut)
            emitter.off('labelCenterTimeChange', handleLabelCenterTimeChange)
        }
    }, [])

    // use the adjust the window canvas width when open a new tab, resize and then open the app
    useEffect( ()=>{
        setTimeout(()=>{
            setCanvasWidth(window.innerWidth - TRACK_SIDEBAR_WIDTH - TRACK_PADDING_RIGHT );}, 1000)
     }, [] )


    useEffect( ()=>{
        let newLabelPannelHeight =  Math.min( Math.max(INITIAL_LABEL_PANNEL_HEIGHT, prevLabelPannelHeight +  labelPanelBarYShift),
                                            window.innerHeight - VIEWPORT_TIME_AXIS_HEIGHT - WINDOW_PADDING_BOTTOM - 100
                                         )
        if (menuHeight!==0){
            newLabelPannelHeight = Math.min( newLabelPannelHeight, menuHeight + 15 )
        }

        setLabelPannelHeight( newLabelPannelHeight )
    }, [ labelPanelBarYShift, menuHeight ] )

    useEffect( ()=>{
        setAllTracksHeight( Math.max(100, window.innerHeight - labelPannelHeight - VIEWPORT_TIME_AXIS_HEIGHT - WINDOW_PADDING_BOTTOM) )
    }, [ labelPannelHeight ] )

    useEffect(() => {
        // Function to update height
        const updateHeight = () => {
            if (speciesMenuRef.current) {
                const height = speciesMenuRef.current.getBoundingClientRect().height;
                setMenuHeight(height);
            }
        };
      
        // Initial height measurement
        updateHeight();
      
        // Create ResizeObserver to watch for size changes
        const resizeObserver = new ResizeObserver(updateHeight);
        
        // Start observing the element
        if (speciesMenuRef.current) {
            resizeObserver.observe(speciesMenuRef.current);
        }
      
        // Cleanup on unmount
        return () => {
            if (speciesMenuRef.current) {
                resizeObserver.unobserve(speciesMenuRef.current);
            }
            resizeObserver.disconnect();
        };
      }, []);

    useEffect( ()=>{
        if (isAdjustingLabelHeight){
            document.addEventListener( "mousemove", handleDragingLabelPannelBar )
            document.addEventListener( "mouseup",  handleStopDragingLabelPannelBar)
        }

        return ()=>{
            document.removeEventListener( "mousemove", handleDragingLabelPannelBar )
            document.removeEventListener( "mouseup",  handleStopDragingLabelPannelBar )
        }
    }, [isAdjustingLabelHeight, handleDragingLabelPannelBar, handleStopDragingLabelPannelBar] )



    // When window size changes, update the layout-related parameters
    useEffect( () =>{
        window.addEventListener( "resize", handleWindowResize )

        return ()=>{
            window.removeEventListener( "resize", handleWindowResize  )
            // remove the debounced handle resize function if still exist
            if (resizeWindowRef.current){
                clearTimeout( resizeWindowRef.current )
            }
        }

    }, [labelPannelHeight] )

    // When tracks are being changed, recalculate currently longest track and set that as global audio duration
    useEffect( () => {
        const trackDurations = tracks.map(track => track.audioDuration)
        const newGlobalDuration = Math.max(...trackDurations)// === -Infinity ? 0 : Math.max(...trackDurations)
        
        setGlobalAudioDuration(newGlobalDuration)
    }, [tracks])

    // When the site was accessed with a URL data parameter
    useEffect( () => {
        let ignore = false

        const queryParams = new URLSearchParams(location.search)
        const strictMode = queryParams?.get('strict-mode')
        const hashID = queryParams?.get('hash-id')
        const metaData = queryParams?.get('metadata')
        const userProfileMode = queryParams?.get('user-profile')
        const givenStartTime = queryParams?.get('start')
        const readOnlyMode = queryParams?.get('read-only')
        const dataSource = queryParams?.get('data-source')

        setHashID( hashID )
        setDataSource(dataSource)

        if ( (hashID !== null) && hashID.startsWith("freq_anno_") ){
            setDisableOnsetOffsetEdit(true);
        }

        if (givenStartTime!==null){
            setUserGivenStartTime( parseFloat(givenStartTime) )
        }

        if (readOnlyMode?.toLowerCase() === 'true'){
            setReadOnlyMode(true)
        }

        if (strictMode?.toLowerCase() === 'true'){
            setStrictMode(true)
            setFilesUploading(true)
        }

        let userProfile = false
        if (userProfileMode?.toLowerCase() === 'true'){
            userProfile = true
        }

        const getMetaDataFromHashID = async () => {
            const path = import.meta.env.VITE_BACKEND_SERVICE_ADDRESS+'/get-metadata/'
            const requestParameters = {
                hash_id: hashID,
                user_profile: userProfile,
                data_source: dataSource,
            }
            const headers = {
                'Content-Type': 'application/json'
            }

            try {
                const response = await axios.post(path, requestParameters, {headers} )
                const audioFilesArray = response.data

                if (ignore) return

                // set the user name (in strict mode)
                setUserName(audioFilesArray[0].username)

                // Extract labels
                // const allLabels = extractLabels(audioFilesArray)
                const allLabels = await extractLabelsUsingFileNames( audioFilesArray, hashID, dataSource )

                // Create Species, Individuals and clustername buttons deriving from the imported labels.
                const updatedSpeciesArray = createSpeciesFromImportedLabels(allLabels, speciesArray)
                setSpeciesArray(updatedSpeciesArray)
                setImportedLabels(allLabels)
                setAnnotationInstance(audioFilesArray[0].annotation_instance)

                // Prepare for upload
                processAudioFilesSequentially(audioFilesArray)

            } catch (error){
                console.error("Error trying to access metadata through Hash ID:", error)
                toast.error('Error while trying to access the database. Check the console for more information.', {autoClose: false})
                setFilesUploading(false)
            }
        }

        const processMetadataFromBase64String = async () => {
            const decodedMetaData = await JSON.parse(atob(decodeURIComponent(metaData)))
            const audioFilesArray = decodedMetaData.response

            if (ignore) return

            // Extract labels
            const allLabels = extractLabels(audioFilesArray)

            // Create Species, Individuals and clustername buttons deriving from the imported labels.
            const updatedSpeciesArray = createSpeciesFromImportedLabels(allLabels, speciesArray)
            setSpeciesArray(updatedSpeciesArray)
            setImportedLabels(allLabels)
            setAnnotationInstance(audioFilesArray[0].annotation_instance)

            // Prepare for upload
            processAudioFilesSequentially(audioFilesArray)
        }

        if (hashID) {
            getMetaDataFromHashID()
        }

        if (metaData) {
            processMetadataFromBase64String()
        }

        return () => {
            ignore = true
        }

    }, [location])

    // When all the tracks have pushed their labels to allLabels state variable in App.jsx
    useEffect( () => {
        if (!allLabels || !submitRequest) return
        submitAllAnnotations()

        // Let the users know they have already submitted the annotation
        toast.info("Processing annotations ...")

        submitAnnotationTimestamps()
        setSubmitRequest(false)
        deleteAllLabelsInApp()
    }, [allLabels])

    // Keep tracksRef.current up to date
    useEffect(() => {
        tracksRef.current = tracks
    }, [tracks])

    // Set Up Before Unload Event Handler upon mount
    useEffect(() => {
        const releaseAudioIDs = async () => {
            const path = import.meta.env.VITE_BACKEND_SERVICE_ADDRESS + 'release-audio-given-ids'
            const audioIds = tracksRef.current.map(track => track.audioID)

            const requestParameters = { audio_id_list: audioIds }

            try {
                const response = await fetch(path, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestParameters),
                    keepalive: true
                })

                if (!response.ok) {
                    throw new Error('Network response was not ok')
                }
            } catch (error) {
                console.error('An error occurred:', error)
            }
        }

        const handleBeforeUnload = (event) => {
                const confirmationMessage = 'Are you sure you want to leave? Make sure to save your work before leaving.'

                event.preventDefault()
                event.returnValue = confirmationMessage

                return confirmationMessage
        }

        const handleUnload = () => {
            releaseAudioIDs()
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        window.addEventListener('unload', handleUnload)

        // Cleanup the event listeners on component unmount
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
            window.removeEventListener('unload', handleUnload)
        }
    }, [])

    useEffect(() => {
        // Create a minimal worker to keep the page alive
        const keepAliveWorker = new Worker(
          URL.createObjectURL(
            new Blob(
              ['setInterval(() => postMessage("alive"), 60000)'],
              { type: 'application/javascript' }
            )
          )
        );
        keepAliveWorker.onmessage = () => {};
        // Cleanup
        return () => keepAliveWorker.terminate();
      }, []);
    
    const checkIfAnyWindowIsOpen = () => {
        const individualOrClusternameWindowOpen = speciesArray.find(speciesObj => {
            if (speciesObj.showClusternameInputWindow || speciesObj.showIndividualInputWindow){
                return true
            }
        })
        return individualOrClusternameWindowOpen || showGlobalConfigWindow || anyWindowsOpen
    }

    // Note: Old arrow key event handlers have been removed.
    // Arrow key handling is now done in Track.jsx which emits events that are
    // handled by the arrow key event listeners above (lines ~1130-1175).



    // THIS FUNCTION NEEDS TO BE REFACTORED / REUNITED WITH THE ONE IN IMPORTCSV.JSX WHEN I GET BACK FROM HOLIDAYS
    const readCSV = (file) => {
        if (!file) return

        const lines = file.split('\n')
        const importedLabelsArray = []

        // Starting from the second line to skip the CSV header
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i]
            // Skip empty rows
            if (line === '') continue

            const [onset, offset, minFrequency, maxFrequency, species, individual, clustername, filename, channelIndex, configSnapshotRaw] = line.trim().split(',')

            const uncertainSpeices = species.trim().endsWith( UNCERTAINTYSUFFIX )
            const newSpeices = uncertainSpeices? species.trim().slice(0, -UNCERTAINTYSUFFIX.length ):species.trim()
            const uncertainIndividual = individual.trim().endsWith( UNCERTAINTYSUFFIX )
            const newIndividual = uncertainIndividual? individual.trim().slice(0, -UNCERTAINTYSUFFIX.length ):individual.trim()
            const uncertainClustername = clustername.trim().endsWith( UNCERTAINTYSUFFIX )
            const newClustername = uncertainClustername? clustername.trim().slice(0, -UNCERTAINTYSUFFIX.length ):clustername.trim()

            let configSnapshot
            if (!configSnapshotRaw){
                // For CSV Files created with legacy Callmark, which didn't support Config Snapshot
                configSnapshot = null
            } else {
                // Replace semicolons from the raw config Snapshot string with commas, covert strings int floats
                configSnapshot = Object.fromEntries(
                    configSnapshotRaw
                        .split(';')
                        .map(pair => pair.split('='))
                        .map(([key, value]) => [
                            key.trim(),
                            key.trim() === 'spectrogramType' ? value.trim() : parseFloat(value)
                        ])
                );
            }

            importedLabelsArray.push({
                onset: parseFloat(onset),
                offset: parseFloat(offset),
                minFreq: parseFloat(minFrequency),
                maxFreq: parseFloat(maxFrequency),
                species: newSpeices,
                individual: newIndividual,
                clustername: newClustername,
                filename: filename.trim(),
                channelIndex: parseFloat(channelIndex),
                uncertainSpeices:uncertainSpeices,
                uncertainIndividual:uncertainIndividual,
                uncertainClustername:uncertainClustername,
                configSnapshot: configSnapshot
            })

        }

        const newSpeciesArray = createSpeciesFromImportedLabels(importedLabelsArray, speciesArray)
        passSpeciesArrayToApp(newSpeciesArray)

        setImportedLabels(importedLabelsArray)
    }



    // When a Zip Folder was imported
    useEffect(() => {
        if (!projectData) return;

        const processFiles = async () => {
            await processAudioFilesFromZipFolder(projectData.audioFiles);
            readCSV(projectData.labels)
            console.log(projectData.config)
            //setGlobalHopLength(projectData.config.globalHopLength)
            //setGlobalNumSpecColumns(projectData.config.globalNumSpecColumns)
            //setGlobalSamplingRate(projectData.config.globalSamplingRate)
        };

        processFiles();
    }, [projectData]);



    return (
        <Box sx={{display:"flex", flexDirection:"column"}}>

            {readOnlyMode &&
                <Banner
                    title={'Read Only Mode'}
                    message={'Your changes cannot be saved to the database.'}
                />
            }

            <ToastContainer />
            <Box
                sx={{height:`${labelPannelHeight}px`}}
            >
                <Box  sx={{height:`${labelPannelHeight - 10}px`, position:"absolute", top: 0, left: 0,  overflowY:"auto"}}>
                    <Box
                        ref={speciesMenuRef}
                    >
                        <SpeciesMenu
                            speciesArray={speciesArray}
                            passSpeciesArrayToApp={passSpeciesArrayToApp}
                            passDeletedItemIDToApp={passDeletedItemIDToApp}
                            strictMode={strictMode}
                            readOnlyMode={readOnlyMode}
                            isMarkingAnnotationArea={isMarkingAnnotationArea}
                            setIsMarkingAnnotationArea={setIsMarkingAnnotationArea}
                            silent={0}
                        />
                    </Box>
                </Box>
                {/* This duplicated Box is used to measure the actual height of the species menu  */}
                <Box  sx={{height:`${labelPannelHeight - 10}px`, zIndex:-1, position:"relative"}}>
                    <Box
                        ref={speciesMenuRef}
                    >
                        <SpeciesMenu
                            speciesArray={speciesArray}
                            passSpeciesArrayToApp={passSpeciesArrayToApp}
                            passDeletedItemIDToApp={passDeletedItemIDToApp}
                            strictMode={strictMode}
                            isMarkingAnnotationArea={isMarkingAnnotationArea}
                            setIsMarkingAnnotationArea={setIsMarkingAnnotationArea}
                            silent={1}
                        />
                    </Box>
                </Box>
                <Box sx={{height:"10px", width:"100%", 
                        backgroundColor:"#546e7a",//"#767546", 
                        cursor:"row-resize",
                        display:"flex", justifyContent:"center", alignItems:"center",
                        position:"absolute"
                }}
                    onMouseDown={handleLabelPannelBarMouseDown}
                >
                    <DragHandleIcon />
                </Box>
            </Box>
            
            <Box sx={{height:`${VIEWPORT_TIME_AXIS_HEIGHT}px`, display:"flex", alignItems:"center", 
                    backgroundColor:"#061924",
                    position: 'relative',
                    zIndex:1
             }} >

                    <Box sx={{ width: `${TRACK_SIDEBAR_WIDTH - TRACK_PADDING_RIGHT}px`, 
                               marginLeft:"0px", marginTop:"0px", display:"flex", flexShrink:0,
                               paddingRight:"0px",
                               alignItems:"center", justifyContent:"flex-end"}} >
                        <Box  >
                            {/* <Tooltip title='Mark Annotation Areas'>
                                <IconButton
                                    style={globalControlsBtn}
                                    disabled={isMarkingAnnotationArea || (strictMode && !strictDevMode ) }
                                    onClick={ () => setIsMarkingAnnotationArea(true)}>
                                    <LockIcon style={{...icon, ...{color:( strictMode && !strictDevMode ? "#828c91":( isMarkingAnnotationArea?ANNOTATED_AREA_COLOR:"#ffffff"))}}} />
                                </IconButton>
                            </Tooltip> */}
                            <Tooltip title='Submit Annotations'>
                                <span>
                                    <IconButton
                                        style={{...globalControlsBtn, ...((!strictMode || readOnlyMode) && iconBtnDisabled)}}
                                        disabled={!strictMode || readOnlyMode}
                                        onClick={handleClickSubmitBtn}
                                    >
                                        <DoneAllIcon style={icon} />
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <ImportCSV
                                passImportedLabelsToApp={passImportedLabelsToApp}
                                speciesArray={speciesArray}
                                passSpeciesArrayToApp={passSpeciesArrayToApp}
                                atLeastOneAudioFileUploaded={checkIfAtLeastOneAudioFileWasUploaded()}
                                UNCERTAINTYSUFFIX={UNCERTAINTYSUFFIX}
                            />
                            <Export
                                tracks={tracks}
                                allLabels={allLabels}
                                annotationTimestamps={annotationTimestamps.current}
                                annotationInstance={annotationInstance}
                                exportRequest={exportRequest}
                                passExportRequestToApp={passExportRequestToApp}
                                deleteAllLabelsInApp={deleteAllLabelsInApp}
                                UNCERTAINTYSUFFIX={UNCERTAINTYSUFFIX}
                                speciesArray={speciesArray}
                            />
                            <Tooltip title='Open Global Configurations'>
                                <IconButton
                                    style={globalControlsBtn}
                                    onClick={ () => setShowGlobalConfigWindow(true)}
                                >
                                    <SettingsIcon style={icon} />
                                </IconButton>
                            </Tooltip>
                            <ZipImport
                                passProjectDataToApp={passProjectDataToApp}
                                MAX_FILE_SIZE={MAX_FILE_SIZE}
                            />
                            <ZipExport
                                tracks={tracks}
                                allLabels={allLabels}
                                annotationInstance={annotationInstance}
                                zipExportRequest={zipExportRequest}
                                passZipExportRequestToApp={passZipExportRequestToApp}
                                deleteAllLabelsInApp={deleteAllLabelsInApp}
                                UNCERTAINTYSUFFIX={UNCERTAINTYSUFFIX}
                                trackMetaObjectsList={trackMetaObjectsList}
                                removeAllTrackMetaObjectsInApp={removeAllTrackMetaObjectsInApp}
                                globalHopLength={globalHopLength}
                                globalNumSpecColumns={globalNumSpecColumns}
                                globalSamplingRate={globalSamplingRate}
                            />

                            <Tooltip
                                title={allowAnnotationOverlap ? "Disable overlapping Annotations" : "Enable overlapping Annotations"}
                            >
                                <IconButton
                                    style={globalControlsBtn}
                                    onClick={() => setAllowAnnotationOverlap((prev) => !prev)}
                                    sx={{color: 'white'}}
                                >
                                    <DisplaySettingsIcon
                                        sx={{ color: allowAnnotationOverlap ? "inherit" : "red", margin: 0 }}
                                    />
                                </IconButton>
                            </Tooltip>


                        </Box>
                        <Box id='zoom-scroll-buttons-container'
                        > 
                            <IconButton  onClick={fastLeftScroll}>
                                <FastRewindIcon sx={{"color":"white",  marginTop:"-20px", marginBottom:"-20px", fontSize:20}}/>
                            </IconButton>
                            <button
                                id='left-scroll-btn'
                                onClick={leftScroll}
                            />
                            {/* <IconButton  onClick={leftScroll}>
                                <ArrowLeftIcon sx={{"color":"white", margin:"-20px", fontSize:50}}/>
                            </IconButton> */}
                            <IconButton id="hop-zoom-in-btn" style={(strictMode && !strictDevMode) ? globalControlsBtnDisabled : globalControlsBtn} disabled={strictMode && !strictDevMode} onClick={onZoomIn}>
                                <ZoomInIcon style={icon}/>
                            </IconButton>
                            <IconButton id="hop-zoom-out-btn" style={(strictMode && !strictDevMode) ? globalControlsBtnDisabled : globalControlsBtn} disabled={strictMode && !strictDevMode} onClick={onZoomOut}>
                                <ZoomOutIcon style={icon}/>
                            </IconButton>
                            {/* <IconButton  onClick={rightScroll}>
                                <ArrowRightIcon sx={{"color":"white", margin:"-20px", fontSize:50}}/>
                            </IconButton> */}
                            <button
                                id='right-scroll-btn'
                                onClick={rightScroll}
                            />
                            <IconButton  onClick={fastRightScroll}>
                                <FastForwardIcon sx={{"color":"white", marginTop:"-20px", marginBottom:"-20px", fontSize:20}}/>
                            </IconButton>
                        </Box> 
                    </Box>
                    <Box >
                        <ViewPort
                            height = {VIEWPORT_TIME_AXIS_HEIGHT * 0.6  - 10}
                            width = {canvasWidth}
                            maxPossibleTime={globalAudioDuration}
                            duration={globalClipDuration}
                            startTime={currentStartTime}
                            endTime={currentEndTime}
                            paddingLeftRight={TRACK_PADDING_RIGHT}
                            passCurrentStartTimeToApp={passCurrentStartTimeToApp}
                            passCurrentEndTimeToApp={passCurrentEndTimeToApp}
                            passClipDurationToApp={passClipDurationToApp}
                            passMaxScrollTimeToApp={passMaxScrollTimeToApp}
                            passScrollStepToApp={passScrollStepToApp}
                            globalSamplingRate={globalSamplingRate}
                            globalNumSpecColumns={globalNumSpecColumns}
                            updateClipDurationAndTimes={updateClipDurationAndTimes}
                            strictMode={strictMode}
                            strictDevMode={strictDevMode}
                            SCROLL_STEP_RATIO={SCROLL_STEP_RATIO}
                        />
                        <Box 
                            sx={{paddingLeft:`${TRACK_PADDING_RIGHT}px`}}>
                            <TimeAxis 
                                height={VIEWPORT_TIME_AXIS_HEIGHT * 0.4 - 10} 
                                width={ canvasWidth } 
                                maxPossibleTime={ globalAudioDuration} 
                                duration={globalClipDuration} 
                                startTime={currentStartTime}
                                endTime={currentEndTime}
                            ></TimeAxis> 
                        </Box>  
                    </Box>

            </Box>

            <Box sx={{height:allTracksHeight, overflowY:"auto", 
                    backgroundColor:"#061924",
                    position: 'relative',
                    zIndex:1,
                    outline: 'none'}} 
                 tabIndex={-1} 
            >
                {showGlobalConfigWindow &&
                    <GlobalConfig
                        globalAudioDuration={globalAudioDuration}
                        currentStartTime={currentStartTime}
                        updateClipDurationAndTimes={updateClipDurationAndTimes}
                        globalHopLength={globalHopLength}
                        globalNumSpecColumns={globalNumSpecColumns}
                        globalSamplingRate={globalSamplingRate}
                        passGlobalNumSpecColumnsToApp={passGlobalNumSpecColumnsToApp}
                        passGlobalSamplingRateToApp={passGlobalSamplingRateToApp}
                        defaultConfig={defaultConfig}
                        passShowGlobalConfigWindowToApp={passShowGlobalConfigWindowToApp}
                        strictMode={strictMode}
                        strictDevMode={strictDevMode}
                        specCanvasHeight={specCanvasHeight}
                        setSpecCanvasHeight={setSpecCanvasHeight}
                        showAllWaveforms={showAllWaveforms}
                        setShowAllWaveforms={setShowAllWaveforms}
                        showAllAnnotationCanvases={showAllAnnotationCanvases}
                        setShowAllAnnotationCanvases={setShowAllAnnotationCanvases}
                        sliderSpecBrightnessValue={sliderSpecBrightnessValue}
                        handleSliderSpecBrightnessChange={handleSliderSpecBrightnessChange}
                        handleSliderSpecBrightnessMouseUp={handleSliderSpecBrightnessMouseUp}
                        sliderSpecContrastValue={sliderSpecContrastValue}
                        handleSliderSpecContrastChange={handleSliderSpecContrastChange}
                        handleSliderSpecContrastMouseUp={handleSliderSpecContrastMouseUp}
                        colorMap={colorMap}
                        setColorMap={setColorMap}
                    />
                }

                {renderTracks()}

                {filesUploading && <LoadingCircle progress={uploadProgress} />}

                <Tooltip title="Add New Track">
                    <span>
                        <IconButton style={(strictMode || projectData) ? iconBtnDisabled : iconBtn} disabled={(strictMode || projectData)} onClick={addTrack}>
                            <AddBoxIcon style={icon}/>
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>
            
        </Box>
    )
}

export default App