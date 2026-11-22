// Фон/settings-manager.js
export const Settings = {
    defaults: {
        masterVolume: 100,   // 0-150
        effectsVolume: 100,  // 0-150
        audioMode: 'dolby',  // 'mono' | 'stereo' | 'dolby' (= Dolby Vertical)
        dolbyIntensity: 100, // всегда 100

        brightness: 100,     // 0-150
        minBrightness: 25,   // 0-50, нижняя граница яркости

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
        this.current.dolbyIntensity = 100;
        this.apply();
    },

    set(key, value) {
        this.current[key] = value;
        if (key === 'dolbyIntensity') this.current.dolbyIntensity = 100;
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
        // 1. Яркость: минимальный порог = НИЖНЯЯ граница диапазона.
        //    Ползунок 0..150 линейно отображается в minBrightness..150,
        //    шаг сжимается пропорционально (при min=10 → 1 пункт ≈ 0.93%).
        const minB = clampNum(this.current.minBrightness ?? 25, 0, 50);
        const base = clampNum(this.current.brightness ?? 100, 0, 150);
        const effective = minB + (base / 150) * (150 - minB);
        document.body.style.filter = `brightness(${(effective / 100).toFixed(3)})`;

        // 2. Звук (множители шин)
        if (window.SoundsEngine) {
            const baseMusic = 0.32;
            const baseEffects = 0.8;
            const musicMult = clampNum(this.current.masterVolume ?? 100, 0, 150) / 100;
            const effectsMult = clampNum(this.current.effectsVolume ?? 100, 0, 150) / 100;
            window.SoundsEngine.setMasterVolume('music', baseMusic * musicMult);
            window.SoundsEngine.setMasterVolume('effects', baseEffects * effectsMult);

            if (this.current.audioMode === 'dolby') {
                window.SoundsEngine.setAudioMode('surround');
            } else if (this.current.audioMode === 'mono') {
                window.SoundsEngine.setAudioMode('mono');
            } else {
                window.SoundsEngine.setAudioMode('stereo');
            }

            if (window.SoundsEngine.setDolbyIntensity) {
                window.SoundsEngine.setDolbyIntensity(100);
            }
        }
    }
};

function clampNum(v, a, b) { return Math.max(a, Math.min(b, Number(v) || 0)); }
