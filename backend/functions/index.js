const functions = require('firebase-functions');

// Import our custom functions
const { packContentAccess } = require('./src/packContentAccess');
const { packUploadVideo } = require('./src/packUploadVideo');
const { packContentVideoReprocessor } = require('./src/packContentVideoReprocessor');
const { directVideoUpload } = require('./src/directVideoUpload');
const { getVideoProcessingStatus } = require('./src/getVideoProcessingStatus');
const { generateVideoUploadUrl } = require('./src/generateVideoUploadUrl');
const { confirmVideoUpload } = require('./src/confirmVideoUpload');

// Export all functions
exports.packContentAccess = packContentAccess;
exports.packUploadVideo = packUploadVideo;
exports.packContentVideoReprocessor = packContentVideoReprocessor;
exports.directVideoUpload = directVideoUpload;
exports.getVideoProcessingStatus = getVideoProcessingStatus;
exports.generateVideoUploadUrl = generateVideoUploadUrl;
exports.confirmVideoUpload = confirmVideoUpload;

// Optional: Add more functions here
// exports.verifyPackOrder = require('./src/verifyPackOrder');
// exports.generatePackPreview = require('./src/generatePackPreview');
