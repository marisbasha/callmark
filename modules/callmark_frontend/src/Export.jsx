// React
import React, {useEffect} from "react"

// External dependencies
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import DownloadIcon from '@mui/icons-material/Download'

// Internal dependencies
import {icon, globalControlsBtn, iconBtnDisabled} from "./buttonStyles.js"
import {checkIfAnyAudioFileIsPresent, binsToExportTime, importTimeToBins} from "./utils.js"

function Export( { tracks, allLabels, annotationTimestamps, annotationInstance, exportRequest, passExportRequestToApp, deleteAllLabelsInApp, UNCERTAINTYSUFFIX, speciesArray } ){

    const anyAudioFilePresent = checkIfAnyAudioFileIsPresent(tracks)

    function handleClick(){
        passExportRequestToApp(true)
    }

    function exportCSV(){
        // Assign each label it's correct trackIndex
        const newLabelsArray = allLabels.map( label => {
            const correctChannelIndex = tracks.find( track => track.trackID === label.trackID).channelIndex

            const newSpeciesName = label.uncertainSpeices? label.species + UNCERTAINTYSUFFIX : label.species
            const newIndividualName = label.uncertainIndividual? label.individual + UNCERTAINTYSUFFIX : label.individual
            const newClusterName = label.uncertainClustername? label.clustername + UNCERTAINTYSUFFIX : label.clustername

            return {
                ...label,
                channelIndex: correctChannelIndex,
                species: newSpeciesName,
                individual: newIndividualName,
                clustername: newClusterName
            }
        })

        if (newLabelsArray.length === 0){
            console.log(speciesArray)
            const data = speciesArray;

            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json"
            });

            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = "speciesConfig.json";
            a.click();

            URL.revokeObjectURL(url);

            return
        }

        // Get filename of the first track to use as CSV filename
        const firstTrackFilename = tracks.find(track => track.trackIndex === 0).filename.slice(0, -4)

        // Transform to CSV data
        let csvData = newLabelsArray.map(label => {
            // Use originalConfigSnapshot for the configSnapshot string in CSV
            const exportConfig = label.originalConfigSnapshot || label.configSnapshot

            // Recover bins in the original config space from stored ground truth time
            const exportBins = importTimeToBins(
                label.onsetTime, label.offsetTime,
                exportConfig.nfft, exportConfig.hopLength, exportConfig.samplingRate
            )

            // Sort keys alphabetically for consistent output
            let configString = Object.entries(exportConfig)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => `${k}=${v}`)
                .join(';');

            configString = `${configString};onsetBin=${exportBins.onsetBin};offsetBin=${exportBins.offsetBin}`
            // Use binsToExportTime for the CSV onset/offset (has short-label fallback)
            const exportTime = binsToExportTime(exportBins.onsetBin, exportBins.offsetBin, exportConfig.nfft, exportConfig.hopLength, exportConfig.samplingRate)
            return `${exportTime.onset},${exportTime.offset},${label.minFreq},${label.maxFreq},${label.species},${label.individual},${label.clustername},${label.filename},${label.channelIndex},${configString}`;
        });

        csvData.unshift('onset,offset,minFrequency,maxFrequency,species,individual,clustername,filename,channelIndex,configSnapshot');
        csvData = csvData.join('\n');


        // In strict mode use annotationInstance as csv filename
        const newCSVFileName = annotationInstance ? `${annotationInstance}.csv` : `${firstTrackFilename}.csv`

        // Prepare Annotation Timestamps CSV File
        let csvAnnotationTimestamps = annotationTimestamps.map( item => `${item.hash_id},${item.timestamp},${item.action},${item.deviceInfo.screenWidth},${item.deviceInfo.screenHeight}`)
        csvAnnotationTimestamps.unshift('hash_id,timestamp,action,screenWidth,screenHeight')
        csvAnnotationTimestamps = csvAnnotationTimestamps.join('\n')

        const annotationTimestampsFileName = annotationInstance ? `${annotationInstance}_metadata.csv` : `${firstTrackFilename}_metadata.csv`

        triggerDownload(csvData, newCSVFileName)
        triggerDownload(csvAnnotationTimestamps, annotationTimestampsFileName)
    }

    function triggerDownload(data, filename) {
        const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const element = document.createElement('a');
        element.setAttribute('href', url);
        element.setAttribute('download', filename);

        document.body.appendChild(element);
        element.click();
        element.remove();

        URL.revokeObjectURL(url); // cleanup
    }

    // When all the tracks have pushed their labels to allLabels state variable in App.jsx
    useEffect( () => {
        if (!allLabels || !exportRequest) return
        exportCSV()
        passExportRequestToApp(false)
        deleteAllLabelsInApp()
    }, [allLabels])

    return (
        <Tooltip title="Download Annotations">
            <IconButton
                style={{...globalControlsBtn, ...(!anyAudioFilePresent && iconBtnDisabled)}}
                disabled={!anyAudioFilePresent}
                onClick={handleClick}
            >
                <DownloadIcon style={icon} />
            </IconButton>
        </Tooltip>
    )
}

export default Export
