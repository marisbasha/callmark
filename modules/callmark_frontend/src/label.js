class Label {
    constructor(id, trackID, filename, onsetBin, offsetBin, minFreq, maxFreq, species, individual, clustername,
                speciesID, individualID, clusternameID, individualIndex, annotator, color,
                uncertainSpeices, uncertainIndividual, uncertainClustername,
                configSnapshot, originalConfigSnapshot, onsetTime, offsetTime
            ) {
        if (uncertainSpeices === undefined || uncertainIndividual === undefined || uncertainClustername === undefined) {
            throw new Error('uncertainSpeices, uncertainIndividual, and uncertainClustername must be explicitly provided')
        }
        this.id = id
        this.trackID = trackID
        this.filename = filename
        this.onsetBin = onsetBin
        this.offsetBin = offsetBin
        this.minFreq = minFreq
        this.maxFreq = maxFreq
        this.species = species
        this.individual = individual
        this.clustername = clustername
        this.speciesID = speciesID
        this.individualID = individualID
        this.clusternameID = clusternameID
        this.individualIndex = individualIndex
        this.annotator = annotator
        this.color = color
        this.uncertainSpeices = uncertainSpeices
        this.uncertainIndividual = uncertainIndividual
        this.uncertainClustername = uncertainClustername
        this.configSnapshot = configSnapshot ? { ...configSnapshot } : {}
        // originalConfigSnapshot: the config at the time the label was first created or imported.
        // Used on export to convert bins back to original hop space for stable CSV output.
        this.originalConfigSnapshot = originalConfigSnapshot ? { ...originalConfigSnapshot } : { ...this.configSnapshot }
        // Ground truth corrected time — computed once at creation/edit, never changes on config switch.
        // On nfft change, bins are recomputed from these via importTimeToBins.
        this.onsetTime = onsetTime
        this.offsetTime = offsetTime
    }
}

export { Label }
