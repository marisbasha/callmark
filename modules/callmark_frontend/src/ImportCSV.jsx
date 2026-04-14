// React
import React, {useState} from "react";

// External dependencies
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import UploadFileIcon from "@mui/icons-material/UploadFile";

// Internal dependencies
import {createSpeciesFromImportedLabels} from "./species.js";
import {globalControlsBtn, icon, iconBtnDisabled} from "./buttonStyles.js";

function ImportCSV( {passImportedLabelsToApp, speciesArray, passSpeciesArrayToApp, atLeastOneAudioFileUploaded, UNCERTAINTYSUFFIX} ) {

    const [csvFileUploaded, setCsvFileUploaded] = useState(false);
    const fileInputRef = React.useRef(null);

    const handleFileChange = (event) => {
        const file = event.target.files[0]

        // Deal with JSON file that contains only the species array, no labels
        if (file && file.type === "application/json") {
            file.text().then(text => {
                const importedSpeciesArray = JSON.parse(text);
                passSpeciesArrayToApp( importedSpeciesArray )
            }).catch(err => {
                console.error("Error reading JSON:", err);
            });
            return
        }

        // Deal with CSV files with labels
        if (file) {
            const reader = new FileReader()
            reader.onload = (e) => {
                const contents = e.target.result
                const lines = contents.split('\n')
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

                passImportedLabelsToApp(importedLabelsArray)
                setCsvFileUploaded(event.target.files[0].name)
            }
            reader.readAsText(file)
        }
    }

    const handleClick = () => {
        if (csvFileUploaded){
            const answer = confirm(`A file named ${csvFileUploaded} has already been uploaded. Uploading a new CSV file will add (not replace!) the new labels to the existing one's. If you want to completely reload the labels, please refresh the page, and upload the audio and label file again.`)
            if (!answer) return
        }

        // Reset the file input value before clicking it
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }

        fileInputRef.current.click();
    }

    const getCorrectTooltip = () => {
        if (!atLeastOneAudioFileUploaded){
            return 'Upload all your audio files before uploading your CSV annotations file'
        }
        if (!csvFileUploaded){
            return 'Import CSV'
        }
        return csvFileUploaded
    }

    return (
        <Tooltip title={getCorrectTooltip()}>
            <div style={{display: 'inline'}}>
                <IconButton
                    style={{...globalControlsBtn, ...(!atLeastOneAudioFileUploaded && iconBtnDisabled)}}
                    disabled={!atLeastOneAudioFileUploaded}
                    onClick={handleClick}
                >
                    <UploadFileIcon style={icon} />
                </IconButton>
                <input
                    type="file"
                    id="csv-file-input"
                    accept=".csv,.json"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                    ref={fileInputRef}
                />
            </div>
        </Tooltip>
    )
}

export default ImportCSV
