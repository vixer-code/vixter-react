const functions = require('firebase-functions');

// Import our custom functions
const { packContentAccess } = require('./src/packContentAccess');
const { packUploadVideo } = require('./src/packUploadVideo');

// Export all functions
exports.packContentAccess = packContentAccess;
exports.packUploadVideo = packUploadVideo;

// Optional: Add more functions here
// exports.verifyPackOrder = require('./src/verifyPackOrder');
// exports.generatePackPreview = require('./src/generatePackPreview');
