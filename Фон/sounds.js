class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterMusic = null;
        this.masterEffects = null;
        this.loadedBuffers = {}; 
        this.activeSounds = new Set(); 
        this.currentMusicTrack = null;
        
        this.audioMode = 'stereo'; // 'mono', 'stereo', 'surround'
        this.volumes = { music: 0.8, effects: 0.8 };
    }

    init() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            return;
        }
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        this.masterMusic = this.ctx.createGain();
        this.masterEffects = this.ctx.createGain();
        
        this.masterMusic.connect(this.ctx.destination);
        this.masterEffects.connect(this.ctx.destination);
        
        this.setMasterVolume('music', this.volumes.music);
        this.setMasterVolume('effects', this.volumes.effects);
        
        console.log('🔊 Аудио-движок запущен. Режим:', this.audioMode);
    }

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
            console.warn(`Ошибка загрузки звука ${id}:`, e);
        }
    }

    play(id, options = {}) {
        if (!this.ctx || !this.loadedBuffers[id]) {
            console.warn(`Звук "${id}" не загружен или аудио-контекст не инициализирован.`);
            return null;
        }

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

        // --- ПРОСТРАНСТВЕННЫЙ ЗВУК / СТЕРЕО ПАНОРАМА ---
        if (position && this.audioMode !== 'mono' && this.ctx.createPanner) {
            const panner = this.ctx.createPanner();
            
            if (this.audioMode === 'surround') {
                panner.panningModel = 'HRTF';
                panner.distanceModel = 'inverse';
                panner.refDistance = 1;
                panner.maxDistance = 100;
                panner.rolloffFactor = 1;
            } else {
                panner.panningModel = 'equalpower';
            }

            panner.positionX.value = position.x || 0;
            panner.positionY.value = position.y || 0;
            panner.positionZ.value = position.z || 1;
            
            source.connect(panner);
            panner.connect(gainNode);
        } else {
            source.connect(gainNode);
        }

        gainNode.connect(targetBus);
        source.start(0);
        
        this.activeSounds.add(source);
        source.onended = () => {
            this.activeSounds.delete(source);
            try { source.disconnect(); } catch(e) {}
        };
        
        return source;
    }

    stop(source) {
        if (source) {
            try { source.stop(); this.activeSounds.delete(source); } catch(e) {}
        }
    }

    stopAll() {
        this.activeSounds.forEach(source => {
            try { source.stop(); } catch(e) {}
        });
        this.activeSounds.clear();
        this.currentMusicTrack = null;
    }

    setMasterVolume(type, value) {
        this.volumes[type] = value;
        if (!this.ctx) return;
        const bus = type === 'music' ? this.masterMusic : this.masterEffects;
        if (bus && bus.gain) {
            bus.gain.setTargetAtTime(value, this.ctx.currentTime, 0.05);
        }
    }

    setAudioMode(mode) {
        this.audioMode = mode;
        console.log('Режим звука изменен на:', mode);
    }
}

window.SoundsEngine = new SoundEngine();
