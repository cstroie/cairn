/*
 * version.js: the app's version, read by the page and by the service
 * worker (importScripts), so a new version is a new service worker.
 *
 * VERSION is raised by hand with each release (semver). BUILD is a hash
 * of every file the service worker caches, written by tools/stamp.js; a
 * test fails when it is stale, so no change ships under an old cache.
 */
(function (root) {
    'use strict';
    root.Cairn = Object.assign(root.Cairn || {}, { VERSION: '0.6.0', BUILD: '1021d974342b' });
})(typeof self !== 'undefined' ? self : globalThis);
