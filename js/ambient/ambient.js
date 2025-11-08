// Ambient background effect (localized copy)
// Expects window.Sketch and optional window.AMBIENT_CONFIG
(function () {
    try {
        const usp =
            typeof window.URLSearchParams !== 'undefined'
                ? new window.URLSearchParams(window.location.search || '')
                : null;
        const force = usp ? usp.get('ambient') : null; // 'on' | 'debug' | 'trace'
        const trace = force === 'trace';
        const C = Object.assign(
            {
                enabled: true,
                minWidth: 1024,
                maxParticles: 120,
                densityDivisor: 25000,
                radius: { min: 4.0, max: 8.0 },
                alpha: { min: 0.2, max: 0.4 },
                speed: 0.2,
                zIndex: 1,
                blend: 'screen',
            },
            window.AMBIENT_CONFIG || {}
        );
        if (force === 'debug' || trace) {
            C.zIndex = 999;
            C.radius = { min: C.radius.min * 2, max: C.radius.max * 2 };
            C.alpha = { min: Math.min(0.4, C.alpha.min * 2), max: Math.min(0.8, C.alpha.max * 2) };
            C.speed = Math.max(C.speed, 0.3);
            C.densityDivisor = Math.max(15000, C.densityDivisor - 10000);
        }
        const m = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
        const reduce = m && m.matches;
        const large = window.innerWidth >= C.minWidth;
        const enabled = C.enabled || !!force;
        if ((!enabled || (reduce && C.respectReducedMotion !== false)) && !force) {
            return;
        }
        if (!large && !force) {
            return;
        }
        if (!window.Sketch) {
            return;
        }
        const s = window.Sketch.create({
            container: document.body,
            retina: true,
            interval: 2,
            globals: false,
            autopause: true,
        });
        s.canvas.className += ' ambient-canvas';
        s.canvas.style.position = 'fixed';
        s.canvas.style.top = '0';
        s.canvas.style.left = '0';
        s.canvas.style.pointerEvents = 'none';
        s.canvas.style.zIndex = String(C.zIndex);
        s.canvas.style.width = '100vw';
        s.canvas.style.height = '100vh';
        if (trace) {
            s.canvas.style.background = 'rgba(255,0,0,0.06)';
        }
        function metrics() {
            const ratio = window.devicePixelRatio || 1;
            const cw = s.canvas && s.canvas.clientWidth ? s.canvas.clientWidth : window.innerWidth;
            const ch =
                s.canvas && s.canvas.clientHeight ? s.canvas.clientHeight : window.innerHeight;
            const pw = s.canvas && s.canvas.width ? s.canvas.width : cw * ratio;
            const ph = s.canvas && s.canvas.height ? s.canvas.height : ch * ratio;
            const width = pw / ratio;
            const height = ph / ratio;
            s.width = width;
            s.height = height;
            return { width: width, height: height, cw: cw, ch: ch, ratio: ratio };
        }

        const MAX = C.maxParticles,
            particles = [];
        const transitionControl = {
            mode: 'idle',
            start: 0,
            duration: 900,
        };
        const TRANSITION_FLAG_KEY = 'ambientTransition:intro';
        const perfNow = (function () {
            if (
                typeof window !== 'undefined' &&
                window.performance &&
                typeof window.performance.now === 'function'
            ) {
                return window.performance.now.bind(window.performance);
            }
            return function () {
                return Date.now();
            };
        })();
        function reset(p) {
            const m = metrics();
            p.x = Math.random() * m.width;
            p.y = Math.random() * m.height;
            p.vx = (Math.random() - 0.5) * C.speed;
            p.vy = (Math.random() - 0.5) * C.speed;
            p.r = C.radius.min + Math.random() * (C.radius.max - C.radius.min);
            p.a = C.alpha.min + Math.random() * (C.alpha.max - C.alpha.min);
            return p;
        }
        function beginExitBurst() {
            transitionControl.mode = 'exit';
            transitionControl.start = perfNow();
            transitionControl.duration = 900;
            if (s.canvas) {
                s.canvas.style.transition = 'opacity 0.4s ease';
                s.canvas.style.opacity = '1';
            }
            for (let i = 0; i < particles.length; i += 1) {
                const p = particles[i];
                p.vx = (Math.random() - 0.5) * C.speed * 10;
                p.vy = -Math.abs(p.vy) - 1.2 - Math.random() * 1.8;
                p.a = Math.min(1, p.a + 0.2);
            }
        }

        let introTriggered = false;

        function beginIntroSweep() {
            introTriggered = true;
            transitionControl.mode = 'intro';
            transitionControl.start = perfNow();
            transitionControl.duration = 750;
            if (s.canvas) {
                s.canvas.style.transition = 'opacity 0.4s ease';
                s.canvas.style.opacity = '1';
            }
            const m = metrics();
            for (let i = 0; i < particles.length; i += 1) {
                const p = particles[i];
                p.x = -m.width * 0.15 + Math.random() * m.width * 0.3;
                p.y = -m.height * 0.1 + Math.random() * m.height * 0.25;
                p.vx = Math.abs(p.vx) + 0.6 + Math.random() * 1.4;
                p.vy = Math.abs(p.vy) + 0.5 + Math.random() * 1.2;
                p.a = C.alpha.min + Math.random() * (C.alpha.max - C.alpha.min);
            }
        }

        s.setup = function () {
            particles.length = 0;
            const divisor = C.densityDivisor;
            const m = metrics();
            const area = Math.max(1, m.width * m.height);
            let count = Math.min(MAX, Math.round(area / divisor));
            if (count < 20) {
                count = 20;
            }
            for (let i = 0; i < count; i++) {
                particles.push(reset({}));
            }
            if (trace && window.console) {
                // console.log('[ambient] setup', { count: count, area: area, w: s.width, h: s.height });
            }
        };
        s.resize = function () {
            s.setup();
        };
        s.update = function () {
            const w = metrics().width,
                h = s.height;
            const exiting = transitionControl.mode === 'exit';
            const intro = transitionControl.mode === 'intro';
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                if (exiting) {
                    p.x += p.vx;
                    p.y += p.vy;
                    p.a = Math.max(0, p.a - 0.02);
                } else if (intro) {
                    p.x += p.vx;
                    p.y += p.vy;
                    p.a = Math.max(0, p.a - 0.01);
                } else {
                    p.x += p.vx;
                    p.y += p.vy;
                }
                if (
                    !exiting &&
                    !intro &&
                    (p.x < -10 || p.x > w + 10 || p.y < -10 || p.y > h + 10)
                ) {
                    reset(p);
                }
            }
            if (exiting || intro) {
                const elapsed = perfNow() - transitionControl.start;
                if (elapsed > transitionControl.duration) {
                    transitionControl.mode = 'idle';
                    if (s.canvas) {
                        s.canvas.style.opacity = '';
                    }
                }
            }
        };
        s.draw = function () {
            const ctx = this;
            ctx.save();
            ctx.globalCompositeOperation = C.blend;
            if (particles.length === 0 && trace) {
                ctx.globalCompositeOperation = 'source-over';
                ctx.fillStyle = 'rgba(0,128,255,0.12)';
                ctx.fillRect(0, 0, this.width, this.height);
            }
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2, false);
                ctx.fillStyle = 'rgba(255,255,255,' + p.a + ')';
                ctx.fill();
            }
            ctx.restore();
        };
        if (trace && window.console) {
            window.__ambient = { config: C, instance: s };
        }
        function maybePlayIntro() {
            let shouldIntro = false;
            try {
                shouldIntro = window.sessionStorage.getItem(TRANSITION_FLAG_KEY) === '1';
            } catch {}
            const isProject =
                document.body && document.body.getAttribute('data-page-type') === 'project';
            if (shouldIntro && isProject) {
                beginIntroSweep();
                try {
                    window.sessionStorage.removeItem(TRANSITION_FLAG_KEY);
                } catch {}
                return;
            }
            if (isProject && !introTriggered) {
                beginIntroSweep();
            }
        }

        window.AmbientTransitionController = {
            playExit: beginExitBurst,
            playIntro: beginIntroSweep,
            maybePlayIntro: maybePlayIntro,
        };
        maybePlayIntro();
        // eslint-disable-next-line no-unused-vars
    } catch (e) {
        // Error handling is intentionally empty for ambient background script
    }
})();
