// Фон/sounds.js
// Realitic Atmosphere — звуковой движок (сервисный блок, не знает о других блоках).
// Публичный API: init, loadSound, play, stop, stopAll, setMasterVolume, setAudioMode, setDolbyIntensity.
// Управление обработкой на каждый вызов: type ('music'|'effects'), dolby (только music),
// modeOverride ('mono'|'stereo'|'dolby' — принудительно для ЛЮБОГО типа), panSweep, channelGains, tailFade.

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterMusic = null;
        this.masterEffects = null;
        this.loadedBuffers = {};
        this.activeSounds = new Set();
        this.currentMusicTrack = null;

        this.audioMode = 'stereo';
        this.volumes = { music: 0.32, effects: 0.8 };
        this.dolbyIntensity = 100;

        this.convolver = null;
        this.reverbGain = null;

        this._verticalImpulse = null;
        this._dolbyGraphs = new Set();
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

        this.convolver = this.ctx.createConvolver();
        this.reverbGain = this.ctx.createGain();
        const rate = this.ctx.sampleRate;
        const length = rate * 2.5;
        const impulse = this.ctx.createBuffer(2, length, rate);
        for (let i = 0; i < 2; i++) {
            const channel = impulse.getChannelData(i);
            for (let j = 0; j < length; j++) {
                channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, 2.5);
            }
        }
        this.convolver.buffer = impulse;
        this.convolver.connect(this.reverbGain);
        this.reverbGain.connect(this.masterEffects);
        this.reverbGain.gain.value = 0.3;

        this.setMasterVolume('music', this.volumes.music);
        this.setMasterVolume('effects', this.volumes.effects);
    }

    async loadSound(id, source) {
        if (!this.ctx) return;
        try {
            let arrayBuffer;
            if (source instanceof Blob) arrayBuffer = await source.arrayBuffer();
            else {
                const response = await fetch(source);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                arrayBuffer = await response.arrayBuffer();
            }
            this.loadedBuffers[id] = await this.ctx.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.warn(`Ошибка загрузки звука ${id}:`, e);
        }
    }

    // ==================== VERTICAL DOLBY (1:1 анализатор, интенсивность 100) ====================
    _dolbyParams(intensity) {
        const i = intensity / 100;
        return {
            sideGain: 0.2 + i * 0.7,  midGain: 0.8 - i * 0.35,
            topShelf: 2 + i * 10,     bottomShelf: 1 + i * 7,
            surround: i * 0.4,        topDelay: 0.0001 + i * 0.0006,
            bottomDelay: 0.0001,      phaseQ: 0.3 + i * 1.2
        };
    }

    _getVerticalImpulse() {
        if (this._verticalImpulse) return this._verticalImpulse;
        const sr = this.ctx.sampleRate;
        const len = Math.floor(sr * 1.2);
        const imp = this.ctx.createBuffer(2, len, sr);
        for (let c = 0; c < 2; c++) {
            const d = imp.getChannelData(c);
            for (let j = 0; j < len; j++) d[j] = (Math.random() * 2 - 1) * Math.exp(-j / (sr * 0.2));
        }
        this._verticalImpulse = imp;
        return imp;
    }

    _buildVerticalDolby(input, output) {
        const ctx = this.ctx;
        const p = this._dolbyParams(this.dolbyIntensity);
        const splitter = ctx.createChannelSplitter(2);
        const merger = ctx.createChannelMerger(2);
        const midGain = ctx.createGain();  midGain.gain.value = p.midGain;
        const sideGain = ctx.createGain(); sideGain.gain.value = p.sideGain;
        const inv = ctx.createGain();      inv.gain.value = -1;
        const topShelf = ctx.createBiquadFilter(); topShelf.type='highshelf'; topShelf.frequency.value=4000; topShelf.gain.value=p.topShelf;
        const bottomShelf = ctx.createBiquadFilter(); bottomShelf.type='lowshelf'; bottomShelf.frequency.value=250; bottomShelf.gain.value=p.bottomShelf;
        const topDelay = ctx.createDelay(0.01); topDelay.delayTime.value=p.topDelay;
        const bottomDelay = ctx.createDelay(0.01); bottomDelay.delayTime.value=p.bottomDelay;
        const topGain = ctx.createGain();
        const bottomGain = ctx.createGain();
        const surroundSend = ctx.createGain(); surroundSend.gain.value=p.surround;
        const convolver = ctx.createConvolver(); convolver.buffer=this._getVerticalImpulse(); convolver.normalize=true;
        const apTop = ctx.createBiquadFilter(); apTop.type='allpass'; apTop.frequency.value=1200; apTop.Q.value=p.phaseQ;
        const apBot = ctx.createBiquadFilter(); apBot.type='allpass'; apBot.frequency.value=1200; apBot.Q.value=p.phaseQ;

        input.connect(splitter);
        splitter.connect(midGain, 0); splitter.connect(midGain, 1);
        splitter.connect(sideGain, 0); splitter.connect(inv, 1); inv.connect(sideGain);
        sideGain.connect(topShelf); topShelf.connect(topDelay); topDelay.connect(topGain);
        midGain.connect(bottomShelf); bottomShelf.connect(bottomDelay); bottomDelay.connect(bottomGain);
        sideGain.connect(surroundSend); surroundSend.connect(convolver); convolver.connect(topGain);
        topGain.connect(apTop); apTop.connect(merger, 0, 0);
        bottomGain.connect(apBot); apBot.connect(merger, 0, 1);
        merger.connect(output);

        const nodes = [splitter, merger, midGain, sideGain, inv, topShelf, bottomShelf,
                       topDelay, bottomDelay, topGain, bottomGain, surroundSend, convolver, apTop, apBot];
        const graph = {
            apply: (intensity) => {
                const q = this._dolbyParams(intensity);
                const t = ctx.currentTime, tau = 0.03;
                sideGain.gain.setTargetAtTime(q.sideGain, t, tau);
                midGain.gain.setTargetAtTime(q.midGain, t, tau);
                topShelf.gain.setTargetAtTime(q.topShelf, t, tau);
                bottomShelf.gain.setTargetAtTime(q.bottomShelf, t, tau);
                surroundSend.gain.setTargetAtTime(q.surround, t, tau);
                topDelay.delayTime.setTargetAtTime(q.topDelay, t, tau);
                apTop.Q.setTargetAtTime(q.phaseQ, t, tau);
                apBot.Q.setTargetAtTime(q.phaseQ, t, tau);
            },
            destroy: () => { nodes.forEach(n => { try { n.disconnect(); } catch (e) {} }); this._dolbyGraphs.delete(graph); }
        };
        this._dolbyGraphs.add(graph);
        return graph;
    }

    _buildMono(input, output) {
        const ctx = this.ctx;
        const splitter = ctx.createChannelSplitter(2);
        const merger = ctx.createChannelMerger(2);
        const mg = ctx.createGain(); mg.gain.value = 0.5;
        input.connect(splitter);
        splitter.connect(mg, 0); splitter.connect(mg, 1);
        mg.connect(merger, 0, 0); mg.connect(merger, 0, 1);
        merger.connect(output);
        const nodes = [splitter, merger, mg];
        return { apply() {}, destroy: () => nodes.forEach(n => { try { n.disconnect(); } catch (e) {} }) };
    }

    // ==================== ВОСПРОИЗВЕДЕНИЕ ====================
    play(id, options = {}) {
        if (!this.ctx || !this.loadedBuffers[id]) return null;

        const {
            loop = false, type = 'effects', volume = 1.0, position = null, pan = 0,
            reverb = false, dolby = false, dolbyMode = 'none',
            modeOverride = null,      // принудительный режим для ЛЮБОГО типа
            panSweep = false,         // панорама L→R на всю длительность
            channelGains = null,      // [L, R] — баланс каналов (для демо)
            tailFade = 0,             // сек: плавное затухание в конце
            loopEndOffset = 0, offset = 0
        } = options;

        const buffer = this.loadedBuffers[id];
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        if (loop) {
            source.loop = true;
            source.loopStart = 0;
            source.loopEnd = Math.max(0.1, buffer.duration - loopEndOffset);
        }

        const gainNode = this.ctx.createGain();
        gainNode.gain.value = volume;
        const targetBus = type === 'music' ? this.masterMusic : this.masterEffects;
        const chain = [gainNode];

        // хвост-фейд
        if (tailFade > 0 && !loop && buffer.duration > tailFade) {
            const t0 = this.ctx.currentTime;
            gainNode.gain.setValueAtTime(volume, t0 + buffer.duration - tailFade);
            gainNode.gain.linearRampToValueAtTime(0.0001, t0 + buffer.duration);
        }

        // собираем хвост цепи: gainNode ← panner ← channelGains ← режим-граф ← source
        let endNode = gainNode;
        let panner = null;
        if (panSweep && this.ctx.createStereoPanner) {
            panner = this.ctx.createStereoPanner();
            panner.connect(gainNode);
            endNode = panner;
            chain.push(panner);
        }
        let cg = null;
        if (Array.isArray(channelGains) && channelGains.length === 2) {
            const gL = this.ctx.createGain(); gL.gain.value = channelGains[0];
            const gR = this.ctx.createGain(); gR.gain.value = channelGains[1];
            const mg = this.ctx.createChannelMerger(2);
            gL.connect(mg, 0, 0); gR.connect(mg, 0, 1);
            mg.connect(endNode);
            cg = { gL, gR };
            endNode = null; // режим-граф будет кормить gL и gR отдельно
            chain.push(gL, gR, mg);
        }

        const effectiveMode = modeOverride || (type === 'music' ? this.audioMode : null);
        const modeIsDolby = effectiveMode && ['dolby', 'surround', 'dolby-vertical'].includes(effectiveMode);
        const wantDolby = (type === 'music' && (dolby === true || dolbyMode === 'vertical-dolby' || dolbyMode === 'vertical-stereo' || modeIsDolby))
                       || (type !== 'music' && modeIsDolby); // эффекты — только явный modeOverride

        let modeGraph = null;
        if (cg) {
            if (wantDolby) {
                // граф → оба канальных гейна
                const tmp = this.ctx.createGain();
                modeGraph = this._buildVerticalDolby(source, tmp);
                tmp.connect(cg.gL); tmp.connect(cg.gR);
                chain.push(tmp);
            } else if (effectiveMode === 'mono') {
                const tmp = this.ctx.createGain();
                modeGraph = this._buildMono(source, tmp);
                tmp.connect(cg.gL); tmp.connect(cg.gR);
                chain.push(tmp);
            } else {
                source.connect(cg.gL); source.connect(cg.gR);
            }
        } else if (wantDolby) {
            modeGraph = this._buildVerticalDolby(source, endNode);
        } else if (effectiveMode === 'mono') {
            modeGraph = this._buildMono(source, endNode);
        } else {
            source.connect(endNode);
        }

        // эффекты: пространственность (dolby:true у эффектов игнорируется — правило проекта)
        if (type === 'effects' && !modeOverride) {
            if (pan !== 0 && this.ctx.createStereoPanner) {
                const sp = this.ctx.createStereoPanner();
                sp.pan.value = Math.max(-1, Math.min(1, pan));
                source.disconnect();
                source.connect(sp); sp.connect(gainNode);
                chain.push(sp);
            }
            gainNode.connect(targetBus);
            if (reverb) {
                const delayNode = this.ctx.createDelay(); delayNode.delayTime.value = 0.28;
                const feedbackGain = this.ctx.createGain(); feedbackGain.gain.value = 0.35;
                const filterNode = this.ctx.createBiquadFilter(); filterNode.type='lowpass'; filterNode.frequency.value=1200;
                gainNode.connect(delayNode);
                delayNode.connect(filterNode); filterNode.connect(feedbackGain);
                feedbackGain.connect(delayNode); feedbackGain.connect(targetBus);
                chain.push(delayNode, feedbackGain, filterNode);
            }
        } else {
            gainNode.connect(targetBus);
        }

        if (panSweep && panner) {
            const t0 = this.ctx.currentTime;
            panner.pan.setValueAtTime(-1, t0);
            panner.pan.linearRampToValueAtTime(1, t0 + Math.max(0.2, buffer.duration));
        }

        source.start(0, offset);
        this.activeSounds.add(source);
        source.onended = () => {
            this.activeSounds.delete(source);
            try { source.disconnect(); } catch (e) {}
            chain.forEach(n => { try { n.disconnect(); } catch (e) {} });
            if (modeGraph) modeGraph.destroy();
        };
        return source;
    }

    stop(source) {
        if (source) { try { source.stop(); this.activeSounds.delete(source); } catch (e) {} }
    }

    stopAll() {
        this.activeSounds.forEach(s => { try { s.stop(); } catch (e) {} });
        this.activeSounds.clear();
        this._dolbyGraphs.forEach(g => g.destroy());
        this.currentMusicTrack = null;
    }

    setMasterVolume(type, value) {
        this.volumes[type] = value;
        if (!this.ctx) return;
        const bus = type === 'music' ? this.masterMusic : this.masterEffects;
        if (bus && bus.gain) bus.gain.setTargetAtTime(value, this.ctx.currentTime, 0.05);
    }

    setAudioMode(mode) {
        if (mode === 'surround' || mode === 'dolby-vertical') mode = 'dolby';
        this.audioMode = mode;
    }

    setDolbyIntensity(value) {
        this.dolbyIntensity = Math.max(0, Math.min(100, Number(value) || 0));
        this._dolbyGraphs.forEach(g => g.apply(this.dolbyIntensity));
    }
}

window.SoundsEngine = new SoundEngine();
