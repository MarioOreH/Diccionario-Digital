/**
 * @fileoverview Diccionario Digital Interactivo del Rostro
 * Módulo principal — Lógica de la aplicación educativa.
 *
 * Arquitectura modular ES6+:
 *  - AudioManager:      Reproducción de MP3, SpeechSynthesis y Web Audio API.
 *  - CameraController:  Zoom dinámico sobre el SVG usando getBBox().
 *  - StateManager:      Gestión de secciones y navegación.
 *  - LessonMode:        Lógica del modo lección.
 *  - GameMode:          Lógica del modo juego "¿Dónde está?".
 *  - App:               Orquestador y event listeners.
 *
 * @author Diccionario Digital — Tesis de Grado, Ingeniería de Sistemas
 * @version 2.0.0
 * @license MIT
 */

'use strict';

/* ============================================================
   CONSTANTES Y DATOS EDUCATIVOS
   ============================================================ */

/**
 * Ruta base hacia los archivos de audio.
 * @constant {string}
 */
const AUDIO_BASE = './assets/audios/';

/**
 * Información educativa de cada parte del rostro.
 * @typedef {Object} PartData
 * @property {string}  id       - Identificador que coincide con data-part del SVG.
 * @property {string}  label    - Nombre en mayúsculas para la UI.
 * @property {string}  phrase   - Descripción educativa leída al estudiante.
 * @property {string}  question - Pregunta para el modo juego.
 * @property {string}  answer   - Respuesta positiva del modo juego.
 * @property {boolean} isMouth  - Si la parte pertenece al dibujo de la boca.
 */

/**
 * Todas las partes del rostro definidas (activas y futuras).
 * Las partes con `active: true` se usan actualmente en la lección y el juego.
 * Las partes con `active: false` están preparadas para ser incorporadas más adelante.
 * @type {PartData[]}
 */
const ALL_PARTS_DATA = [
  // ── Partes activas (con audio de versión completa) ──
  { id: 'ojos',     label: 'OJOS',     phrase: 'Estos son mis ojos, con mis ojos puedo ver.',                   question: '¿Dónde están los ojos?',      answer: '¡Muy bien! Estos son los ojos.',       isMouth: false, active: true  },
  { id: 'nariz',    label: 'NARIZ',    phrase: 'Esta es mi nariz, con mi nariz puedo oler.',                    question: '¿Dónde está la nariz?',       answer: '¡Muy bien! Esta es la nariz.',          isMouth: false, active: true  },
  { id: 'boca',     label: 'BOCA',     phrase: 'Esta es mi boca, con mi boca puedo hablar y comer.',            question: '¿Dónde está la boca?',        answer: '¡Muy bien! Esta es la boca.',           isMouth: false, active: true  },
  { id: 'orejas',   label: 'OREJAS',   phrase: 'Estas son mis orejas, con mis orejas puedo escuchar.',          question: '¿Dónde están las orejas?',    answer: '¡Muy bien! Estas son las orejas.',      isMouth: false, active: true  },

  // ── Partes futuras (se activarán cuando se añadan sus audios) ──
  { id: 'cejas',    label: 'CEJAS',    phrase: 'Estas son mis cejas. Mis cejas protegen mis ojos.',             question: '¿Dónde están las cejas?',     answer: '¡Muy bien! Estas son las cejas.',       isMouth: false, active: false },
  { id: 'mejillas', label: 'MEJILLAS', phrase: 'Estas son mis mejillas.',                                       question: '¿Dónde están las mejillas?',  answer: '¡Muy bien! Estas son las mejillas.',    isMouth: false, active: false },
  { id: 'frente',   label: 'FRENTE',   phrase: 'Esta es mi frente.',                                            question: '¿Dónde está la frente?',      answer: '¡Muy bien! Esta es la frente.',         isMouth: false, active: false },
  { id: 'dientes',  label: 'DIENTES',  phrase: 'Estos son mis dientes. Con mis dientes puedo masticar.',        question: '¿Dónde están los dientes?',   answer: '¡Muy bien! Estos son los dientes.',     isMouth: true,  active: false },
  { id: 'lengua',   label: 'LENGUA',   phrase: 'Esta es mi lengua. Con mi lengua puedo saborear.',              question: '¿Dónde está la lengua?',      answer: '¡Muy bien! Esta es la lengua.',         isMouth: true,  active: false },
];

/** Solo las partes activas participan en la lección y el juego. */
const PARTS_DATA = ALL_PARTS_DATA.filter((p) => p.active);

/**
 * Mapeo de IDs de parte → archivos de audio disponibles.
 * Los audios de versión completa incluyen nombre + frase educativa en una sola pista.
 * Para las partes futuras, se pueden añadir sus archivos aquí cuando estén listos.
 * @constant {Object.<string, {main: string, spelling: string|null}>}
 */
const AUDIO_MAP = {
  // ── Partes activas: audios de versión completa ──
  ojos:     { main: 'OJOS_VERSION_COMPLETA.mp3',    spelling: null },
  nariz:    { main: 'NARIZ_VERSION_COMPLETA.mp3',   spelling: null },
  boca:     { main: 'BOCA_VERSION_COMPLETA.mp3',    spelling: null },
  orejas:   { main: 'OREJAS_VERSION_COMPLETA.mp3',  spelling: null },

  // ── Partes futuras: descomentar/añadir cuando se tengan los audios ──
  // cejas:    { main: 'CEJAS_VERSION_COMPLETA.mp3',    spelling: null },
  // mejillas: { main: 'MEJILLAS_VERSION_COMPLETA.mp3', spelling: null },
  // frente:   { main: 'FRENTE_VERSION_COMPLETA.mp3',   spelling: null },
  // dientes:  { main: 'DIENTES_VERSION_COMPLETA.mp3',  spelling: null },
  // lengua:   { main: 'LENGUA_VERSION_COMPLETA.mp3',   spelling: null },
};

/** Número total de partes activas en la lección. */
const TOTAL_PARTS = PARTS_DATA.length;

/** Cantidad de preguntas en el modo juego (ajustado a las partes activas). */
const GAME_QUESTIONS = Math.min(4, PARTS_DATA.length);

/* ============================================================
   UTILIDADES
   ============================================================ */

/**
 * Atajo para document.getElementById.
 * @param {string} id - ID del elemento.
 * @returns {HTMLElement}
 */
const $ = (id) => document.getElementById(id);

/**
 * Pausa asíncrona.
 * @param {number} ms - Milisegundos.
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Baraja un arreglo con Fisher-Yates y retorna los primeros n elementos.
 * @template T
 * @param {T[]} array - Arreglo original (no se muta).
 * @param {number} n  - Cantidad de elementos a retornar.
 * @returns {T[]}
 */
function shuffleAndPick(array, n) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

/* ============================================================
   AUDIO MANAGER
   ============================================================ */

/**
 * Gestiona toda la reproducción de audio de la aplicación.
 * Soporta archivos MP3, SpeechSynthesis (fallback) y tonos generados.
 */
class AudioManager {
  constructor() {
    /** @type {boolean} Estado de silencio global. */
    this._muted = false;

    /** @type {AudioContext|null} Contexto de Web Audio API. */
    this._audioCtx = null;

    /** @type {HTMLAudioElement|null} Elemento de audio activo. */
    this._currentAudio = null;

    /** @type {SpeechSynthesisUtterance|null} Utterance activo. */
    this._utterance = null;

    /** @type {SpeechSynthesisVoice|null} Voz española seleccionada. */
    this._voice = null;

    /** @type {number} Timer de seguridad para SpeechSynthesis. */
    this._speechTimer = 0;

    /** @type {Function|null} Resolver de la promesa de habla activa. */
    this._finishSpeech = null;

    /** @type {OscillatorNode[]} Osciladores activos. */
    this._tones = [];

    /** @type {Set<string>} Grabaciones ya notificadas, para no repetir el aviso. */
    this._reported = new Set();

    /** @type {SpeechSynthesis|null} */
    this._synth = window.speechSynthesis || null;

    this._loadVoices();
    if (this._synth) {
      this._synth.addEventListener('voiceschanged', () => this._loadVoices());
    }
  }

  /* ---------- Propiedades ---------- */

  /** @returns {boolean} Si el audio está silenciado. */
  get muted() {
    return this._muted;
  }

  /* ---------- Métodos públicos ---------- */

  /**
   * Alterna el estado de silencio global.
   * @returns {boolean} Nuevo estado de silencio.
   */
  toggleMute() {
    this._muted = !this._muted;
    if (this._muted) {
      this.stopAll();
    }
    return this._muted;
  }

  /**
   * Detiene cualquier audio en reproducción.
   */
  stopAll() {
    this._stopAudioElement();
    this._stopSpeech();
    this._stopTones();
  }

  /**
   * Desbloquea el AudioContext (necesario tras interacción del usuario en móvil).
   */
  unlock() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !this._audioCtx) {
        this._audioCtx = new AC();
      }
      if (this._audioCtx && this._audioCtx.state === 'suspended') {
        this._audioCtx.resume().catch(() => {});
      }
    } catch (e) { /* AudioContext no soportado */ }
  }

  /**
   * Reproduce el audio principal de una parte del rostro.
   * Si el MP3 falla, usa SpeechSynthesis como fallback.
   * @param {string} partId - ID de la parte (ej. 'nariz').
   * @returns {Promise<void>} Se resuelve al terminar la reproducción.
   */
  async playPart(partId) {
    const entry = AUDIO_MAP[partId];
    if (!entry) return;
    try {
      await this._playFile(AUDIO_BASE + entry.main);
    } catch (e) {
      // Fallback: hablar el nombre y la frase con SpeechSynthesis
      const part = PARTS_DATA.find((p) => p.id === partId);
      if (part) {
        await this.speak(part.label + '. ' + part.phrase);
      }
    }
  }

  /**
   * Reproduce el audio de deletreo de una parte del rostro.
   * Si el MP3 no existe o falla, deletrea la palabra letra por letra con SpeechSynthesis.
   * @param {string} partId - ID de la parte.
   * @returns {Promise<void>}
   */
  async playSpelling(partId) {
    const entry = AUDIO_MAP[partId];
    if (!entry) return;

    // Si hay archivo de deletreo, intentar reproducirlo
    if (entry.spelling) {
      try {
        await this._playFile(AUDIO_BASE + entry.spelling);
        return;
      } catch (e) {
        // Si falla, usar fallback de deletreo por letra
      }
    }

    // Fallback: deletrear letra por letra con SpeechSynthesis
    const label = PARTS_DATA.find((p) => p.id === partId)?.label || partId.toUpperCase();
    const letters = label.split('');
    for (const letter of letters) {
      if (this._muted) break;
      await this.speak(letter);
      await sleep(200);
    }
  }
  /**
   * Verifica si una parte soporta deletreo.
   * Siempre true: si no hay MP3, se usa fallback letra por letra.
   * @param {string} partId - ID de la parte.
   * @returns {boolean}
   */
  hasSpelling(partId) {
    return !!AUDIO_MAP[partId];
  }

  /**
   * Habla un texto usando SpeechSynthesis (para contenido dinámico).
   * @param {string} text - Texto a pronunciar.
   * @returns {Promise<void>}
   */
  speak(text) {
    this._stopSpeech();
    if (this._muted || !this._synth) return sleep(450);

    return new Promise((resolve) => {
      this._finishSpeech = resolve;
      const u = new SpeechSynthesisUtterance(text);
      this._utterance = u;
      u.lang = this._voice ? this._voice.lang : 'es-ES';
      if (this._voice) u.voice = this._voice;
      u.rate = 0.82;
      u.pitch = 1.25;
      u.volume = 1;

      const done = () => {
        if (this._utterance !== u) return;
        clearTimeout(this._speechTimer);
        this._utterance = null;
        this._finishSpeech = null;
        resolve();
      };

      u.onend = done;
      u.onerror = () => {
        if (this._utterance !== u) return;
        done();
      };

      // Timer de seguridad: cancela si la voz se traba.
      this._speechTimer = setTimeout(() => {
        if (this._utterance === u) this._stopSpeech();
      }, Math.max(12000, text.length * 150));

      try {
        this._synth.speak(u);
      } catch (e) {
        done();
      }
    });
  }

  /**
   * Reproduce un chime de acierto (3 tonos ascendentes).
   */
  playChime() {
    if (this._muted || !this._audioCtx) return;
    this._stopTones();
    [523, 659, 784].forEach((freq, i) => {
      const o = this._audioCtx.createOscillator();
      const g = this._audioCtx.createGain();
      const t = this._audioCtx.currentTime + i * 0.14;
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.1, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g);
      g.connect(this._audioCtx.destination);
      o.start(t);
      o.stop(t + 0.4);
      o.onended = () => { o.disconnect(); g.disconnect(); };
      this._tones.push(o);
    });
  }

  /**
   * Reproduce un tono de error (tono grave descendente).
   */
  playErrorTone() {
    if (this._muted || !this._audioCtx) return;
    this._stopTones();
    const o = this._audioCtx.createOscillator();
    const g = this._audioCtx.createGain();
    const t = this._audioCtx.currentTime;
    o.type = 'triangle';
    o.frequency.setValueAtTime(330, t);
    o.frequency.linearRampToValueAtTime(220, t + 0.3);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(g);
    g.connect(this._audioCtx.destination);
    o.start(t);
    o.stop(t + 0.5);
    o.onended = () => { o.disconnect(); g.disconnect(); };
    this._tones.push(o);
  }

  /**
   * Devuelve un mensaje de estado sobre la voz del sistema.
   * @returns {string}
   */
  getVoiceStatus() {
    if (!this._synth) return 'ESTE NAVEGADOR NO DISPONE DE VOZ.';
    if (!this._voice) return 'PARA AUDIO SIN INTERNET, INSTALA UNA VOZ EN ESPAÑOL.';
    if (!this._voice.localService) return 'LA VOZ DISPONIBLE PUEDE NECESITAR INTERNET.';
    return '';
  }

  /* ---------- Métodos privados ---------- */

  /**
   * Carga la mejor voz española disponible.
   * Prioriza voces naturales, femeninas y de alta calidad.
   * @private
   */
  _loadVoices() {
    if (!this._synth) return;
    const all = this._synth.getVoices().filter((v) => /^es([-_]|$)/i.test(v.lang));
    if (all.length === 0) return;

    // Función de puntuación: mayor es mejor.
    const score = (v) => {
      let s = 0;
      const name = v.name.toLowerCase();
      // Preferir voces de alta calidad (Google, Microsoft Online Natural)
      if (name.includes('google')) s += 50;
      if (name.includes('natural')) s += 40;
      if (name.includes('online')) s += 30;
      if (name.includes('microsoft') && !name.includes('desktop')) s += 20;
      // Preferir voces femeninas (más amigable para niños)
      if (name.includes('elena') || name.includes('paulina') || name.includes('mónica') || name.includes('monica') || name.includes('sabina') || name.includes('female') || name.includes('dalia')) s += 15;
      // Preferir español latinoamericano
      if (v.lang.includes('MX') || v.lang.includes('419') || v.lang.includes('CO') || v.lang.includes('PE')) s += 10;
      // Preferir voces locales (funcionan offline)
      if (v.localService) s += 5;
      return s;
    };

    all.sort((a, b) => score(b) - score(a));
    this._voice = all[0];
  }

  /**
   * Reproduce un archivo MP3.
   * @private
   * @param {string} src - Ruta relativa al archivo.
   * @returns {Promise<void>}
   */
  _playFile(src) {
    this._stopAudioElement();
    this._stopSpeech();
    if (this._muted) return sleep(450);

    return new Promise((resolve, reject) => {
      const audio = new Audio(src);
      this._currentAudio = audio;
      audio.volume = 1;
      audio.onended = () => {
        if (this._currentAudio === audio) this._currentAudio = null;
        resolve();
      };
      audio.onerror = () => {
        if (this._currentAudio === audio) this._currentAudio = null;
        reject(new Error('Audio failed: ' + src));
      };
      audio.play().catch((e) => {
        if (this._currentAudio === audio) this._currentAudio = null;
        reject(e);
      });
    });
  }

  /**
   * Traduce un código de MediaError a un texto comprensible.
   * @private
   * @param {number|null} code - Código de MediaError.
   * @returns {string}
   */
  _describeMediaError(code) {
    switch (code) {
      case 1:  return 'LA REPRODUCCIÓN SE INTERRUMPIÓ';
      case 2:  return 'EL SERVIDOR NO RESPONDIÓ';
      case 3:  return 'EL ARCHIVO ESTÁ DAÑADO O NO SE PUDO DECODIFICAR';
      case 4:  return 'FORMATO NO ADMITIDO O RUTA INEXISTENTE';
      case -1: return 'EL NAVEGADOR BLOQUEÓ EL AUDIO; PULSA UN BOTÓN PRIMERO';
      default: return 'CAUSA DESCONOCIDA';
    }
  }

  /**
   * Explica por qué no se pudo reproducir una grabación y lo muestra en pantalla.
   *
   * El evento `error` de `<audio>` es impreciso: una respuesta 404 del
   * servidor llega como código 4, igual que un archivo realmente ilegible.
   * Para no dar un diagnóstico equivocado se consulta la ruta con una
   * petición HEAD, que solo se ejecuta cuando algo ha fallado.
   *
   * @private
   * @param {string} src  - Ruta del fichero que falló.
   * @param {number|null} code - Código de MediaError recibido.
   * @returns {Promise<void>}
   */
  async _reportFailure(src, code) {
    if (this._reported.has(src)) return;
    this._reported.add(src);

    let cause = this._describeMediaError(code);
    try {
      const r = await fetch(src, { method: 'HEAD', cache: 'no-store' });
      if (r.status === 404) {
        cause = 'EL ARCHIVO NO EXISTE EN ESA RUTA';
      } else if (!r.ok) {
        cause = `EL SERVIDOR RESPONDIÓ ${r.status}`;
      } else {
        const type = r.headers.get('content-type') || '';
        if (type && type.indexOf('audio/') !== 0) {
          cause = `EL SERVIDOR LO SIRVIÓ COMO "${type}" Y NO COMO AUDIO`;
        }
      }
    } catch (e) { /* sin red: nos quedamos con el código de MediaError */ }

    const file = src.split('/').pop();
    const msg = `NO SE PUDO REPRODUCIR "${file}": ${cause}.`;
    console.warn('[AudioManager] ' + msg, { src: src, code: code });
    const status = $('status');
    if (status) status.textContent = msg;
  }

  /**
   * Detiene el elemento de audio activo.
   * @private
   */
  _stopAudioElement() {
    if (this._currentAudio) {
      this._currentAudio.pause();
      this._currentAudio.currentTime = 0;
      this._currentAudio.onended = null;
      this._currentAudio.onerror = null;
      this._currentAudio = null;
    }
  }

  /**
   * Detiene la síntesis de voz.
   * @private
   */
  _stopSpeech() {
    clearTimeout(this._speechTimer);
    const done = this._finishSpeech;
    this._finishSpeech = null;
    if (this._utterance) {
      this._utterance.onend = null;
      this._utterance.onerror = null;
      this._utterance = null;
    }
    if (this._synth) this._synth.cancel();
    if (done) done();
  }

  /**
   * Detiene los osciladores de tonos generados.
   * @private
   */
  _stopTones() {
    this._tones.forEach((o) => { try { o.stop(); } catch (e) { /* ya detenido */ } });
    this._tones = [];
  }
}

/* ============================================================
   CAMERA CONTROLLER
   ============================================================ */

/**
 * Controla el efecto de zoom dinámico (cámara) sobre el grupo SVG.
 * Calcula el Bounding Box de cada parte del rostro y aplica
 * transformaciones de escala/traslación para centrar la vista.
 */
class CameraController {
  /**
   * @param {SVGGElement} cameraEl - El elemento <g id="camera">.
   * @param {SVGSVGElement} svgEl  - El elemento <svg> contenedor.
   */
  constructor(cameraEl, svgEl) {
    /** @type {SVGGElement} */
    this._camera = cameraEl;

    /** @type {SVGSVGElement} */
    this._svg = svgEl;

    /**
     * Centro del viewBox / transform-origin de la cámara.
     * @type {{x: number, y: number}}
     */
    this._origin = { x: 250, y: 240 };

    /** @type {boolean} Si actualmente hay zoom activo. */
    this._zoomed = false;
  }

  /** @returns {boolean} Si hay zoom activo. */
  get isZoomed() {
    return this._zoomed;
  }

  /**
   * Hace zoom hacia una parte específica del rostro.
   * Calcula el centro del Bounding Box de los elementos del grupo [data-part]
   * y aplica translate + scale para centrar y acercar la vista.
   *
   * @param {string} partId - ID de la parte (ej. 'nariz').
   * @param {number} [minScale=1.6] - Escala mínima del zoom.
   */
  zoomTo(partId) {
    const partGroup = this._svg.querySelector(`[data-part="${partId}"]`);
    if (!partGroup) return;

    try {
      const bbox = partGroup.getBBox();
      const cx = bbox.x + bbox.width / 2;
      const cy = bbox.y + bbox.height / 2;

      // Calcular escala basada en el tamaño de la parte relativo al viewBox.
      // Partes más pequeñas → zoom más profundo, partes grandes → zoom moderado.
      const viewBoxW = 500;
      const viewBoxH = 480;
      const partSize = Math.max(bbox.width, bbox.height);
      let scale = Math.min(viewBoxW, viewBoxH) / (partSize * 2.5);
      scale = Math.max(1.4, Math.min(scale, 3.0)); // Clamp entre 1.4x y 3.0x

      // Traslación: compensar para que la parte quede centrada.
      // Con transform-origin en (250, 240), la fórmula es:
      //   translate( (origin.x - cx) * scale, (origin.y - cy) * scale )
      const tx = (this._origin.x - cx) * scale;
      const ty = (this._origin.y - cy) * scale;

      this._camera.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      this._zoomed = true;
    } catch (e) {
      // Fallback: si getBBox falla, no hacer zoom.
      console.warn('CameraController: getBBox falló para', partId, e);
    }
  }

  /**
   * Restaura la cámara a su posición original con transición fluida.
   */
  resetZoom() {
    this._camera.style.transform = 'none';
    this._zoomed = false;
  }

  /**
   * Activa la animación de parpadeo en los ojos.
   */
  triggerBlink() {
    this._camera.classList.add('blink');
    setTimeout(() => this._camera.classList.remove('blink'), 1400);
  }
}

/* ============================================================
   STATE MANAGER
   ============================================================ */

/**
 * Gestiona las secciones visibles de la aplicación y la
 * configuración de controles según el modo activo.
 */
class StateManager {
  constructor() {
    /** @type {string} Modo activo: 'welcome' | 'lesson' | 'game' | 'finish' */
    this._mode = 'welcome';

    /** @type {HTMLElement[]} Todas las partes interactivas del SVG. */
    this._parts = [...document.querySelectorAll('.part')];

    /**
     * Epoch: se incrementa en cada cambio de estado para invalidar
     * tareas asíncronas pendientes de estados anteriores.
     * @type {number}
     */
    this._epoch = 0;
  }

  /** @returns {string} Modo activo. */
  get mode() {
    return this._mode;
  }

  /** @returns {number} Epoch actual. */
  get epoch() {
    return this._epoch;
  }

  /** @returns {HTMLElement[]} Lista de partes interactivas. */
  get parts() {
    return this._parts;
  }

  /**
   * Incrementa el epoch e invalida tareas asíncronas previas.
   * @returns {number} El nuevo epoch.
   */
  newEpoch() {
    return ++this._epoch;
  }

  /**
   * Cambia la sección visible y configura los controles.
   * @param {string} name - Nombre de la sección: 'welcome', 'lesson', 'game', 'finish'.
   */
  show(name) {
    this._mode = name;
    ['welcome', 'lesson', 'game', 'finish'].forEach((id) => {
      $(id).hidden = id !== name;
    });

    // Controles de navegación
    $('controls').hidden = name === 'welcome' || name === 'finish';
    $('prev').hidden = name === 'game';
    $('next').hidden = name === 'game';

    // Accesibilidad: solo las partes activas son interactivas en lesson/game
    const interactive = name === 'lesson' || name === 'game';
    const activeIds = new Set(PARTS_DATA.map((p) => p.id));
    this._parts.forEach((p) => {
      const isActive = activeIds.has(p.dataset.part);
      if (isActive) {
        p.setAttribute('tabindex', interactive ? '0' : '-1');
        p.setAttribute('aria-disabled', interactive ? 'false' : 'true');
        p.style.cursor = interactive ? 'pointer' : 'default';
      } else {
        // Partes futuras: visibles pero no interactivas
        p.setAttribute('tabindex', '-1');
        p.setAttribute('aria-disabled', 'true');
        p.style.cursor = 'default';
      }
    });
  }

  /**
   * Destaca visualmente una parte del rostro.
   * @param {string} partId - ID de la parte a destacar.
   */
  highlight(partId) {
    this._parts.forEach((p) => {
      p.classList.toggle('selected', p.dataset.part === partId);
    });
  }

  /**
   * Limpia todos los estados visuales.
   */
  clearHighlights() {
    this._parts.forEach((p) => p.classList.remove('selected'));
  }

  /**
   * Actualiza los indicadores de progreso (dots).
   * @param {number} current - Índice actual (0-based).
   * @param {number} total   - Total de pasos.
   */
  updateProgress(current, total) {
    $('dots').innerHTML = Array.from({ length: total }, (_, n) => {
      const cls = n === current ? 'current' : n < current ? 'done' : '';
      return `<span class="dot ${cls}"></span>`;
    }).join('');
  }
}

/* ============================================================
   LESSON MODE
   ============================================================ */

/**
 * Controla la lógica del modo lección: navegación secuencial
 * por las partes del rostro con audio y zoom.
 */
class LessonMode {
  /**
   * @param {AudioManager}    audio    - Gestor de audio.
   * @param {CameraController} camera  - Controlador de cámara.
   * @param {StateManager}    state    - Gestor de estados.
   */
  constructor(audio, camera, state) {
    this._audio = audio;
    this._camera = camera;
    this._state = state;

    /** @type {number} Índice de la parte actual (0-8). */
    this._index = 0;

    /** @type {boolean} Si la parte actual ya está lista para interacción. */
    this._ready = false;
  }

  /** @returns {number} Índice actual. */
  get index() { return this._index; }

  /** @returns {boolean} Si la lección está lista. */
  get ready() { return this._ready; }

  /**
   * Inicia o navega a una parte específica de la lección.
   * @param {number}  i       - Índice de la parte (0-8).
   * @param {boolean} [intro] - Si se debe reproducir la introducción.
   */
  async goTo(i, intro = false) {
    const token = this._reset();
    this._index = i;
    this._state.show('lesson');

    const part = PARTS_DATA[i];

    // Configurar UI
    $('prev').disabled = i === 0;
    $('next').textContent = i === TOTAL_PARTS - 1 ? 'JUGAR →' : 'SIGUIENTE →';
    $('word').textContent = 'MI ROSTRO';
    $('phrase').textContent = '';
    $('count').textContent = `${i + 1} DE ${TOTAL_PARTS}`;
    $('spell').hidden = true;
    this._state.updateProgress(i, TOTAL_PARTS);

    // Intro hablada
    if (intro) {
      await this._audio.speak('Este es mi rostro. Vamos a conocer sus partes');
    } else {
      await sleep(750);
    }
    if (token !== this._state.epoch) return;

    // Zoom a la parte
    this._camera.zoomTo(part.id);
    await sleep(1500);
    if (token !== this._state.epoch) return;

    // Mostrar detalle de la boca si aplica
    $('mouthDetail').hidden = !part.isMouth;

    // Activar UI
    this._state.highlight(part.id);
    $('word').textContent = part.label;
    $('phrase').textContent = part.phrase;
    $('spell').hidden = !this._audio.hasSpelling(part.id);
    this._ready = true;

    // Reproducir audio de la parte
    await this._audio.playPart(part.id);
    if (token !== this._state.epoch) return;

    // Mostrar ejemplos visuales solo en la primera parte
    if (i === 0) {
      this._showExamples();
    }
  }

  /**
   * Repite el audio de la parte actual.
   */
  async repeat() {
    if (!this._ready) {
      this.goTo(this._index);
      return;
    }
    const token = this._state.epoch;
    const part = PARTS_DATA[this._index];
    await this._audio.playPart(part.id);
    if (token === this._state.epoch && this._index === 0) {
      this._showExamples();
    }
  }

  /**
   * Reproduce el deletreo de la parte actual.
   */
  async spell() {
    if (!this._ready) return;
    const part = PARTS_DATA[this._index];
    await this._audio.playSpelling(part.id);
  }

  /**
   * Navega a la parte anterior.
   */
  prev() {
    if (this._index > 0) this.goTo(this._index - 1);
  }

  /**
   * Navega a la siguiente parte o al juego.
   * @returns {boolean} true si se debe iniciar el juego.
   */
  next() {
    if (this._index < TOTAL_PARTS - 1) {
      this.goTo(this._index + 1);
      return false;
    }
    return true; // Señal para iniciar el juego
  }

  /**
   * Maneja el clic en una parte del SVG durante la lección.
   * @param {string} partId - ID de la parte tocada.
   */
  handlePartClick(partId) {
    if (partId === PARTS_DATA[this._index].id) {
      if (this._ready) this.repeat();
    } else {
      const idx = PARTS_DATA.findIndex((p) => p.id === partId);
      if (idx !== -1) this.goTo(idx);
    }
  }

  /**
   * Resetea el estado para una nueva navegación.
   * @private
   * @returns {number} Token del epoch.
   */
  _reset() {
    const token = this._state.newEpoch();
    this._audio.stopAll();
    this._ready = false;
    this._camera.resetZoom();
    this._state.clearHighlights();
    $('celebration').hidden = true;
    $('stage').classList.remove('encourage');
    $('examples').hidden = true;
    $('mouthDetail').hidden = true;
    return token;
  }

  /**
   * Muestra los íconos de ejemplo (flor, pelota, sol).
   * @private
   */
  _showExamples() {
    const images = [
      ['FLOR', '<path d="M35 62V31M35 50Q12 36 20 56" stroke="#65a67b" fill="#91ce91" stroke-width="5"/><g fill="#e99eae"><circle cx="35" cy="15" r="10"/><circle cx="20" cy="27" r="10"/><circle cx="50" cy="27" r="10"/><circle cx="26" cy="41" r="10"/><circle cx="44" cy="41" r="10"/></g><circle cx="35" cy="28" r="10" fill="#ffd46e"/>'],
      ['PELOTA', '<circle cx="35" cy="35" r="28" fill="#96bddb"/><path d="M8 35H62M35 7Q5 35 35 63M35 7Q65 35 35 63" fill="none" stroke="#fff8e6" stroke-width="5"/>'],
      ['SOL', '<path d="M35 2V10M35 60V68M2 35H10M60 35H68M11 11L17 17M53 53L59 59M11 59L17 53M53 17L59 11" stroke="#eeb84f" stroke-width="5" stroke-linecap="round"/><circle cx="35" cy="35" r="20" fill="#ffd675"/>'],
    ];
    $('examples').innerHTML = images.map(([name, svg]) =>
      `<div class="example"><svg viewBox="0 0 70 70" role="img" aria-label="${name}">${svg}</svg>${name}</div>`
    ).join('');
    $('examples').hidden = false;
  }
}

/* ============================================================
   GAME MODE
   ============================================================ */

/**
 * Controla la lógica del modo juego "¿Dónde está?".
 * Selecciona partes al azar, presenta preguntas y evalúa respuestas.
 */
class GameMode {
  /**
   * @param {AudioManager}    audio   - Gestor de audio.
   * @param {CameraController} camera - Controlador de cámara.
   * @param {StateManager}    state   - Gestor de estados.
   */
  constructor(audio, camera, state) {
    this._audio = audio;
    this._camera = camera;
    this._state = state;

    /** @type {PartData[]} Cola de preguntas del juego actual. */
    this._queue = [];

    /** @type {number} Turno actual (0-based). */
    this._turn = 0;

    /** @type {boolean} Si la pregunta actual acepta respuestas. */
    this._ready = false;

    /** @type {boolean} Si hay una animación de feedback en curso. */
    this._locked = false;
  }

  /** @returns {boolean} Si el juego está esperando una respuesta. */
  get ready() { return this._ready; }

  /** @returns {boolean} Si hay feedback en curso. */
  get locked() { return this._locked; }

  /**
   * Inicia un nuevo juego seleccionando preguntas al azar.
   */
  start() {
    this._audio.unlock();
    this._queue = shuffleAndPick(PARTS_DATA, GAME_QUESTIONS);
    this._turn = 0;
    this._askQuestion();
  }

  /**
   * Maneja el clic en una parte del SVG durante el juego.
   * @param {string} partId - ID de la parte tocada.
   */
  async handlePartClick(partId) {
    this._audio.unlock();
    if (!this._ready || this._locked) return;

    const token = this._state.epoch;
    this._locked = true;

    const current = this._queue[this._turn];
    // Dientes y lengua aceptados como parte de la boca.
    const correct =
      partId === current.id ||
      (current.id === 'boca' && (partId === 'dientes' || partId === 'lengua'));

    if (correct) {
      await this._onCorrect(token, current);
    } else {
      await this._onWrong(token);
    }
  }

  /**
   * Repite la pregunta actual.
   */
  repeatQuestion() {
    if (!this._locked) {
      const current = this._queue[this._turn];
      this._audio.speak(current.question);
    }
  }

  /* ---------- Métodos privados ---------- */

  /**
   * Presenta una nueva pregunta.
   * @private
   */
  _askQuestion() {
    this._resetVisuals();
    this._state.show('game');

    const current = this._queue[this._turn];
    $('question').textContent = current.question;
    $('feedback').textContent = current.isMouth
      ? '👆 TOCA EL DIBUJO DE LA BOCA'
      : '👆 TOCA EN EL ROSTRO';
    $('gameCount').textContent = `${this._turn + 1} DE ${this._queue.length}`;
    $('mouthDetail').hidden = !current.isMouth;

    this._ready = true;
    this._locked = false;
    this._audio.speak(current.question);
  }

  /**
   * Procesa una respuesta correcta.
   * @private
   * @param {number}   token   - Epoch al momento de la respuesta.
   * @param {PartData} current - Parte correcta.
   */
  async _onCorrect(token, current) {
    this._state.highlight(current.id);
    this._camera.zoomTo(current.id);
    $('feedback').textContent = '¡MUY BIEN!';
    $('celebration').hidden = false;
    this._audio.stopAll();
    this._audio.playChime();

    await sleep(500);
    if (token !== this._state.epoch) return;

    await this._audio.speak(current.answer);
    await sleep(800);
    if (token !== this._state.epoch) return;

    this._turn++;
    if (this._turn < this._queue.length) {
      this._askQuestion();
    } else {
      this._finish();
    }
  }

  /**
   * Procesa una respuesta incorrecta.
   * @private
   * @param {number} token - Epoch al momento de la respuesta.
   */
  async _onWrong(token) {
    $('feedback').textContent = '¡INTENTÉMOSLO OTRA VEZ!';
    $('stage').classList.add('encourage');
    this._audio.playErrorTone();

    await this._audio.speak('Intentémoslo otra vez');
    if (token !== this._state.epoch) return;

    $('stage').classList.remove('encourage');
    const current = this._queue[this._turn];
    $('feedback').textContent = current.isMouth
      ? '👆 TOCA EL DIBUJO DE LA BOCA'
      : '👆 TOCA EN EL ROSTRO';
    this._locked = false;
  }

  /**
   * Muestra la pantalla de finalización.
   * @private
   */
  _finish() {
    this._resetVisuals();
    this._state.show('finish');
    this._audio.speak('¡Excelente trabajo! ¡Conoces las partes del rostro!');
  }

  /**
   * Limpia los estados visuales entre preguntas.
   * @private
   */
  _resetVisuals() {
    this._state.newEpoch();
    this._audio.stopAll();
    this._ready = false;
    this._locked = false;
    this._camera.resetZoom();
    this._state.clearHighlights();
    $('celebration').hidden = true;
    $('stage').classList.remove('encourage');
  }
}

/* ============================================================
   APP — ORQUESTADOR PRINCIPAL
   ============================================================ */

/**
 * Inicializa y orquesta todos los módulos de la aplicación.
 * Conecta event listeners a los controles de la UI.
 */
class App {
  constructor() {
    /** @type {AudioManager} */
    this.audio = new AudioManager();

    /** @type {CameraController} */
    this.camera = new CameraController($('camera'), document.querySelector('.face'));

    /** @type {StateManager} */
    this.state = new StateManager();

    /** @type {LessonMode} */
    this.lesson = new LessonMode(this.audio, this.camera, this.state);

    /** @type {GameMode} */
    this.game = new GameMode(this.audio, this.camera, this.state);

    this._bindEvents();
    this._initVideo();
    this.state.show('welcome');

    // Mostrar estado de la voz
    $('status').textContent = this.audio.getVoiceStatus();
  }

  /**
   * Conecta todos los event listeners de la aplicación.
   * @private
   */
  _bindEvents() {
    // ----- Partes interactivas del SVG -----
    this.state.parts.forEach((part) => {
      const handler = () => this._onPartClick(part.dataset.part);
      part.addEventListener('click', handler);
      part.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handler();
        }
      });
    });

    // ----- Botón EMPEZAR -----
    $('start').onclick = () => {
      this.audio.unlock();
      this.lesson.goTo(0, true);
    };

    // ----- Navegación de lección -----
    $('prev').onclick = () => {
      if (this.state.mode === 'lesson') this.lesson.prev();
    };

    $('next').onclick = () => {
      if (this.state.mode === 'lesson') {
        if (this.lesson.next()) this.game.start();
      }
    };

    // ----- Repetir -----
    $('repeat').onclick = () => {
      this.audio.unlock();
      if (this.state.mode === 'lesson') this.lesson.repeat();
      else if (this.state.mode === 'game') this.game.repeatQuestion();
    };

    // ----- Deletrear -----
    $('spell').onclick = () => {
      this.audio.unlock();
      if (this.state.mode === 'lesson') this.lesson.spell();
    };

    // ----- Inicio -----
    $('home').onclick = () => {
      this.state.newEpoch();
      this.audio.stopAll();
      this.camera.resetZoom();
      this.state.clearHighlights();
      $('celebration').hidden = true;
      $('mouthDetail').hidden = true;
      $('examples').hidden = true;
      this.state.show('welcome');
    };

    // ----- Fin del juego -----
    $('again').onclick = () => this.game.start();
    $('dictionary').onclick = () => {
      this.audio.unlock();
      this.lesson.goTo(0, true);
    };

    // ----- Silencio global -----
    $('sound').onclick = () => {
      const muted = this.audio.toggleMute();
      $('sound').textContent = muted ? '🔇' : '🔊';
      $('sound').setAttribute('aria-label', muted ? 'Activar sonido' : 'Desactivar sonido');
      $('sound').setAttribute('aria-pressed', String(!muted));
      if (!muted) {
        this.audio.unlock();
        if (this.state.mode === 'lesson' && this.lesson.ready) this.lesson.repeat();
      }
    };

    // ----- Pausa al ocultar la pestaña -----
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.audio.stopAll();
    });
  }

  /**
   * Procesa un clic en una parte del SVG según el modo activo.
   * @private
   * @param {string} partId - ID de la parte tocada.
   */
  _onPartClick(partId) {
    this.audio.unlock();
    if (this.state.mode === 'lesson') {
      this.lesson.handlePartClick(partId);
    } else if (this.state.mode === 'game') {
      this.game.handlePartClick(partId);
    }
  }

  /**
   * Inicializa los controles del diálogo de video.
   * @private
   */
  _initVideo() {
    const video = $('referenceVideo');
    const dialog = $('videoDialog');
    if (!video || !dialog) return;

    const closeVideo = () => {
      video.pause();
      dialog.close();
      $('watch').focus();
    };

    $('watch').onclick = () => {
      this.audio.stopAll();
      video.muted = this.audio.muted;
      video.currentTime = 0;
      dialog.showModal();
      video.play().catch(() => {});
    };

    $('closeVideo').onclick = closeVideo;
    dialog.addEventListener('cancel', () => video.pause());
    dialog.addEventListener('close', () => video.pause());

    if ($('learnAfterVideo')) {
      $('learnAfterVideo').onclick = () => {
        closeVideo();
        this.audio.unlock();
        this.lesson.goTo(0, true);
      };
    }

    video.addEventListener('play', () => this.audio.stopAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) video.pause();
    });
  }
}

/* ============================================================
   PUNTO DE ENTRADA
   ============================================================ */

/** @type {App} Instancia global de la aplicación. */
const app = new App();
