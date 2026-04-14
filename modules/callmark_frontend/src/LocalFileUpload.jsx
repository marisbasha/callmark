// React
import { useRef } from 'react';

// External dependencies
import axios from 'axios';
import { Button, Box } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import Tooltip from '@mui/material/Tooltip';
import {toast} from "react-toastify";

// Internal dependencies
import {uploadFileInChunks, combineChunks} from "./utils.js";
import {CloudDone} from "@mui/icons-material";

function LocalFileUpload({
        filename,
        trackID,
        specCalMethod,
        nfft,
        binsPerOctave,
        minFreq,
        maxFreq,
        passSpectrogramIsLoadingToTrack,
        handleUploadResponse,
        handleMultipleLocalFileUploads,
        handleUploadError,
        strictMode,
        projectData,
        colorMap,
        passFilesUploadingToApp,
        setUploadProgress,
        MAX_FILE_SIZE
    })
{

    const inputRef = useRef(null);
    const manualFileUploadNotAllowed = strictMode || projectData;

    const streamUploadLocalFile =  async( file ) => {
        if (!file) return null;
        try {
            // Upload file in chunks
            const uniqueFileId = await uploadFileInChunks(file, (progress) => {
                setUploadProgress(progress)
            });

            // Request server to combine chunks
            await combineChunks(uniqueFileId, file.name);

            const formData = new FormData();
            formData.append('unique_file_id', uniqueFileId);
            formData.append('file_name', file.name);
            formData.append('spec_cal_method', specCalMethod);
            formData.append('n_fft', nfft);
            formData.append('bins_per_octave', binsPerOctave);
            formData.append('min_frequency', minFreq);
            formData.append('max_frequency', maxFreq);
            formData.append('color_map', colorMap);

            const path = import.meta.env.VITE_BACKEND_SERVICE_ADDRESS + '/upload_from_combined_chunks';
            const response = await axios.post(path, formData);

            // Return response instead of calling handleUploadResponse directly
            return { response, filename: file.name };

        }catch (error){
            console.error('Error stream upload local file:', error);
            toast.error( "File Uploading failed. Please retry or try smaller audio files."  )
            handleUploadError(error);
            return null;
        }

    }
    

    const handleFileChange = async (event) => {
        const files = Array.from(event.target.files);

        if (files.length === 0) return;

        // Check file sizes
        const oversizedFiles = files.filter(file => file.size > MAX_FILE_SIZE);
        if (oversizedFiles.length > 0) {
            toast.error(`${oversizedFiles.length} file(s) exceed ${Math.floor(MAX_FILE_SIZE/(1024 * 1024))} MB limit`);
            return;
        }

        try {
            passSpectrogramIsLoadingToTrack(true);
            passFilesUploadingToApp(true);

            // Upload all files and collect responses
            const allResponses = [];
            for (const file of files) {
                const uploadResult = await streamUploadLocalFile(file);
                if (uploadResult) {
                    allResponses.push(uploadResult);
                }
            }

            // Process all responses together
            if (allResponses.length > 0) {
                handleMultipleLocalFileUploads(allResponses, trackID);
            }

            passFilesUploadingToApp(false);
            passSpectrogramIsLoadingToTrack(false);

        } catch (error) {
            console.error('Error in handleFileChange:', error);
            passFilesUploadingToApp(false);
            passSpectrogramIsLoadingToTrack(false);
        } finally {
            if (inputRef.current) {
                inputRef.current.value = '';
            }
        }
    };


    const handleButtonClick = () => {
        if (!manualFileUploadNotAllowed && inputRef.current) {
            inputRef.current.click();
        }
    };

    return (
        <Tooltip title={filename || ''}>
            <Box sx={{ position: 'relative', width: '20px', margin: '0 20px 0 3px' }}>
                <Button
                    onClick={handleButtonClick}
                    variant="contained"
                    disabled={manualFileUploadNotAllowed}
                    startIcon={filename ? <CloudDone /> : <CloudUploadIcon />}
                    sx={{
                        width: '150%',
                        height: '22px',
                        textTransform: 'none',
                        padding: '4px 0',
                        minWidth: 'unset',
                        '& .MuiButton-startIcon': {
                            margin: '0 0 0 0',
                            minWidth: 'unset',
                        },
                        '& .MuiButton-endIcon': {
                            margin: 0,
                            minWidth: 'unset',
                        },
                        '&.Mui-disabled': {
                            backgroundColor: '#9e9e9e',
                            color: '#fff',
                            opacity: 0.5,
                        },
                    }}
                >

                </Button>
                {/* using native input, instead of mui/material/styles for better stability */}
                <input
                    ref={inputRef}
                    type="file"
                    accept=".wav,.mp3,.flac"
                    multiple
                    onChange={handleFileChange}
                    disabled={manualFileUploadNotAllowed}
                    style={{
                        display: 'none',
                    }}
                />
            </Box>
        </Tooltip>
    );
}

export default LocalFileUpload;