const MIN_VIEWPORT_WIDTH = 1024;
const POINTER_SMOOTHING = 0.085;
const PARTICLE_COUNT = 1400;

function ready(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
        fn();
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function prefersReducedMotion() {
    if (typeof window.matchMedia !== 'function') {
        return false;
    }
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

function hasWebGLSupport() {
    if (typeof window === 'undefined' || !window.WebGLRenderingContext) {
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

function getForceMode() {
    if (typeof window === 'undefined' || typeof window.location === 'undefined') {
        return null;
    }
    try {
        if (typeof window.URLSearchParams !== 'function') {
            return null;
        }
        const usp = new window.URLSearchParams(window.location.search || '');
        return usp.get('ambient');
    } catch {
        return null;
    }
}

function updatePointerTarget(event, target) {
    const width = Math.max(1, window.innerWidth || 1);
    const height = Math.max(1, window.innerHeight || 1);
    const px = clamp(event.clientX / width, 0, 1);
    const py = clamp(1 - event.clientY / height, 0, 1);
    target.set(px, py);
}

function createParticleSystem(THREE, count) {
    const particleCount = Math.max(200, count || PARTICLE_COUNT);
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 3.5 + Math.random() * 12.0;
        const height = -6 + Math.random() * 12;
        positions[i * 3 + 0] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = height;
        positions[i * 3 + 2] = Math.sin(angle) * radius;
        sizes[i] = 0.04 + Math.random() * 0.16;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.computeBoundingSphere();

    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            pointer: { value: new THREE.Vector2(0.5, 0.5) },
        },
        vertexShader: `
            precision highp float;
            uniform float time;
            uniform vec2 pointer;
            attribute float aSize;
            varying float vAlpha;
            void main() {
                vec3 transformed = position;
                transformed.xz += normalize(position.xz + 0.001) * sin(time * 0.12 + length(position.xz) * 0.35) * 0.18;
                transformed.y += sin(time * 0.18 + pointer.y * 5.0 + position.y * 0.12) * 0.24;
                vAlpha = 0.35 + 0.45 * abs(sin(time * 0.6 + dot(position.xy, vec2(0.17, 0.13))));
                vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                gl_PointSize = aSize * 420.0 / -mvPosition.z;
            }
        `,
        fragmentShader: `
            precision highp float;
            varying float vAlpha;
            void main() {
                float dist = length(gl_PointCoord - 0.5);
                float alpha = smoothstep(0.5, 0.0, dist) * vAlpha;
                gl_FragColor = vec4(vec3(1.0), alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, material);
    particles.frustumCulled = false;
    return { particles, material };
}

async function initParticles(forceMode) {
    const THREE = await import('../vendor/three.module.min.js');

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.classList.add('ambient-canvas', 'ambient-quantum-canvas');
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100vw';
    renderer.domElement.style.height = '100vh';
    renderer.domElement.style.pointerEvents = 'none';
    renderer.domElement.style.zIndex = '1';
    document.body.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
    camera.position.set(0, 0, 7.5);

    const multiplier =
        forceMode === 'trace' || forceMode === 'debug' ? 1.5 : forceMode === 'lite' ? 0.6 : 1;
    const { particles, material } = createParticleSystem(
        THREE,
        Math.round(PARTICLE_COUNT * multiplier)
    );
    scene.add(particles);

    const pointer = material.uniforms.pointer.value;
    const pointerTarget = pointer.clone();

    const handlePointer = (event) => {
        updatePointerTarget(event, pointerTarget);
    };
    const resetPointer = () => {
        pointerTarget.set(0.5, 0.5);
    };
    window.addEventListener('pointermove', handlePointer, { passive: true });
    window.addEventListener('pointerdown', handlePointer, { passive: true });
    window.addEventListener('pointerup', handlePointer, { passive: true });
    window.addEventListener('pointercancel', resetPointer, { passive: true });
    window.addEventListener('pointerleave', resetPointer, { passive: true });
    window.addEventListener('blur', resetPointer);

    const resize = () => {
        const width = Math.max(1, window.innerWidth || 1);
        const height = Math.max(1, window.innerHeight || 1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    if (typeof window.ResizeObserver === 'function') {
        const observer = new window.ResizeObserver(resize);
        observer.observe(document.body);
    }

    const perfNow =
        window.performance && typeof window.performance.now === 'function'
            ? window.performance.now.bind(window.performance)
            : () => Date.now();
    let lastTime = perfNow();

    const render = (now) => {
        const delta = now - lastTime;
        lastTime = now;
        const timeSeconds = now * 0.001;

        const lerpAlpha = clamp(1 - Math.exp(-POINTER_SMOOTHING * delta * 0.06), 0, 1);
        pointer.lerp(pointerTarget, lerpAlpha);
        material.uniforms.pointer.value.copy(pointer);
        material.uniforms.time.value = timeSeconds;

        const pointerOffsetX = (pointer.x - 0.5) * 1.4;
        const pointerOffsetY = (pointer.y - 0.5) * 1.4;

        particles.rotation.y += delta * 0.00022;
        particles.rotation.z += delta * 0.00011;

        camera.position.x = Math.sin(timeSeconds * 0.1) * 1.6 + pointerOffsetX * 1.8;
        camera.position.y = pointerOffsetY * 1.6;
        camera.position.z = 7.5 + Math.cos(timeSeconds * 0.08) * 0.6;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
        window.requestAnimationFrame(render);
    };

    window.requestAnimationFrame(render);
}

ready(() => {
    const forceMode = getForceMode();
    const forceEnabled =
        forceMode === 'on' ||
        forceMode === 'debug' ||
        forceMode === 'trace' ||
        forceMode === 'lite';
    const saveData =
        typeof navigator !== 'undefined' && navigator.connection && navigator.connection.saveData;

    if (
        !forceEnabled &&
        (prefersReducedMotion() ||
            saveData ||
            window.innerWidth < MIN_VIEWPORT_WIDTH ||
            !hasWebGLSupport())
    ) {
        return;
    }

    if (window.__AmbientQuantumParticlesLoaded) {
        return;
    }
    window.__AmbientQuantumParticlesLoaded = true;

    initParticles(forceMode).catch((error) => {
        window.__AmbientQuantumParticlesLoaded = false;
        if (window.console && typeof window.console.error === 'function') {
            window.console.error('[ambient] particle backdrop failed to load', error);
        }
    });
});
