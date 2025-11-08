import * as THREE from './vendor/three.module.min.js';

('use strict');

(function () {
    const LINK_ATTR = 'data-page-transition';
    const TRANSITION_PARAM = '__pt';
    const CAPTURE_STORAGE_KEY = 'page-transition:capture';
    const CAPTURE_SCALE = 0.6;
    const STYLE_ID = 'page-transition-overlay-styles';
    const INTRO_DURATION = 750;
    const DEFAULT_PRIMARY = { rgb: [0.38, 0.63, 1.0], alpha: 0.55 };
    const DEFAULT_SECONDARY = { rgb: [0.2, 0.55, 0.95], alpha: 0.4 };

    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    function prefersReducedMotion() {
        if (typeof window.matchMedia !== 'function') {
            return false;
        }
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function canUseWebGL() {
        if (!window.WebGLRenderingContext) {
            return false;
        }
        try {
            const canvas = document.createElement('canvas');
            return !!(
                canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true }) ||
                canvas.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: true })
            );
        } catch {
            return false;
        }
    }

    function hasTransitionParam() {
        if (typeof window === 'undefined' || typeof window.location === 'undefined') {
            return false;
        }
        try {
            const url = new window.URL(window.location.href);
            return url.searchParams.has(TRANSITION_PARAM);
        } catch {
            return false;
        }
    }

    function clearTransitionParam() {
        if (typeof window === 'undefined' || typeof window.location === 'undefined') {
            return;
        }
        try {
            const url = new window.URL(window.location.href);
            if (!url.searchParams.has(TRANSITION_PARAM)) {
                return;
            }
            url.searchParams.delete(TRANSITION_PARAM);
            if (window.history && typeof window.history.replaceState === 'function') {
                const newUrl = url.pathname + url.search + url.hash;
                window.history.replaceState({}, document.title, newUrl);
            }
        } catch {}
    }

    function storeCaptureData(dataUrl) {
        if (!dataUrl) {
            return;
        }
        try {
            window.sessionStorage.setItem(CAPTURE_STORAGE_KEY, dataUrl);
        } catch {}
    }

    function consumeCaptureData() {
        try {
            const data = window.sessionStorage.getItem(CAPTURE_STORAGE_KEY);
            if (data) {
                window.sessionStorage.removeItem(CAPTURE_STORAGE_KEY);
                return data;
            }
        } catch {}
        return null;
    }

    function captureScene() {
        if (
            typeof window === 'undefined' ||
            typeof document === 'undefined' ||
            typeof window.html2canvas !== 'function'
        ) {
            return Promise.resolve(null);
        }
        const target = document.documentElement || document.body;
        const viewportWidth = Math.max(window.innerWidth || 1, 1);
        const viewportHeight = Math.max(window.innerHeight || 1, 1);
        const scale = Math.min(
            1.2,
            Math.max(CAPTURE_SCALE, 1000 / Math.max(viewportWidth, viewportHeight))
        );
        const scrollX = window.scrollX || window.pageXOffset || 0;
        const scrollY = window.scrollY || window.pageYOffset || 0;
        return window
            .html2canvas(target, {
                logging: false,
                useCORS: true,
                backgroundColor:
                    (window.getComputedStyle &&
                        window.getComputedStyle(document.body).backgroundColor) ||
                    '#000',
                scale,
                width: viewportWidth,
                height: viewportHeight,
                windowWidth: document.documentElement.clientWidth,
                windowHeight: document.documentElement.clientHeight,
                scrollX: scrollX,
                scrollY: scrollY,
                x: scrollX,
                y: scrollY,
            })
            .then((canvas) => {
                try {
                    return canvas.toDataURL('image/png', 0.9);
                } catch {
                    return null;
                }
            })
            .catch(() => null);
    }

    function loadTextureFromDataURL(dataUrl, THREE) {
        return new Promise((resolve, reject) => {
            if (!dataUrl) {
                reject(new Error('No data url'));
                return;
            }
            const image = new Image();
            image.onload = function () {
                const texture = new THREE.Texture(image);
                texture.needsUpdate = true;
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                resolve(texture);
            };
            image.onerror = reject;
            image.src = dataUrl;
        });
    }

    function clampUnit(value) {
        return Math.min(1, Math.max(0, value));
    }

    function hexToRgbArray(hex) {
        const clean = hex.replace('#', '');
        if (clean.length === 3) {
            const r = parseInt(clean[0] + clean[0], 16);
            const g = parseInt(clean[1] + clean[1], 16);
            const b = parseInt(clean[2] + clean[2], 16);
            return [r / 255, g / 255, b / 255];
        }
        if (clean.length === 6) {
            const r = parseInt(clean.slice(0, 2), 16);
            const g = parseInt(clean.slice(2, 4), 16);
            const b = parseInt(clean.slice(4, 6), 16);
            return [r / 255, g / 255, b / 255];
        }
        return null;
    }

    function parseRgbFunction(value) {
        const match = value.match(/^rgba?\(([^)]+)\)$/i);
        if (!match) {
            return null;
        }
        const parts = match[1]
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);
        if (parts.length < 3) {
            return null;
        }
        const r = clampUnit(parseFloat(parts[0]) / 255);
        const g = clampUnit(parseFloat(parts[1]) / 255);
        const b = clampUnit(parseFloat(parts[2]) / 255);
        const a = parts.length > 3 ? clampUnit(parseFloat(parts[3])) : 1;
        if ([r, g, b].some((component) => Number.isNaN(component))) {
            return null;
        }
        return { rgb: [r, g, b], alpha: Number.isNaN(a) ? 1 : a };
    }

    function parseColor(value, fallback) {
        const defaultResult = {
            rgb: fallback.rgb.slice(),
            alpha: fallback.alpha,
        };
        if (!value) {
            return defaultResult;
        }
        const trimmed = value.trim();
        const hexMatch = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (hexMatch) {
            const parsed = hexToRgbArray(trimmed);
            if (parsed) {
                return {
                    rgb: parsed.map(clampUnit),
                    alpha: fallback.alpha,
                };
            }
        }
        const rgbFunc = parseRgbFunction(trimmed);
        if (rgbFunc) {
            return {
                rgb: rgbFunc.rgb.map(clampUnit),
                alpha: clampUnit(rgbFunc.alpha),
            };
        }
        return defaultResult;
    }

    function getTransitionColors() {
        let styles = null;
        try {
            styles = window.getComputedStyle(document.documentElement);
        } catch {}
        if (!styles) {
            return {
                primary: DEFAULT_PRIMARY.slice(),
                secondary: DEFAULT_SECONDARY.slice(),
            };
        }
        const primaryVar = styles.getPropertyValue('--page-transition-primary');
        const secondaryVar = styles.getPropertyValue('--page-transition-secondary');
        return {
            primary: parseColor(primaryVar, DEFAULT_PRIMARY),
            secondary: parseColor(secondaryVar, DEFAULT_SECONDARY),
        };
    }

    function arrayToVector3(array) {
        return new THREE.Vector3(array[0], array[1], array[2]);
    }

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.type = 'text/css';
        style.textContent =
            '.page-transition-overlay{position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:0;transition:opacity 0.4s ease;background:rgba(0,0,0,0.25);}' +
            '.page-transition-overlay canvas{display:block;width:100%;height:100%;}' +
            'html.page-transition--active .page-transition-overlay{opacity:1;}' +
            'html.page-transition--dimming body{transition:opacity 0.45s ease;opacity:0.35;}';
        document.head.appendChild(style);
    }

    function createGradientTexture(stops, THREE) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < stops.length; i += 1) {
            gradient.addColorStop(stops[i][0], stops[i][1]);
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        return texture;
    }

    const vertexShader = [
        'varying vec2 vUv;',
        'void main() {',
        '    vUv = uv;',
        '    gl_Position = vec4(position.xy, 0.0, 1.0);',
        '}',
    ].join('\n');

    const fragmentShader = [
        'precision highp float;',
        'uniform sampler2D uTexture0;',
        'uniform sampler2D uTexture1;',
        'uniform float uProgress;',
        'uniform vec2 uResolution;',
        'uniform vec3 uColorPrimary;',
        'uniform vec3 uColorSecondary;',
        'uniform float uColorPrimaryStrength;',
        'uniform float uColorSecondaryStrength;',
        'varying vec2 vUv;',
        'float hash(vec2 p) {',
        '    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);',
        '}',
        'vec3 blurSample(sampler2D tex, vec2 uv, vec2 pixel, float strength) {',
        '    vec3 c = texture2D(tex, uv).rgb * 0.4;',
        '    c += texture2D(tex, uv + vec2(pixel.x, 0.0)).rgb * 0.15;',
        '    c += texture2D(tex, uv - vec2(pixel.x, 0.0)).rgb * 0.15;',
        '    c += texture2D(tex, uv + vec2(0.0, pixel.y)).rgb * 0.15;',
        '    c += texture2D(tex, uv - vec2(0.0, pixel.y)).rgb * 0.15;',
        '    return mix(texture2D(tex, uv).rgb, c, strength);',
        '}',
        'vec2 parallax(vec2 uv, float amount) {',
        '    vec2 centered = uv - 0.5;',
        '    return uv + centered * amount * 0.05;',
        '}',
        'float glow(vec2 uv, float progress) {',
        '    float sweep = smoothstep(progress - 0.1, progress + 0.03, uv.y);',
        '    float trail = exp(-abs(uv.y - progress) * 8.0);',
        '    return sweep * 0.35 + trail * 0.2;',
        '}',
        'void main() {',
        '    vec2 pixel = 1.0 / max(uResolution, vec2(1.0));',
        '    float reveal = smoothstep(0.08, 0.92, uProgress);',
        '    float blurStrength = smoothstep(0.0, 0.5, uProgress) * 0.6;',
        '    vec3 fromColor = blurSample(uTexture0, parallax(vUv, -0.3 * (1.0 - reveal)), pixel * 1.1, blurStrength);',
        '    float desaturate = smoothstep(0.0, 1.0, uProgress);',
        '    float luma = dot(fromColor, vec3(0.299, 0.587, 0.114));',
        '    fromColor = mix(fromColor, vec3(luma), desaturate * 0.45);',
        '    vec3 toColor = texture2D(uTexture1, parallax(vUv, 0.12 * (1.0 - reveal))).rgb;',
        '    vec3 mixed = mix(fromColor, toColor, reveal);',
        '    float sweep = glow(vUv, reveal);',
        '    vec3 sweepColor = mix(uColorSecondary, uColorPrimary, 0.5);',
        '    float sweepStrength = (uColorPrimaryStrength + uColorSecondaryStrength) * 0.2;',
        '    mixed += sweepColor * (sweep * sweepStrength);',
        '    float grain = (hash(vUv * 720.0 + uProgress * 5.0) - 0.5) * 0.012;',
        '    mixed += grain;',
        '    gl_FragColor = vec4(clamp(mixed, 0.0, 1.0), 0.78);',
        '}',
    ].join('\n');

    function PageTransition() {
        injectStyles();
        this.enabled = !!THREE && canUseWebGL() && !prefersReducedMotion() && document.body != null;
        this.colors = getTransitionColors();
        this.duration = INTRO_DURATION;
        this.visible = false;
        this.isAnimating = false;
        this.progressRaf = null;
        this.renderRaf = null;
        this.hideTimeout = null;
        this.textures = { previous: null, current: null };
        this.container = document.createElement('div');
        this.container.className = 'page-transition-overlay';
        this.canvas = document.createElement('canvas');
        this.container.appendChild(this.canvas);
        document.body.appendChild(this.container);
        const pendingReveal = hasTransitionParam();

        if (!this.enabled) {
            this.container.style.display = 'none';
            if (pendingReveal) {
                clearTransitionParam();
            }
            return;
        }

        this.setupThree();
        this.refreshColorUniforms();
        this.setProgress(0);
        this.hideOverlay(true);
        this.applyStoredCaptureTexture();
        if (pendingReveal) {
            clearTransitionParam();
        }

        const prepareDestination = () => {
            this.prepareDestinationTexture().catch(() => {});
        };

        if (document.readyState === 'complete') {
            prepareDestination();
        } else {
            window.addEventListener('load', prepareDestination, { once: true });
        }
    }

    PageTransition.prototype.setupThree = function () {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000, 0);
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.uniforms = {
            uTime: { value: 0 },
            uProgress: { value: 0 },
            uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            uColorPrimary: { value: arrayToVector3(this.colors.primary.rgb) },
            uColorSecondary: { value: arrayToVector3(this.colors.secondary.rgb) },
            uColorPrimaryStrength: { value: this.colors.primary.alpha },
            uColorSecondaryStrength: { value: this.colors.secondary.alpha },
            uTexture0: {
                value: createGradientTexture(
                    [
                        [0, '#020508'],
                        [0.5, '#0d1a2c'],
                        [1, '#04070a'],
                    ],
                    THREE
                ),
            },
            uTexture1: {
                value: createGradientTexture(
                    [
                        [0, '#111111'],
                        [0.6, '#050505'],
                        [1, '#000000'],
                    ],
                    THREE
                ),
            },
        };

        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
        });
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
        this.scene.add(this.mesh);
        this.clock = new THREE.Clock();
        this.renderLoop = this.renderLoop.bind(this);
        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.handleResize);
    };

    PageTransition.prototype.applyStoredCaptureTexture = function () {
        const dataUrl = consumeCaptureData();
        if (!dataUrl) {
            return null;
        }
        loadTextureFromDataURL(dataUrl, THREE)
            .then((texture) => {
                this.uniforms.uTexture0.value = texture;
                this.textures.previous = texture;
            })
            .catch(() => {});
        return null;
    };

    PageTransition.prototype.prepareDestinationTexture = function () {
        return captureScene().then((dataUrl) => {
            if (!dataUrl) {
                return null;
            }
            return loadTextureFromDataURL(dataUrl, THREE)
                .then((texture) => {
                    this.uniforms.uTexture1.value = texture;
                    this.textures.current = texture;
                    return texture;
                })
                .catch(() => null);
        });
    };

    PageTransition.prototype.captureAndStoreCurrentScene = function () {
        return captureScene().then((dataUrl) => {
            if (dataUrl) {
                storeCaptureData(dataUrl);
            }
        });
    };

    PageTransition.prototype.buildTransitionUrl = function (url) {
        try {
            const nextUrl = new window.URL(url, window.location.href);
            nextUrl.searchParams.set(TRANSITION_PARAM, '1');
            return nextUrl.toString();
        } catch {
            return url;
        }
    };

    PageTransition.prototype.refreshColorUniforms = function () {
        if (
            !this.uniforms ||
            !this.uniforms.uColorPrimary ||
            !this.uniforms.uColorSecondary ||
            !this.uniforms.uColorPrimaryStrength ||
            !this.uniforms.uColorSecondaryStrength
        ) {
            return;
        }
        const colors = getTransitionColors();
        this.colors = colors;
        this.uniforms.uColorPrimary.value.set(
            colors.primary.rgb[0],
            colors.primary.rgb[1],
            colors.primary.rgb[2]
        );
        this.uniforms.uColorSecondary.value.set(
            colors.secondary.rgb[0],
            colors.secondary.rgb[1],
            colors.secondary.rgb[2]
        );
        this.uniforms.uColorPrimaryStrength.value = colors.primary.alpha;
        this.uniforms.uColorSecondaryStrength.value = colors.secondary.alpha;
    };

    PageTransition.prototype.handleResize = function () {
        if (!this.renderer) {
            return;
        }
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if (this.uniforms && this.uniforms.uResolution) {
            this.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
        }
    };

    PageTransition.prototype.renderLoop = function () {
        if (!this.visible) {
            this.renderRaf = null;
            return;
        }
        const delta = this.clock.getDelta();
        this.uniforms.uTime.value += delta;
        this.renderer.render(this.scene, this.camera);
        this.renderRaf = window.requestAnimationFrame(this.renderLoop);
    };

    PageTransition.prototype.startRender = function () {
        if (this.renderRaf || !this.enabled) {
            return;
        }
        this.clock.start();
        this.renderRaf = window.requestAnimationFrame(this.renderLoop);
    };

    PageTransition.prototype.stopRender = function () {
        if (this.renderRaf) {
            window.cancelAnimationFrame(this.renderRaf);
            this.renderRaf = null;
        }
    };

    PageTransition.prototype.setProgress = function (value) {
        if (!this.uniforms) {
            return;
        }
        this.uniforms.uProgress.value = Math.max(0, Math.min(1, value));
    };

    PageTransition.prototype.showOverlay = function (immediate) {
        if (!this.enabled) {
            return;
        }
        this.visible = true;
        this.container.style.display = 'block';
        if (immediate) {
            this.container.style.transition = 'none';
            this.container.offsetHeight;
            this.container.style.transition = '';
        } else {
            this.container.style.transition = '';
        }
        document.documentElement.classList.add('page-transition--active');
        this.startRender();
    };

    PageTransition.prototype.hideOverlay = function (immediate) {
        if (immediate) {
            this.container.style.transition = 'none';
            this.container.offsetHeight;
            this.container.style.transition = '';
        } else {
            this.container.style.transition = '';
        }
        document.documentElement.classList.remove('page-transition--active');
        this.visible = false;
        clearTimeout(this.hideTimeout);
        this.hideTimeout = window.setTimeout(
            function () {
                if (!this.visible) {
                    this.container.style.display = 'none';
                    this.stopRender();
                }
            }.bind(this),
            immediate ? 0 : 450
        );
    };

    PageTransition.prototype.dimContent = function (enable) {
        if (!document.documentElement) {
            return;
        }
        if (enable) {
            document.documentElement.classList.add('page-transition--dimming');
        } else {
            document.documentElement.classList.remove('page-transition--dimming');
        }
    };

    PageTransition.prototype.animateProgress = function (target, duration, done) {
        if (!this.enabled) {
            if (typeof done === 'function') {
                done();
            }
            return;
        }
        const start = this.uniforms.uProgress.value;
        const delta = target - start;
        let startTime = null;
        const step = (timestamp) => {
            if (!startTime) {
                startTime = timestamp;
            }
            const elapsed = timestamp - startTime;
            const t = duration === 0 ? 1 : Math.min(elapsed / duration, 1);
            const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            this.setProgress(start + delta * eased);
            if (t < 1) {
                this.progressRaf = window.requestAnimationFrame(step);
            } else {
                this.progressRaf = null;
                if (typeof done === 'function') {
                    done();
                }
            }
        };
        if (this.progressRaf) {
            window.cancelAnimationFrame(this.progressRaf);
            this.progressRaf = null;
        }
        this.progressRaf = window.requestAnimationFrame(step);
    };

    PageTransition.prototype.navigate = function (url) {
        if (!this.enabled || this.isAnimating) {
            window.location.assign(url);
            return;
        }
        this.isAnimating = true;
        const targetUrl = this.buildTransitionUrl(url);
        this.showOverlay(false);
        this.dimContent(true);
        this.setProgress(0);
        Promise.resolve(this.captureAndStoreCurrentScene()).finally(() => {
            this.animateProgress(1, this.duration, () => {
                window.location.assign(targetUrl);
            });
        });
    };

    PageTransition.prototype.playIntro = function () {
        this.dimContent(false);
        this.animateProgress(0, this.duration, () => {
            this.hideOverlay(false);
            this.setProgress(0);
        });
    };

    ready(function () {
        const transition = new PageTransition();
        if (!transition.enabled) {
            return;
        }

        const links = Array.prototype.slice.call(document.querySelectorAll('a[' + LINK_ATTR + ']'));
        function shouldSkipForMobileBack(element) {
            if (!element) {
                return false;
            }
            if (!element.classList || !element.classList.contains('nav-back')) {
                return false;
            }
            if (typeof window.matchMedia !== 'function') {
                return false;
            }
            return window.matchMedia('(max-width: 768px)').matches;
        }
        links.forEach(function (anchor) {
            anchor.addEventListener('click', function (event) {
                if (event.defaultPrevented) {
                    return;
                }
                if (shouldSkipForMobileBack(anchor)) {
                    return;
                }
                if (
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                ) {
                    return;
                }
                const target = anchor.getAttribute('target');
                if (target && target !== '_self') {
                    return;
                }
                if (anchor.hasAttribute('download')) {
                    return;
                }
                const href = anchor.getAttribute('href');
                if (!href || href.indexOf('#') === 0) {
                    return;
                }
                const url = anchor.href;
                if (!url || url === window.location.href) {
                    return;
                }
                event.preventDefault();
                transition.navigate(url);
            });
        });

        window.addEventListener('pageshow', function (event) {
            if (!transition.enabled) {
                return;
            }
            if (hasTransitionParam()) {
                clearTransitionParam();
                transition.hideOverlay(true);
                transition.setProgress(0);
                transition.dimContent(false);
            } else if (event.persisted) {
                transition.hideOverlay(true);
                transition.setProgress(0);
                transition.dimContent(false);
            }
            transition.isAnimating = false;
        });
    });
})();
