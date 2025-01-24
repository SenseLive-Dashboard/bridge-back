const db = require('../db');
const mqtt = require('mqtt');
const { Worker } = require('worker_threads');
const _ = require('lodash');
const { mqttClients } = require('./mqttBrokerHandler');

const subscribedTopics = {};

async function applyTransformation(message, transformations, keep_payload_same) {

    if (!transformations || keep_payload_same) {
        return message;
    }

    const parsedMessage = JSON.parse(message);
    let transformedMessage = {};

    if (transformations) {
        if (transformations.extractFields) {
            for (const [newKey, path] of Object.entries(transformations.extractFields)) {
                try {
                    const value = _.get(parsedMessage, path, null);
                    transformedMessage[newKey] = value;
                } catch (error) {
                    console.error(`Error extracting field ${path}:`, error);
                    transformedMessage[newKey] = null; // Or a default value
                }
            }
        }
        if (transformations.addFields) {
            for (const [key, value] of Object.entries(transformations.addFields)) {
                transformedMessage[key] =
                    value === "CURRENT_TIMESTAMP" ? new Date().toISOString() : value;
            }
        }
    }

    return JSON.stringify(transformedMessage);
}

async function forwardMessage(mapping, message) {
    const targetClient = mqttClients[mapping.target_broker_id];
    if (!targetClient) {
        console.error(`Target client not found for broker ID: ${mapping.target_broker_id}`);
        return;
    }
    if (mapping.mapping_status !== 'active') {
        console.log(`Mapping ID ${mapping.id} is not active. Skipping.`);
        return;
    }

    const transformedMessage = await applyTransformation(message, mapping.transformations, mapping.keep_payload_same);

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
                //console.log(subscribedTopics);

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
                            //await forwardMessage(relevantMapping, message.toString());
                            await startWorker(relevantMapping, message.toString())
                                .then((transformedMessage) => {
                                    console.log(transformedMessage)
                                    if (transformedMessage.error) {
                                        console.error(`Worker error: ${transformedMessage.error}`);
                                    } else {
                                        forwardMessage(relevantMapping, transformedMessage.toString());
                                    }
                                })
                                .catch((err) => {
                                    console.error(`Error processing message with worker: ${err.message}`);
                                });
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