// js/sounds.js

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterMusic = null;
        this.masterEffects = null;
        this.loadedBuffers = {}; // Хранилище декодированных файлов
        this.activeSounds = new Set(); // Для отслеживания и остановки
        this.audioMode = 'stereo';
    }

    // Инициализация (должна вызываться по клику пользователя)
    init() {
        if (this.ctx) return;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        // Создаем шины громкости
        this.masterMusic = this.ctx.createGain();
        this.masterEffects = this.ctx.createGain();
        
        this.masterMusic.connect(this.ctx.destination);
        this.masterEffects.connect(this.ctx.destination);
        
        console.log('🔊 Аудио-движок запущен');
    }

    // Загрузка файла (вызывается из загрузчика в index.html)
    async loadSound(id, path) {
        if (!this.ctx) return;
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            
            // Декодируем звук (это долгий процесс, поэтому делаем это заранее)
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.loadedBuffers[id] = audioBuffer;
        } catch (e) {
            console.error(`Ошибка загрузки звука ${id} (${path}):`, e);
        }
    }

    // Воспроизведение звука по ID
    play(id, options = {}) {
        if (!this.ctx || !this.loadedBuffers[id]) {
            console.warn(`Звук ${id} не загружен или аудио-движок не инициализирован.`);
            return;
        }

        const { loop = false, type = 'effects', position = null, volume = 1.0 } = options;

        const source = this.ctx.createBufferSource();
        source.buffer = this.loadedBuffers[id];
        source.loop = loop;

        let gainNode = this.ctx.createGain();
        gainNode.gain.value = volume;

        // Маршрутизация (музыка или эффекты)
        const targetBus = type === 'music' ? this.masterMusic : this.masterEffects;

        // Пространственный звук (3D)
        if (position && this.audioMode !== 'mono') {
            const panner = this.ctx.createPanner();
            panner.panningModel = this.audioMode === 'surround' ? 'HRTF' : 'equalpower';
            panner.positionX.value = position.x;
            panner.positionY.value = position.y;
            panner.positionZ.value = position.z;
            
            source.connect(panner);
            panner.connect(gainNode);
        } else {
            // Обычный стерео/моно звук
            source.connect(gainNode);
        }

        gainNode.connect(targetBus);
        source.start(0);
        
        this.activeSounds.add(source);
        source.onended = () => this.activeSounds.delete(source);
        
        return source; // Возвращаем, чтобы можно было остановить конкретный звук
    }

    // Остановить всё
    stopAll() {
        this.activeSounds.forEach(source => {
            try { source.stop(); } catch(e) {}
        });
        this.activeSounds.clear();
    }

    // Управление громкостью (0.0 - 1.0)
    setMasterVolume(type, value) {
        if (!this.ctx) return;
        const bus = type === 'music' ? this.masterMusic : this.masterEffects;
        bus.gain.setTargetAtTime(value, this.ctx.currentTime, 0.1);
    }

    // Переключение режима
    setAudioMode(mode) {
        this.audioMode = mode;
    }
}

// Создаем глобальный экземпляр, чтобы он был доступен везде
window.SoundsEngine = new SoundEngine();