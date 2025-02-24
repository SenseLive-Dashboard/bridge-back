const mqtt = require('mqtt');
const db = require('../db');
const logger = require('../logger/logger');

const mqttClients = {};
const brokerStatus = {};

async function connectToBroker(broker) {
    if (mqttClients[broker.id]) return mqttClients[broker.id];
    const client = mqtt.connect(`mqtt://${broker.host}:${broker.port}`, {
        username: broker.username,
        password: broker.password,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
    });
    brokerStatus[broker.id] = {
        status: 'connecting',
        host: broker.host,
        port: broker.port,
        username: broker.username,
        password: broker.password,
        lastUpdated: new Date().toISOString(),
    };

    client.on('connect', () => {
        brokerStatus[broker.id].status = 'connected';
        brokerStatus[broker.id].lastUpdated = new Date().toISOString();
        logger.info(`Connected to broker: ${broker.name}`);
    });
    client.on('error', (error) => {
        brokerStatus[broker.id].status = 'error';
        brokerStatus[broker.id].error = error.message;
        brokerStatus[broker.id].lastUpdated = new Date().toISOString();
        logger.error(`Error with broker ${broker.name}: ${error.message}`);
    });
    client.on('disconnect', () => {
        brokerStatus[broker.id].status = 'disconnected';
        brokerStatus[broker.id].lastUpdated = new Date().toISOString();
        logger.info(`Disconnected from broker: ${broker.name}`);
    });
    mqttClients[broker.id] = client;
    return client;
}

async function disconnectBroker(brokerId) {
    const client = mqttClients[brokerId];
    if (client) {
        client.end(true);
        delete mqttClients[brokerId];
        brokerStatus[brokerId] = { status: 'disconnected', lastUpdated: new Date().toISOString() };
        logger.info(`Disconnected and removed broker ID: ${brokerId}`);
    }
}

async function refreshBrokers(updatedBrokerId = null) {
    try {
        const query = updatedBrokerId
            ? `SELECT * FROM bridge.bridge_brokers WHERE id = ${updatedBrokerId}`
            : 'SELECT * FROM bridge.bridge_brokers';
        const brokers = await db.query(query);

        for (const broker of brokers.rows) {
            const existingClient = mqttClients[broker.id];
            if (existingClient) {
                const currentStatus = brokerStatus[broker.id];
                if (
                    currentStatus.host !== broker.host ||
                    currentStatus.port !== broker.port ||
                    currentStatus.username !== broker.username ||
                    currentStatus.password !== broker.password
                ) {
                    await disconnectBroker(broker.id);
                    await connectToBroker(broker);
                }
            } else {
                await connectToBroker(broker);
            }
        }

        if (!updatedBrokerId) {
            const currentBrokerIds = Object.keys(mqttClients).map(id => parseInt(id));
            const dbBrokerIds = brokers.rows.map(broker => broker.id);

            for (const brokerId of currentBrokerIds) {
                if (!dbBrokerIds.includes(brokerId)) {
                    await disconnectBroker(brokerId);
                }
            }
        }
    } catch (error) {
        logger.error(`Error refreshing brokers: ${error.message}`);
    }
}

async function monitorBrokers() {
    logger.info('Starting broker monitoring...');
    setInterval(() => {
        refreshBrokers();
    }, 5000);
}

async function getBrokerStatus() {
    return brokerStatus;
}

module.exports = {
    mqttClients,
    monitorBrokers,
    connectToBroker,
    disconnectBroker,
    refreshBrokers,
    getBrokerStatus,
};
