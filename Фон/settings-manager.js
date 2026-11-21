// Фон/settings-manager.js

export const Settings = {
    // Заводские (рекомендуемые) настройки
    defaults: {
        // Звук
        masterVolume: 100,   // 0-150
        effectsVolume: 100,  // 0-150
        audioMode: 'dolby',  // 'mono', 'stereo', 'dolby'
        
        // Яркость
        brightness: 100,       // 0-150
        minBrightness: 25,     // 0-50
        
        // Графика
        aspectRatio: 'auto',   // 'auto', '4:3', '16:9', '20:9', '21:9', '16:10'
        shadows: 'medium',     // 'ultra', 'high', 'medium', 'low', 'simple', 'off'
        realisticLight: 'medium', // 'ultra', 'high', 'medium', 'low'
        render3D: 'high',      // 'no_distortion', 'ultra', 'high', 'medium', 'low'
        textureQuality: 'high',// 'ultra', 'high', 'medium', 'low'
        drawDistance: 'far'    // 'no_simplification', 'far', 'near', 'close'
    },

    current: {},

    init() {
        const saved = localStorage.getItem('woland_settings');
        this.current = saved ? JSON.parse(saved) : { ...this.defaults };

        // Применяем настройки при запуске
        this.apply();
    },

    set(key, value) {
        this.current[key] = value;
        // Применение происходит только при нажатии "Сохранить", 
        // но визуальные (яркость, звук) можно менять сразу
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

    // Сброс только одной категории к рекомендуемым
    resetCategory(category) {
        const categoryKeys = {
            audio: ['masterVolume', 'effectsVolume', 'audioMode'],
            brightness: ['brightness', 'minBrightness'],
            graphics: ['aspectRatio', 'shadows', 'realisticLight', 'render3D', 'textureQuality', 'drawDistance']
        };
        
        if (categoryKeys[category]) {
            categoryKeys[category].forEach(key => {
                this.current[key] = this.defaults[key];
            });
            this.save();
            this.apply();
        }
    },

    apply() {
        // 1. Применяем яркость (CSS-фильтр ко всему body)
        const baseBrightness = this.current.brightness;
        const minBrightness = this.current.minBrightness;
        
        // Если игрок выкрутил яркость на 0, применяем минимальную
        const finalBrightness = baseBrightness === 0 ? minBrightness : baseBrightness;
        
        // Переводим 0-150 в 0.0-1.5 для CSS
        const brightnessCss = (finalBrightness / 100).toFixed(2);
        document.body.style.filter = `brightness(${brightnessCss})`;

        // 2. Применяем звук
        if (window.SoundsEngine) {
            window.SoundsEngine.setMasterVolume('music', (this.current.masterVolume / 100) * 0.32);
            window.SoundsEngine.setMasterVolume('effects', (this.current.effectsVolume / 100) * 0.8);
            
            // Режим звука
            if (this.current.audioMode === 'dolby') {
                window.SoundsEngine.setAudioMode('surround');
            } else if (this.current.audioMode === 'mono') {
                window.SoundsEngine.setAudioMode('mono');
            } else {
                window.SoundsEngine.setAudioMode('stereo');
            }
        }

        // 3. Соотношение сторон (визуально)
        const canvas = document.getElementById('renderCanvas'); // Если Babylon.js
        if (canvas) {
            // Тут будет логика для Babylon.js (сброс соотношения сторон)
        }

        // Логирование для отладки
        console.log('[Settings] Применено:', {
            brightness: brightnessCss,
            masterVol: this.current.masterVolume,
            effectsVol: this.current.effectsVolume,
            audioMode: this.current.audioMode
        });
    }
};
