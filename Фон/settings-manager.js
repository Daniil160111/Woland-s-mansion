// Фон/settings-manager.js
export const Settings = {
    defaults: {
        // Звук
        masterVolume: 100,   // 0-150 (множитель)
        effectsVolume: 100,  // 0-150 (множитель)
        audioMode: 'dolby',  // 'mono' | 'stereo' | 'dolby' (= Dolby Vertical)
        dolbyIntensity: 100, // 0-100, интенсивность объёма Vertical Dolby

        // Яркость
        brightness: 100,
        minBrightness: 25,

        // Графика
        aspectRatio: 'auto',
        shadows: 'medium',
        realisticLight: 'medium',
        render3D: 'high',
        textureQuality: 'high',
        drawDistance: 'far'
    },

    current: {},

    init() {
        const saved = localStorage.getItem('woland_settings');
        this.current = saved ? JSON.parse(saved) : { ...this.defaults };
        if (this.current.dolbyIntensity === undefined) this.current.dolbyIntensity = this.defaults.dolbyIntensity;
        this.apply();
    },

    set(key, value) {
        this.current[key] = value;
        this.apply();
    },

    save() {
        localStorage.setItem('woland_settings', JSON.stringify(this.current));
        console.log('[Settings] Сохранено');
    },

    reset() {
        this.current = { ...this.defaults };
        localStorage.removeItem('woland_settings');
        this.apply();
        console.log('[Settings] Сброшено к заводским');
    },

    resetCategory(category) {
        const categoryKeys = {
            audio: ['masterVolume', 'effectsVolume', 'audioMode', 'dolbyIntensity'],
            brightness: ['brightness', 'minBrightness'],
            graphics: ['aspectRatio', 'shadows', 'realisticLight', 'render3D', 'textureQuality', 'drawDistance']
        };
        if (categoryKeys[category]) {
            categoryKeys[category].forEach(key => { this.current[key] = this.defaults[key]; });
            this.save();
            this.apply();
        }
    },

    apply() {
        // 1. Яркость
        const baseBrightness = this.current.brightness;
        const minBrightness = this.current.minBrightness;
        const finalBrightness = baseBrightness === 0 ? minBrightness : baseBrightness;
        document.body.style.filter = `brightness(${(finalBrightness / 100).toFixed(2)})`;

        // 2. Звук (множители)
        if (window.SoundsEngine) {
            const baseMusic = 0.32;
            const baseEffects = 0.8;
            const musicMult = this.current.masterVolume / 100;
            const effectsMult = this.current.effectsVolume / 100;
            window.SoundsEngine.setMasterVolume('music', baseMusic * musicMult);
            window.SoundsEngine.setMasterVolume('effects', baseEffects * effectsMult);

            if (this.current.audioMode === 'dolby') {
                window.SoundsEngine.setAudioMode('surround'); // движок понимает как Vertical Dolby
            } else if (this.current.audioMode === 'mono') {
                window.SoundsEngine.setAudioMode('mono');
            } else {
                window.SoundsEngine.setAudioMode('stereo');
            }

            // Интенсивность Vertical Dolby
            if (window.SoundsEngine.setDolbyIntensity) {
                window.SoundsEngine.setDolbyIntensity(this.current.dolbyIntensity ?? 100);
            }
        }
    }
};
