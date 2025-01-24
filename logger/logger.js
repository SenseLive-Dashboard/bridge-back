const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const db = require('../db');

async function addLog(level, message) {
    const query = `
        INSERT INTO bridge.bridge_logs (level, message, timestamp)
        VALUES ($1, $2, CURRENT_TIMESTAMP);
    `;
    try {
        await db.query(query, [level, message]);
    } catch (error) {
        console.error(`Database logging error: ${error.message}`);
    }
}

function databaseLogger(level, message) {
    addLog(level, message).catch((err) => {
        console.error(`Error logging to database: ${err.message}`);
    });
}

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp(),
        format.printf(({ level, message, timestamp }) => {
            databaseLogger(level, message);
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new DailyRotateFile({
            filename: 'logs/app-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxFiles: '7d',
            zippedArchive: true,
        }),
        new transports.Console(),
    ],
});

module.exports = logger;
