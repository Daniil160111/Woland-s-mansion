// js/sounds.js

// Защита от копирования и выделений
(function() {
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('dragstart', e => e.preventDefault());
    document.addEventListener('selectstart', e => e.preventDefault());
    document.addEventListener('copy', e => e.preventDefault());
    document.addEventListener('cut', e => e.preventDefault());
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey && ['c','s','u'].includes(e.key.toLowerCase())) || e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) e.preventDefault();
    });
    document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
})();

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterMusic = null;
        this.masterEffects = null;
        this.loadedBuffers = {}; 
        this.activeSounds = new Set(); 
        this.currentMusicTrack = null;
        
        this.audioMode = 'stereo';
        this.volumes = { music: 0.8, effects: 0.8 };
    }

    init() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
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
        if (!this.ctx || !this.loadedBuffers[id]) return null;

        const { 
            loop = false, 
            type = 'effects', 
            volume = 1.0, 
            position = null,
            pan = 0,       // НОВОЕ: стерео панорама (-1 лево, 1 право)
            reverb = false 
        } = options;

        const source = this.ctx.createBufferSource();
        source.buffer = this.loadedBuffers[id];
        source.loop = loop;

        const gainNode = this.ctx.createGain();
        gainNode.gain.value = volume;

        const targetBus = type === 'music' ? this.masterMusic : this.masterEffects;

        let lastNode = source;

        // --- ПРОСТРАНСТВЕННЫЙ ЗВУК (Позиция) ---
        if (position && this.audioMode !== 'mono' && this.ctx.createPanner) {
            const panner = this.ctx.createPanner();
            panner.panningModel = 'equalpower';
            panner.positionX.value = position.x || 0;
            panner.positionY.value = position.y || 0;
            panner.positionZ.value = position.z || 1;
            
            lastNode.connect(panner);
            lastNode = panner;
        } 
        // --- СТЕРЕО ПАНОРАМА (если задан pan) ---
        else if (pan !== 0 && this.ctx.createStereoPanner) {
            const stereoPanner = this.ctx.createStereoPanner();
            stereoPanner.pan.value = Math.max(-1, Math.min(1, pan));
            lastNode.connect(stereoPanner);
            lastNode = stereoPanner;
        }

        // --- ЭФФЕКТ РЕВЕРБЕРАЦИИ (ЭХО) ---
        if (reverb && type === 'effects') {
            const delayNode = this.ctx.createDelay();
            delayNode.delayTime.value = 0.28;

            const feedbackGain = this.ctx.createGain();
            feedbackGain.gain.value = 0.35;

            const filterNode = this.ctx.createBiquadFilter();
            filterNode.type = 'lowpass';
            filterNode.frequency.value = 1200;

            lastNode.connect(gainNode);
            gainNode.connect(targetBus);

            gainNode.connect(delayNode);
            delayNode.connect(filterNode);
            filterNode.connect(feedbackGain);
            feedbackGain.connect(delayNode);
            feedbackGain.connect(targetBus);
        } else {
            lastNode.connect(gainNode);
            gainNode.connect(targetBus);
        }

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
    }
}

window.SoundsEngine = new SoundEngine();
