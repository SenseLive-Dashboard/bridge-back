const mqtt = require('mqtt');
const db = require('../db');
const { createError } = require('../middleware/errorMiddleware');
const { getBrokerStatus } = require('../handlers/mqttBrokerHandler');

async function addBroker(req, res, next) {
    const { name, host, port, username, password } = req.body;

    try {
        const query = `
            INSERT INTO bridge.bridge_brokers (name, host, port, username, password)
            VALUES ($1, $2, $3, $4, $5) RETURNING id;
        `;
        const result = await db.query(query, [name, host, port, username, password]);
        res.status(201).json({ message: 'Broker added successfully', brokerId: result.rows[0].id });
    } catch (error) {
        next(error);
    }
}

async function deleteBroker(req, res, next) {
    const { id } = req.params;

    try {
        const query = `DELETE FROM bridge.bridge_brokers WHERE id = $1 RETURNING id;`;
        const result = await db.query(query, [id]);

        if (result.rowCount === 0) {
            throw createError(404, 'Broker not found');
        }

        res.status(200).json({ message: 'Broker deleted successfully' });
    } catch (error) {
        next(error);
    }
}

async function testBroker(req, res, next) {
    const { host, port, username, password } = req.body;

    try {
        const client = mqtt.connect(`mqtt://${host}:${port}`, {
            username,
            password,
        });

        client.on('connect', () => {
            client.end(); 
            res.status(200).json({ message: 'Broker connection successful' });
        });

        client.on('error', (error) => {
            client.end(); 
            next(createError(400, `Broker connection failed: ${error.message}`));
        });
    } catch (error) {
        next(error); 
    }
}

async function fetchBrokerStatus(req, res, next) {
    try {
        const status = await getBrokerStatus();
        res.status(200).json({ message: 'Broker status fetched successfully', status });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    addBroker,
    deleteBroker,
    testBroker,
    fetchBrokerStatus,
};
