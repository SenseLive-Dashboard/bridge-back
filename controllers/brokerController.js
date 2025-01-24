const mqtt = require('mqtt');
const db = require('../db');
const { createError } = require('../middleware/errorMiddleware');
const { getBrokerStatus } = require('../handlers/mqttBrokerHandler');
const logger = require('../logger/logger');

async function addBroker(req, res, next) {
    const { name, host, port, username, password } = req.body;

    try {
        logger.info(`Attempting to add a new broker: ${name} at ${host}:${port}`);
        const query = `
            INSERT INTO bridge.bridge_brokers (name, host, port, username, password)
            VALUES ($1, $2, $3, $4, $5) RETURNING id;
        `;
        const result = await db.query(query, [name, host, port, username, password]);
        logger.info(`Broker added successfully: ${name} (ID: ${result.rows[0].id})`);
        res.status(201).json({ message: 'Broker added successfully', brokerId: result.rows[0].id });
    } catch (error) {
        logger.error(`Error adding broker: ${error.message}`, {
            name,
            host,
            port,
            errorStack: error.stack,
        });
        next(error);
    }
}

async function deleteBroker(req, res, next) {
    const { id } = req.params;

    try {
        logger.info(`Attempting to delete broker with ID: ${id}`);

        const query = `DELETE FROM bridge.bridge_brokers WHERE id = $1 RETURNING id;`;
        const result = await db.query(query, [id]);

        if (result.rowCount === 0) {
            logger.warn(`Delete failed: Broker with ID ${id} not found`);
            throw createError(404, 'Broker not found');
        }

        logger.info(`Broker with ID ${id} deleted successfully`);
        res.status(200).json({ message: 'Broker deleted successfully' });
    } catch (error) {
        if (error.statusCode === 404) {
            logger.warn(`Error deleting broker: ${error.message}`, { id });
        } else {
            logger.error(`Unexpected error deleting broker with ID ${id}: ${error.message}`, {
                errorStack: error.stack,
            });
        }
        next(error);
    }
}

async function testBroker(req, res, next) {
    const { host, port, username, password } = req.body;

    if (!host || !port || isNaN(port)) {
        logger.warn(`Invalid broker configuration: host=${host}, port=${port}`);
        return res.status(400).json({ message: 'Invalid broker configuration' });
    }

    try {
        logger.info(`Testing broker connection: ${host}:${port}`);

        const client = mqtt.connect(`mqtt://${host}:${port}`, {
            username,
            password,
            connectTimeout: 5000, // Connection timeout of 5 seconds
            reconnectPeriod: 0,   // Disable auto-reconnect for testing
        });

        let connectionTimeout;

        client.on('connect', () => {
            clearTimeout(connectionTimeout);
            logger.info(`Broker connection successful: ${host}:${port}`);
            client.end();
            res.status(200).json({ message: 'Broker connection successful' });
        });

        client.on('error', (error) => {
            clearTimeout(connectionTimeout);
            logger.warn(`Broker connection failed: ${host}:${port} - ${error.message}`);
            client.end();
            next(createError(400, `Broker connection failed: ${error.message}`));
        });

        connectionTimeout = setTimeout(() => {
            client.end();
            logger.warn(`Broker connection timed out: ${host}:${port}`);
            next(createError(408, 'Broker connection timed out'));
        }, 5000);
    } catch (error) {
        logger.error(`Unexpected error while testing broker connection: ${error.message}`, {
            errorStack: error.stack,
        });
        next(error);
    }
}


async function fetchBrokerStatus(req, res, next) {
    try {
        const status = await getBrokerStatus();
        res.status(200).json({ message: 'Broker status fetched successfully', status });
    } catch (error) {
        logger.error(`Error fetching broker status: ${error.message}`, {
            errorStack: error.stack,
        });
        next(error);
    }
}

async function editBroker(req, res, next) {
    const { id } = req.params;
    const { name, host, port, username, password } = req.body;

    if (!id || isNaN(id)) {
        logger.warn(`Invalid broker ID provided for edit: ${id}`);
        return res.status(400).json({ message: 'Invalid broker ID' });
    }

    try {
        logger.info(`Attempting to update broker with ID: ${id}`);

        const query = `
            UPDATE bridge.bridge_brokers
            SET name = $1, host = $2, port = $3, username = $4, password = $5
            WHERE id = $6 RETURNING id;
        `;
        const result = await db.query(query, [name, host, port, username, password, id]);

        if (result.rowCount === 0) {
            logger.warn(`Edit failed: Broker with ID ${id} not found`);
            throw createError(404, 'Broker not found');
        }

        logger.info(`Broker with ID ${id} updated successfully`);
        res.status(200).json({ message: 'Broker updated successfully' });
    } catch (error) {
        if (error.statusCode === 404) {
            logger.warn(`Error updating broker: ${error.message}`, { id });
        } else {
            logger.error(`Unexpected error while updating broker with ID ${id}: ${error.message}`, {
                errorStack: error.stack,
            });
        }
        next(error);
    }
}

async function getAllBrokers(req, res, next) {
    try {
        logger.info(`Fetching all brokers initiated by: ${req.ip}`);

        const query = `SELECT id, name, host, port, username FROM bridge.bridge_brokers;`;
        const result = await db.query(query);

        if (result.rowCount === 0) {
            logger.warn(`No brokers found in the database. Request initiated by: ${req.ip}`);
            throw createError(404, 'No brokers found');
        }

        logger.info(`Fetched ${result.rowCount} brokers successfully.`);
        res.status(200).json({ message: 'Brokers fetched successfully', brokers: result.rows });
    } catch (error) {
        logger.error(`Error fetching brokers: ${error.message}`, {
            errorStack: error.stack,
        });
        next(error);
    }
}



module.exports = {
    addBroker,
    deleteBroker,
    testBroker,
    fetchBrokerStatus,
    editBroker,
    getAllBrokers,
};
