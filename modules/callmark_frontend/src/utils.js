const excludeNonDigits = (event) => {
    // Prevent the default behavior if the pressed key is not a digit
    if (!/\d/.test(event.key)) {
        event.preventDefault()
    }
}

const generateUniqueId = () => {
    return Date.now().toString() + '_' + Math.random().toString(36).slice(2, 11);
};

const uploadFileInChunks = async (file, onProgress) => {
    const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB
    const MAX_PARALLEL = 4;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uniqueFileId = generateUniqueId();

    try {
        let completedChunks = 0;

        // Upload chunks in parallel batches
        for (let batchStart = 0; batchStart < totalChunks; batchStart += MAX_PARALLEL) {
            const batchEnd = Math.min(batchStart + MAX_PARALLEL, totalChunks);
            const promises = [];

            for (let chunkIndex = batchStart; chunkIndex < batchEnd; chunkIndex++) {
                const start = chunkIndex * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);

                const formData = new FormData();
                formData.append('chunk', chunk);
                formData.append('chunk_index', chunkIndex.toString());
                formData.append('unique_file_id', uniqueFileId);

                promises.push(
                    fetch(import.meta.env.VITE_BACKEND_SERVICE_ADDRESS + '/stream_upload', {
                        method: 'POST',
                        body: formData
                    }).then(response => {
                        if (!response.ok) {
                            throw new Error(`Failed to upload chunk ${chunkIndex}`);
                        }
                        completedChunks++;
                        console.log(`Uploaded chunk ${completedChunks}/${totalChunks}`);
                        if (typeof onProgress === 'function') {
                            onProgress(completedChunks / totalChunks * 0.8 * 100);
                        }
                        return response;
                    })
                );
            }

            await Promise.all(promises);
        }

        return uniqueFileId;

    } catch (error) {
        console.error('Error uploading file chunks:', error);
        throw error;
    }
};

const combineChunks = async (uniqueFileId, fileName) => {
    try {
        const response = await fetch( import.meta.env.VITE_BACKEND_SERVICE_ADDRESS + '/combine_chunks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                unique_file_id: uniqueFileId,
                file_name: fileName
            })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error combining chunks:', error);
        throw error;
    }
};

const checkIfAnyAudioFileIsPresent = (tracks) => {
    for (let track of tracks){
        if (track.filename){
            return true
        }
    }
    return false
}

// ==================== Bin Conversion Utilities ====================
//
// Labels store bins (display) + time (ground truth).
// Time is computed once at creation/edit and never changes.
// On nfft/hop change, bins are recomputed from stored time.
//
// ===================================================================

const getCorrectionBins = (nfft, hopLength, samplingRate, alpha = 0.44, tau = 1) => {
    const correctionSamples = alpha * (1 - Math.exp(-nfft / (samplingRate * tau))) * samplingRate
    return correctionSamples / hopLength
}

const getCorrectionBinsCQ = (binsPerOctave, minFreq, nBins, hopLength, samplingRate) => {
    const curve_width = (0.5 * binsPerOctave / minFreq)
    const correctionTime = curve_width * Math.pow(2, -nBins / binsPerOctave)
    return correctionTime * samplingRate / hopLength
}

const binToTime = (bin, hopLength, samplingRate) => {
    return bin * hopLength / samplingRate
}

const timeToBin = (time, hopLength, samplingRate) => {
    return time * samplingRate / hopLength
}

// Export: apply correction and convert bins to time
const binsToExportTime = (onsetBin, offsetBin, nfft, hopLength, samplingRate, alpha = 0.44, tau = 1) => {
    const correctionBins = getCorrectionBins(nfft, hopLength, samplingRate, alpha, tau)
    const correctedOnsetBin = onsetBin + correctionBins
    const correctedOffsetBin = offsetBin - correctionBins
    // For very short labels where correction exceeds duration, keep original bins
    // so the exported time still reflects what the annotator clicked
    if (correctedOnsetBin > correctedOffsetBin) {
        return {
            onset: binToTime(onsetBin, hopLength, samplingRate),
            offset: binToTime(offsetBin, hopLength, samplingRate)
        }
    }
    return {
        onset: binToTime(correctedOnsetBin, hopLength, samplingRate),
        offset: binToTime(correctedOffsetBin, hopLength, samplingRate)
    }
}

// Import: convert time values to bins (inverse of export)
const importTimeToBins = (onsetTime, offsetTime, nfft, hopLength, samplingRate, alpha = 0.44, tau = 1) => {
    const correctionBins = getCorrectionBins(nfft, hopLength, samplingRate, alpha, tau)
    return {
        onsetBin: timeToBin(onsetTime, hopLength, samplingRate) - correctionBins,
        offsetBin: timeToBin(offsetTime, hopLength, samplingRate) + correctionBins
    }
}

// Bins to corrected time (always applies correction, no short-label fallback).
// Used to compute the ground truth time stored on labels.
// Round-trip: binsToTime → importTimeToBins is exact.
const binsToTime = (onsetBin, offsetBin, nfft, hopLength, samplingRate) => {
    const corr = getCorrectionBins(nfft, hopLength, samplingRate)
    return {
        onset: binToTime(onsetBin + corr, hopLength, samplingRate),
        offset: binToTime(offsetBin - corr, hopLength, samplingRate)
    }
}

export {excludeNonDigits, generateUniqueId, uploadFileInChunks, combineChunks, checkIfAnyAudioFileIsPresent,
    getCorrectionBins, getCorrectionBinsCQ, binToTime, timeToBin, binsToExportTime, importTimeToBins, binsToTime}