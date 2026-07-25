// Webpack-config stub for dependency-cruiser (.dependency-cruiser.cjs) only —
// NOT a real build config; this repo has no bundler (plain <script> tags).
//
// Why a webpack stub and not options.tsConfig: dependency-cruiser resolves
// path aliases through either options.tsConfig or a webpack resolve.alias,
// and the tsConfig route makes it look for a typescript <7 compiler (this
// repo has v7) and print a spurious "missing-typescript-transpiler" warning
// on every run. (enhancedResolveOptions does NOT accept alias keys — the
// schema rejects them.)
//
// This repo currently has NO aliases: jsconfig.json declares no `paths` and
// pages use no import maps. The alias map below is therefore empty on
// purpose. If aliases are ever introduced (jsconfig.json `paths` or an
// import map), add them HERE — e.g. '@js': path.resolve(__dirname, 'js') —
// not via options.tsConfig.
module.exports = {
    resolve: {
        alias: {
            // no aliases yet — see header comment
        },
    },
};
