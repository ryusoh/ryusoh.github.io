// Ambient effect configuration
// Edit values here to tune visuals without touching ambient.js
window.AMBIENT_CONFIG = {
    enabled: true, // set false to disable unless forced via ?ambient
    minWidth: 1024, // only run on wide screens

    // Visual intensity
    maxParticles: 300, // cap the number of particles
    densityDivisor: 20000, // higher = fewer particles per viewport area
    radius: { min: 1.0, max: 8.0 }, // particle size in px
    alpha: { min: 0.1, max: 0.6 }, // particle opacity
    speed: 0.6, // base drift speed (px per frame approx)

    // Compositing & layering
    zIndex: 1, // default canvas layer (debug mode elevates it)
    blend: 'screen', // 'screen' or 'lighter'
};
