import React, { useEffect } from "react";
import JSZip from "jszip";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import axios from "axios";
import { toast } from "react-toastify";
import { globalControlsBtn, icon, iconBtnDisabled} from "./buttonStyles.js";
import {checkIfAnyAudioFileIsPresent, binsToExportTime, importTimeToBins} from "./utils.js"

function ZipExport({
                       tracks,
                       allLabels,
                       annotationInstance,
                       zipExportRequest,
                       passZipExportRequestToApp,
                       deleteAllLabelsInApp,
                       UNCERTAINTYSUFFIX,
                       trackMetaObjectsList,
                       removeAllTrackMetaObjectsInApp,
                       globalHopLength,
                       globalNumSpecColumns,
                       globalSamplingRate,
                   }) {

    const anyAudioFilePresent = checkIfAnyAudioFileIsPresent(tracks)

    function handleClick() {
        passZipExportRequestToApp(true);
    }

    // Convert labels to CSV string
    function buildCSV() {
        const newLabelsArray = allLabels.map((label) => {
            const correctChannelIndex = tracks.find(
                (track) => track.trackID === label.trackID
            ).channelIndex;

            const newSpeciesName = label.uncertainSpeices
                ? label.species + UNCERTAINTYSUFFIX
                : label.species;
            const newIndividualName = label.uncertainIndividual
                ? label.individual + UNCERTAINTYSUFFIX
                : label.individual;
            const newClusterName = label.uncertainClustername
                ? label.clustername + UNCERTAINTYSUFFIX
                : label.clustername;

            return {
                ...label,
                channelIndex: correctChannelIndex,
                species: newSpeciesName,
                individual: newIndividualName,
                clustername: newClusterName,
            };
        });

        let csvData = newLabelsArray.map((label) => {
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
                .join(";");

            configString = `${configString};onsetBin=${exportBins.onsetBin};offsetBin=${exportBins.offsetBin}`
            // Use binsToExportTime for the CSV onset/offset (has short-label fallback)
            const exportTime = binsToExportTime(exportBins.onsetBin, exportBins.offsetBin, exportConfig.nfft, exportConfig.hopLength, exportConfig.samplingRate)
            return `${exportTime.onset},${exportTime.offset},${label.minFreq},${label.maxFreq},${label.species},${label.individual},${label.clustername},${label.filename},${label.channelIndex},${configString}`;
        });

        csvData.unshift(
            "onset,offset,minFrequency,maxFrequency,species,individual,clustername,filename,channelIndex,configSnapshot"
        );
        return csvData.join("\n");
    }

    // Build JSON config
    function buildConfigFile() {
        return JSON.stringify(
            {
                globalConfig: {
                    globalHopLength,
                    globalNumSpecColumns,
                    globalSamplingRate,
                },
                trackConfigs: trackMetaObjectsList,
            },
            null,
            2
        );
    }

    async function downloadAudioAsBlob(audioID, clipDuration) {
        const path = import.meta.env.VITE_BACKEND_SERVICE_ADDRESS + "get-audio-clip-wav";
        try {
            const response = await axios.post(path, {
                audio_id: audioID,
                start_time: 0,
                clip_duration: clipDuration,
            });
            const audioBase64 = response.data.wav;

            const binaryString = atob(audioBase64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

            return new Blob([bytes], { type: "audio/wav" });
        } catch (error) {
            toast.error("Error fetching audio clip. Check the console for details.");
            console.error("Error fetching audio clip:", error);
            return null;
        }
    }

    async function buildZip() {
        const zip = new JSZip();

        // 1. Add CSV
        const csvString = buildCSV();
        const csvFilename = annotationInstance
            ? `${annotationInstance}.csv`
            : "annotations.csv";
        zip.file(csvFilename, csvString);

        // 2. Add JSON config
        zip.file("config.json", buildConfigFile());

        // 3. Add Audio Files
        let counter = 0
        const audioPromises = trackMetaObjectsList.map(async (trackMetaObj) => {
            const blob = await downloadAudioAsBlob(trackMetaObj.audioID, trackMetaObj.audioDuration);
            if (!blob) return;

            const audioFilename = `${counter}_${trackMetaObj.filename}`;
            counter++

            zip.file(audioFilename, blob);
        });



        await Promise.all(audioPromises);

        // 4. Generate the zip file
        const zipBlob = await zip.generateAsync({ type: "blob" });

        // 5. Trigger download
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = annotationInstance
            ? `${annotationInstance}.zip`
            : "project_export.zip";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        toast.success("ZIP export ready!");
    }

    useEffect(() => {
        if (!allLabels || !zipExportRequest) return;

        (async () => {
            await buildZip();
            passZipExportRequestToApp(false);
            deleteAllLabelsInApp();
            removeAllTrackMetaObjectsInApp();
        })();
    }, [allLabels]);

    return (
        <Tooltip title="Export Zip Project">
            <IconButton
                style={{...globalControlsBtn, ...(!anyAudioFilePresent && iconBtnDisabled)}}
                disabled={!anyAudioFilePresent}
                onClick={handleClick}
            >
                <DriveFileMoveIcon style={icon} />
            </IconButton>
        </Tooltip>
    );
}

export default ZipExport;
