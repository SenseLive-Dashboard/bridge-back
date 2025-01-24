const { parentPort, workerData } = require('worker_threads');
const _ = require('lodash');

async function applyTransformation(message, transformations, keep_payload_same) {
    try {
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
    } catch (err) {
        console.error(`Error in applyTransformation: ${err.message}`);
        throw err;
    }
}

(async () => {
    const { mapping, message } = workerData;
    try {
        const transformedMessage = await applyTransformation(
            message,
            mapping.transformations,
            mapping.keep_payload_same
        );
        parentPort.postMessage(transformedMessage);
    } catch (err) {
        parentPort.postMessage({ error: err.message });
    }
})();
