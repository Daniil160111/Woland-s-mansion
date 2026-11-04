// js/settings-manager.js

export const Settings = {
    // Заводские настройки
    defaults: {
        audioMode: 'stereo',   // 'mono' | 'stereo' | 'surround'
        language: 'auto',      // 'auto' | 'ru' | 'en' | 'fr' | 'es' | 'it'
        volumeMusic: 80,       // 0-100
        volumeEffects: 80,     // 0-100
        brightness: 100,       // 0-150
        vibration: true,       // true | false
    },

    current: {},

    init() {
        // Загружаем из памяти или ставим дефолт
        const saved = localStorage.getItem('woland_settings');
        this.current = saved ? JSON.parse(saved) : { ...this.defaults };

        // Определяем язык, если стоит 'auto'
        if (this.current.language === 'auto') {
            this.current.language = this.detectSystemLanguage();
        }

        this.apply();
    },

    detectSystemLanguage() {
        const lang = navigator.language.slice(0, 2).toLowerCase();
        const supported = ['ru', 'en', 'fr', 'es', 'it'];
        return supported.includes(lang) ? lang : 'en';
    },

    set(key, value) {
        this.current[key] = value;
        localStorage.setItem('woland_settings', JSON.stringify(this.current));
        this.apply();
    },

    apply() {
        // Применяем яркость ко всему документу
        document.body.style.filter = `brightness(${this.current.brightness}%)`;
        
        // Сообщаем движку звука о новых настройках
        if (window.SoundsEngine) {
            window.SoundsEngine.setMasterVolume('music', this.current.volumeMusic / 100);
            window.SoundsEngine.setMasterVolume('effects', this.current.volumeEffects / 100);
            window.SoundsEngine.setAudioMode(this.current.audioMode);
        }
        
        // Здесь позже будет смена языка (для интерфейса)
        console.log(`[Settings] Язык: ${this.current.language}, Яркость: ${this.current.brightness}%`);
    }
};