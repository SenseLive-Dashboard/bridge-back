const db = require('../db');
const { Worker } = require('worker_threads');
const _ = require('lodash');
const { mqttClients } = require('./mqttBrokerHandler');

const subscribedTopics = {};

async function forwardMessage(mapping, transformedMessage) {
    const targetClient = mqttClients[mapping.target_broker_id];
    if (!targetClient) {
        console.error(`Target client not found for broker ID: ${mapping.target_broker_id}`);
        return;
    }
    if (mapping.mapping_status !== 'active') {
        console.log(`Mapping ID ${mapping.id} is not active. Skipping.`);
        return;
    }

    targetClient.publish(mapping.target_topic, transformedMessage, (err) => {
        if (err) {
            console.error(`Error publishing to ${mapping.target_topic}: ${err.message}`);
        } else {
            console.log(`Message published to ${mapping.target_topic}: ${transformedMessage}`);
        }
    });
}

function startWorker(mapping, message) {
    return new Promise((resolve, reject) => {
        const worker = new Worker('./handlers/messageWorker.js', {
            workerData: { mapping, message },
        });

        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });
    });
}

async function updateMappings() {
    const mappings = await db.query('SELECT * FROM bridge.broker_mappings');
    const chunkSize = 100;

    for (let i = 0; i < mappings.rows.length; i += chunkSize) {
        const batch = mappings.rows.slice(i, i + chunkSize);

        await Promise.all(
            batch.map(async (mapping) => {
                const sourceClient = mqttClients[mapping.source_broker_id];
                if (!sourceClient) {
                    console.error(`Source client not found for broker ID: ${mapping.source_broker_id}`);
                    return;
                }

                if (!subscribedTopics[mapping.source_broker_id]) {
                    subscribedTopics[mapping.source_broker_id] = new Map();
                }

                const topicKey = `${mapping.source_topic}_${mapping.id}`;
                const storedMapping = subscribedTopics[mapping.source_broker_id].get(topicKey);

                if (
                    !storedMapping ||
                    storedMapping.last_updated.getTime() !== new Date(mapping.last_updated).getTime()
                ) {
                    console.log(`Updating mapping for topic ${mapping.source_topic}`);
                    subscribedTopics[mapping.source_broker_id].set(topicKey, {
                        ...mapping,
                        last_updated: new Date(mapping.last_updated),
                    });

                    sourceClient.subscribe(mapping.source_topic, (err) => {
                        if (err) {
                            console.error(`Error subscribing to ${mapping.source_topic}: ${err.message}`);
                        } else {
                            console.log(`Subscribed to ${mapping.source_topic}`);
                        }
                    });
                }

                if (!sourceClient.hasAttachedListener) {
                    sourceClient.on('message', async (topic, message) => {
                        const relevantMappings = Array.from(subscribedTopics[mapping.source_broker_id].values()).filter(
                            (m) => m.source_topic === topic
                        );

                        for (const relevantMapping of relevantMappings) {
                            try {
                                const transformedMessage = await startWorker(relevantMapping, message.toString());
                                if (transformedMessage.error) {
                                    console.error(`Worker error: ${transformedMessage.error}`);
                                } else {
                                    forwardMessage(relevantMapping, transformedMessage.toString());
                                }
                            } catch (err) {
                                console.error(`Error processing message with worker: ${err.message}`);
                            }
                        }
                    });
                    sourceClient.hasAttachedListener = true;
                }
            })
        );
    }
}

async function monitorMappings() {
    setInterval(updateMappings, 5000);
}

module.exports = {
    monitorMappings,
    updateMappings,
};
