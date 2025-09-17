const functions = require('firebase-functions');

// Import our custom functions
const { packContentAccess } = require('./src/packContentAccess');

// Export all functions
exports.packContentAccess = packContentAccess;

// Optional: Add more functions here
// exports.verifyPackOrder = require('./src/verifyPackOrder');
// exports.generatePackPreview = require('./src/generatePackPreview');
