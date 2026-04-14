// React
import React from "react";

// External dependencies
import JSZip from "jszip";
import FolderZipIcon from '@mui/icons-material/FolderZip';
import IconButton from "@mui/material/IconButton";

// Internal dependencies
import {globalControlsBtn, icon} from "./buttonStyles.js";
import Tooltip from "@mui/material/Tooltip";
import {toast} from "react-toastify";


function ZipImport( {passProjectDataToApp, MAX_FILE_SIZE} ) {
    const fileInputRef = React.useRef(null);

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const zip = new JSZip();
        const content = await zip.loadAsync(file);

        const extractedFiles = {
            config: null,
            labels: null,
            audioFiles: []
        };

        for (const [filename, zipEntry] of Object.entries(content.files)) {
            if (!zipEntry.dir && !filename.startsWith("__MACOSX/") && !filename.includes("._")) {
                let fileData;

                if ( filename.endsWith(".json") ) {
                    fileData = await zipEntry.async("string");
                    extractedFiles.config = fileData
                }

                if (filename.endsWith(".csv")) {
                    fileData = await zipEntry.async("string");
                    extractedFiles.labels = fileData
                }

                if (filename.endsWith(".wav") || filename.endsWith(".mp3") || filename.endsWith(".flac")) {
                    fileData = await zipEntry.async("blob");

                    if (fileData.size > MAX_FILE_SIZE) {
                        toast.error(`${filename} size exceeds ${Math.floor(MAX_FILE_SIZE / (1024 * 1024)).toFixed(2)} MB limit. Selected file is ${(fileData.size / (1024 * 1024)).toFixed(2)}MB`);
                        return
                    }

                    // Strip zip folder path and ID prefix (e.g., "zip/2_")
                    const rawName = filename.split("/").pop(); // "2_birdsong.wav"
                    //const basename = rawName.replace(/^\d+_/, ""); // removes leading digits + underscore → "birdsong.wav"

                    // Wrap blob into File
                    const fileWrapped = new File([fileData], rawName, { type: ''});

                    extractedFiles.audioFiles.push(fileWrapped);
                }
            }
        }

        passProjectDataToApp(extractedFiles)
    };

    const handleClick = () => {
        // Reset the file input value before clicking it
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }

        fileInputRef.current.click();
    }

    return (
        <>
            <Tooltip title="Import Zip Project">
                <IconButton
                    style={globalControlsBtn}
                    onClick={handleClick}
                >
                    <FolderZipIcon style={icon} />
                </IconButton>
            </Tooltip>
            <input
                type="file"
                id="zip-input"
                accept=".zip"
                style={{ display: "none" }}
                onChange={handleFileUpload}
                ref={fileInputRef}
            />
        </>
    );
}

export default ZipImport;
