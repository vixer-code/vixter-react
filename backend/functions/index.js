const functions = require('firebase-functions');

// Import our custom functions
const { packContentAccess } = require('./src/packContentAccess');
const { packContentVideoReprocessor } = require('./src/packContentVideoReprocessor');
const { getVideoProcessingStatus } = require('./src/getVideoProcessingStatus');

// Export all functions
exports.packContentAccess = packContentAccess;
exports.packContentVideoReprocessor = packContentVideoReprocessor;
exports.getVideoProcessingStatus = getVideoProcessingStatus;

// Optional: Add more functions here
// exports.verifyPackOrder = require('./src/verifyPackOrder');
// exports.generatePackPreview = require('./src/generatePackPreview');
