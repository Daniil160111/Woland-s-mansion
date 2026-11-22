// Фон/sounds.js
// Realitic Atmosphere — звуковой движок (сервисный блок).
// Не знает о других блоках: только публичный API и параметры вызова.

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterMusic = null;
        this.masterEffects = null;
        this.loadedBuffers = {};
        this.activeSounds = new Set();
        this.currentMusicTrack = null; // строка-id, управляется вызывающим блоком

        this.audioMode = 'stereo';
        this.volumes = { music: 0.32, effects: 0.8 };
        this.dolbyIntensity = 100;

        this.convolver = null;      // реверб ЭФФЕКТОВ (не трогается музыкой)
        this.reverbGain = null;

        this._verticalImpulse = null;   // отдельный импульс Vertical Dolby
        this._dolbyGraphs = new Set();  // живые графы для live-интенсивности
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
            if (source instanceof Blob) {
                arrayBuffer = await source.arrayBuffer();
            } else {
                const response = await fetch(source);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                arrayBuffer = await response.arrayBuffer();
            }
            this.loadedBuffers[id] = await this.ctx.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.warn(`Ошибка загрузки звука ${id}:`, e);
        }
    }

    // ==================== VERTICAL DOLBY (1:1 из анализатора) ====================
    _dolbyParams(intensity) {
        const i = intensity / 100;
        return {
            sideGain:   0.2 + i * 0.7,
            midGain:    0.8 - i * 0.35,
            topShelf:   2 + i * 10,
            bottomShelf:1 + i * 7,
            surround:   i * 0.4,
            topDelay:   0.0001 + i * 0.0006,
            bottomDelay:0.0001,
            phaseQ:     0.3 + i * 1.2
        };
    }

    _getVerticalImpulse() {
        if (this._verticalImpulse) return this._verticalImpulse;
        const sr = this.ctx.sampleRate;
        const len = Math.floor(sr * 1.2);
        const imp = this.ctx.createBuffer(2, len, sr);
        for (let c = 0; c < 2; c++) {
            const d = imp.getChannelData(c);
            for (let j = 0; j < len; j++) {
                d[j] = (Math.random() * 2 - 1) * Math.exp(-j / (sr * 0.2));
            }
        }
        this._verticalImpulse = imp;
        return imp;
    }

    // Граф: input → splitter → [Mid/Side] → shelf → delay → gain → allpass → merger → output
    _buildVerticalDolby(input, output) {
        const ctx = this.ctx;
        const p = this._dolbyParams(this.dolbyIntensity);

        const splitter = ctx.createChannelSplitter(2);
        const merger = ctx.createChannelMerger(2);
        const midGain = ctx.createGain();   midGain.gain.value = p.midGain;
        const sideGain = ctx.createGain();  sideGain.gain.value = p.sideGain;
        const inv = ctx.createGain();       inv.gain.value = -1;

        const topShelf = ctx.createBiquadFilter();
        topShelf.type = 'highshelf'; topShelf.frequency.value = 4000; topShelf.gain.value = p.topShelf;
        const bottomShelf = ctx.createBiquadFilter();
        bottomShelf.type = 'lowshelf'; bottomShelf.frequency.value = 250; bottomShelf.gain.value = p.bottomShelf;

        const topDelay = ctx.createDelay(0.01);    topDelay.delayTime.value = p.topDelay;
        const bottomDelay = ctx.createDelay(0.01); bottomDelay.delayTime.value = p.bottomDelay;
        const topGain = ctx.createGain();
        const bottomGain = ctx.createGain();

        const surroundSend = ctx.createGain(); surroundSend.gain.value = p.surround;
        const convolver = ctx.createConvolver();
        convolver.buffer = this._getVerticalImpulse();
        convolver.normalize = true;

        const apTop = ctx.createBiquadFilter();
        apTop.type = 'allpass'; apTop.frequency.value = 1200; apTop.Q.value = p.phaseQ;
        const apBot = ctx.createBiquadFilter();
        apBot.type = 'allpass'; apBot.frequency.value = 1200; apBot.Q.value = p.phaseQ;

        input.connect(splitter);
        // Mid = L+R → низ; Side = L−R → верх
        splitter.connect(midGain, 0);
        splitter.connect(midGain, 1);
        splitter.connect(sideGain, 0);
        splitter.connect(inv, 1);
        inv.connect(sideGain);

        sideGain.connect(topShelf);
        topShelf.connect(topDelay);
        topDelay.connect(topGain);

        midGain.connect(bottomShelf);
        bottomShelf.connect(bottomDelay);
        bottomDelay.connect(bottomGain);

        // Surround-посыл только в верхний канал, через СВОЙ конвольвер
        sideGain.connect(surroundSend);
        surroundSend.connect(convolver);
        convolver.connect(topGain);

        topGain.connect(apTop);   apTop.connect(merger, 0, 0);   // канал 0 = верх
        bottomGain.connect(apBot); apBot.connect(merger, 0, 1);  // канал 1 = низ
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
            destroy: () => {
                nodes.forEach(n => { try { n.disconnect(); } catch (e) {} });
                this._dolbyGraphs.delete(graph);
            }
        };
        this._dolbyGraphs.add(graph);
        return graph;
    }

    // Моно 1:1 из анализатора: (L+R)×0.5 в оба канала
    _buildMono(input, output) {
        const ctx = this.ctx;
        const splitter = ctx.createChannelSplitter(2);
        const merger = ctx.createChannelMerger(2);
        const mg = ctx.createGain(); mg.gain.value = 0.5;
        input.connect(splitter);
        splitter.connect(mg, 0);
        splitter.connect(mg, 1);
        mg.connect(merger, 0, 0);
        mg.connect(merger, 0, 1);
        merger.connect(output);
        const nodes = [splitter, merger, mg];
        return { apply() {}, destroy: () => nodes.forEach(n => { try { n.disconnect(); } catch (e) {} }) };
    }

    // ==================== ВОСПРОИЗВЕДЕНИЕ ====================
    play(id, options = {}) {
        if (!this.ctx || !this.loadedBuffers[id]) return null;

        const {
            loop = false,
            type = 'effects',
            volume = 1.0,
            position = null,   // сохранён для совместимости вызовов
            pan = 0,
            reverb = false,
            dolby = false,     // ★ прежний способ вызова: dolby:true = Vertical Dolby (только музыка)
            dolbyMode = 'none',// совместимость: 'vertical-dolby'/'vertical-stereo' → тот же граф
            loopEndOffset = 0,
            offset = 0         // точка старта (бесшовная смена режима)
        } = options;

        const source = this.ctx.createBufferSource();
        source.buffer = this.loadedBuffers[id];
        if (loop) {
            source.loop = true;
            source.loopStart = 0;
            source.loopEnd = Math.max(0.1, this.loadedBuffers[id].duration - loopEndOffset);
        }

        const gainNode = this.ctx.createGain();
        gainNode.gain.value = volume;
        const targetBus = type === 'music' ? this.masterMusic : this.masterEffects;

        const chain = [gainNode];
        let modeGraph = null;

        if (type === 'music') {
            const modeIsDolby = ['dolby', 'surround', 'dolby-vertical'].includes(this.audioMode);
            const wantDolby = dolby === true || dolbyMode === 'vertical-dolby' || dolbyMode === 'vertical-stereo' || modeIsDolby;

            if (wantDolby) {
                modeGraph = this._buildVerticalDolby(source, gainNode);
            } else if (this.audioMode === 'mono') {
                modeGraph = this._buildMono(source, gainNode);
            } else {
                source.connect(gainNode); // стерео 1:1: L→канал 0 (верх), R→канал 1 (низ)
            }
            gainNode.connect(targetBus);
        } else {
            // ЭФФЕКТЫ: dolby НИКОГДА (правило проекта). Пространство = pan + reverb.
            let lastNode = source;
            if (pan !== 0 && this.ctx.createStereoPanner) {
                const stereoPanner = this.ctx.createStereoPanner();
                stereoPanner.pan.value = Math.max(-1, Math.min(1, pan));
                lastNode.connect(stereoPanner);
                lastNode = stereoPanner;
                chain.push(stereoPanner);
            }
            lastNode.connect(gainNode);
            gainNode.connect(targetBus);

            if (reverb) {
                const delayNode = this.ctx.createDelay();
                delayNode.delayTime.value = 0.28;
                const feedbackGain = this.ctx.createGain();
                feedbackGain.gain.value = 0.35;
                const filterNode = this.ctx.createBiquadFilter();
                filterNode.type = 'lowpass';
                filterNode.frequency.value = 1200;
                gainNode.connect(delayNode);
                delayNode.connect(filterNode);
                filterNode.connect(feedbackGain);
                feedbackGain.connect(delayNode);
                feedbackGain.connect(targetBus);
                chain.push(delayNode, feedbackGain, filterNode);
            }
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
        if (source) {
            try { source.stop(); this.activeSounds.delete(source); } catch (e) {}
        }
    }

    stopAll() {
        this.activeSounds.forEach(source => { try { source.stop(); } catch (e) {} });
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

    // Нормализация алиасов: 'surround' (из settings-manager), 'dolby-vertical' → 'dolby'
    setAudioMode(mode) {
        if (mode === 'surround' || mode === 'dolby-vertical') mode = 'dolby';
        this.audioMode = mode;
    }

    // Live-интенсивность объёма 0..100 (формулы анализатора), без перезапуска трека
    setDolbyIntensity(value) {
        this.dolbyIntensity = Math.max(0, Math.min(100, Number(value) || 0));
        this._dolbyGraphs.forEach(g => g.apply(this.dolbyIntensity));
    }
}

window.SoundsEngine = new SoundEngine();
