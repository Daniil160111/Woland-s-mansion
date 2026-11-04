// js/sounds.js

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterMusic = null;
        this.masterEffects = null;
        this.loadedBuffers = {}; 
        this.activeSounds = new Set(); 
        
        // Настройки по умолчанию
        this.audioMode = 'stereo'; // 'mono', 'stereo', 'surround'
        this.volumes = { music: 0.8, effects: 0.8 };
    }

    // Инициализация (строго после клика пользователя)
    init() {
        if (this.ctx) return;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        // Создаем две независимые шины громкости
        this.masterMusic = this.ctx.createGain();
        this.masterEffects = this.ctx.createGain();
        
        this.masterMusic.connect(this.ctx.destination);
        this.masterEffects.connect(this.ctx.destination);
        
        // Применяем текущие настройки громкости
        this.setMasterVolume('music', this.volumes.music);
        this.setMasterVolume('effects', this.volumes.effects);
        
        console.log('🔊 Аудио-движок запущен. Режим:', this.audioMode);
    }

    // Загрузка и декодирование звука (принимает строку пути или Blob из кэша)
    async loadSound(id, source) {
        if (!this.ctx) return;
        try {
            let arrayBuffer;
            if (source instanceof Blob) {
                arrayBuffer = await source.arrayBuffer();
            } else {
                const response = await fetch(source);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                arrayBuffer = await response.arrayBuffer();
            }
            
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.loadedBuffers[id] = audioBuffer;
        } catch (e) {
            console.error(`Ошибка загрузки звука ${id}:`, e);
        }
    }

    // Воспроизведение
    play(id, options = {}) {
        if (!this.ctx || !this.loadedBuffers[id]) {
            console.warn(`Звук "${id}" не найден или движок не запущен.`);
            return null;
        }

        // Параметры по умолчанию: тип 'effects', громкость 1.0, позиция null
        const { 
            loop = false, 
            type = 'effects', 
            volume = 1.0, 
            position = null 
        } = options;

        const source = this.ctx.createBufferSource();
        source.buffer = this.loadedBuffers[id];
        source.loop = loop;

        const gainNode = this.ctx.createGain();
        gainNode.gain.value = volume;

        const targetBus = type === 'music' ? this.masterMusic : this.masterEffects;

        // --- ПРОСТРАНСТВЕННЫЙ ЗВУК ---
        if (position && this.audioMode !== 'mono') {
            const panner = this.ctx.createPanner();
            
            // Настройка Spatial Audio
            if (this.audioMode === 'surround') {
                // HRTF - настоящий 3D-звук (1:1 как в играх)
                panner.panningModel = 'HRTF';
                panner.distanceModel = 'inverse';
                panner.refDistance = 1;
                panner.maxDistance = 100;
                panner.rolloffFactor = 1;
            } else {
                // Обычное стерео (просто лево/право)
                panner.panningModel = 'equalpower';
            }

            // Установка координат (x, y, z)
            panner.positionX.value = position.x || 0;
            panner.positionY.value = position.y || 0;
            panner.positionZ.value = position.z || 0;
            
            source.connect(panner);
            panner.connect(gainNode);
        } else {
            // Плоский звук (если моно или нет позиции)
            source.connect(gainNode);
        }

        gainNode.connect(targetBus);
        source.start(0);
        
        this.activeSounds.add(source);
        source.onended = () => {
            this.activeSounds.delete(source);
            source.disconnect();
        };
        
        return source; // Возвращаем, чтобы можно было остановить конкретный звук (например, зацикленный)
    }

    // Остановить один конкретный звук
    stop(source) {
        if (source) {
            try { source.stop(); } catch(e) {}
        }
    }

    // Остановить вообще всё (например, при переходе в меню)
    stopAll() {
        this.activeSounds.forEach(source => {
            try { source.stop(); } catch(e) {}
        });
        this.activeSounds.clear();
    }

    // Управление громкостью (0.0 - 1.0)
    setMasterVolume(type, value) {
        this.volumes[type] = value;
        if (!this.ctx) return;
        const bus = type === 'music' ? this.masterMusic : this.masterEffects;
        // setTargetAtTime делает плавное изменение (без щелчков)
        bus.gain.setTargetAtTime(value, this.ctx.currentTime, 0.1);
    }

    // Переключение режима (вызывается из settings-manager.js)
    setAudioMode(mode) {
        this.audioMode = mode;
        console.log('Режим звука изменен на:', mode);
    }
}

// Создаем единый экземпляр для всей игры
window.SoundsEngine = new SoundEngine();
