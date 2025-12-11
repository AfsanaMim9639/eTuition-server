require('dotenv').config();

// Import the main app
const app = require('../src/index');

// Export for Vercel
module.exports = app;