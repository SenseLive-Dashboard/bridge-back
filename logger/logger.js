const { createLogger, format, transports } = require('winston');
const db = require('../db'); // Shared database pool

async function addLog(level, message) {
    const query = `
        INSERT INTO bridge.bridge_logs (level, message, timestamp)
        VALUES ($1, $2, CURRENT_TIMESTAMP);
    `;
    try {
        await db.query(query, [level, message]); // Use shared connection
    } catch (error) {
        console.error('Error adding log to database:', error);
    }
}

// Synchronous wrapper for logging to database
function databaseLogger(level, message) {
    addLog(level, message).catch((err) => {
        console.error('Error logging to database:', err);
    });
}

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp(),
        format.printf(({ level, message, timestamp }) => {
            databaseLogger(level, message); // Log to the database here
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new transports.File({ filename: 'logs/app.log' }),
        new transports.Console(),
    ],
});

module.exports = logger;
