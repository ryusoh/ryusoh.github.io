'use strict';
(function() {
    const cacheVersion = '-180503';
    const staticCacheName = 'asset' + cacheVersion;
    const maxEntries = 100;
    self.importScripts('/assets/vendor/sw-toolbox/sw-toolbox.js');

    self.toolbox.options.debug = false;
    self.toolbox.options.networkTimeoutSeconds = 1;

    /* staticImageCache */
    self.toolbox.router.get('/(.*)', self.toolbox.cacheFirst, {
        cache: {
            name: staticCacheName,
            maxEntries: maxEntries
        }
    });
})();
