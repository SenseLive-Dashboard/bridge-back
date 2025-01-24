const db = require('../db');
const { createError } = require('../middleware/errorMiddleware');
const logger = require('../logger/logger');

// Add a new mapping
async function addMapping(req, res, next) {
    const { sourceBrokerId, sourceTopic, targetBrokerId, targetTopic, transformations, keep_payload_same, mapping_status } = req.body;

    if (!sourceBrokerId || !sourceTopic || !targetBrokerId || !targetTopic) {
        logger.warn(`Invalid mapping data provided: sourceBrokerId=${sourceBrokerId}, sourceTopic=${sourceTopic}, targetBrokerId=${targetBrokerId}, targetTopic=${targetTopic}`);
        return res.status(400).json({ message: 'Invalid mapping data provided' });
    }

    try {
        logger.info(`Attempting to add a new mapping from Broker ${sourceBrokerId} to Broker ${targetBrokerId}`);

        const query = `
            INSERT INTO bridge.broker_mappings 
            (source_broker_id, source_topic, target_broker_id, target_topic, transformations, keep_payload_same, mapping_status)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;
        `;
        const result = await db.query(query, [
            sourceBrokerId,
            sourceTopic,
            targetBrokerId,
            targetTopic,
            transformations || {},
            keep_payload_same,
            mapping_status
        ]);
        logger.info(`Mapping added successfully: ID ${result.rows[0].id}`);
        res.status(201).json({ message: 'Mapping added successfully', mappingId: result.rows[0].id });
    } catch (error) {
        logger.error(`Error adding mapping: ${error.message}`, {
            sourceBrokerId,
            sourceTopic,
            targetBrokerId,
            targetTopic,
            errorStack: error.stack,
        });
        next(error);
    }
}

// Delete an existing mapping
async function deleteMapping(req, res, next) {
    const { id } = req.params;

    if (!id || isNaN(id)) {
        logger.warn(`Invalid mapping ID provided for deletion: ${id}`);
        return res.status(400).json({ message: 'Invalid mapping ID' });
    }

    try {
        logger.info(`Attempting to delete mapping with ID: ${id}`);

        const query = `DELETE FROM bridge.broker_mappings WHERE id = $1 RETURNING id;`;
        const result = await db.query(query, [id]);

        if (result.rowCount === 0) {
            logger.warn(`Delete failed: Mapping with ID ${id} not found`);
            throw createError(404, 'Mapping not found');
        }

        logger.info(`Mapping with ID ${id} deleted successfully`);
        res.status(200).json({ message: 'Mapping deleted successfully' });
    } catch (error) {
        if (error.statusCode === 404) {
            logger.warn(`Error deleting mapping: ${error.message}`, { id });
        } else {
            logger.error(`Unexpected error while deleting mapping with ID ${id}: ${error.message}`, {
                errorStack: error.stack,
            });
        }
        next(error);
    }
}


async function editMapping(req, res, next) {
    const { id } = req.params;
    const { sourceBrokerId, sourceTopic, targetBrokerId, targetTopic, transformations, keep_payload_same, mapping_status } = req.body;

    if (!id || isNaN(id)) {
        logger.warn(`Invalid mapping ID provided for edit: ${id}`);
        return res.status(400).json({ message: 'Invalid mapping ID' });
    }

    try {
        logger.info(`Attempting to update mapping with ID: ${id}`);

        const query = `
            UPDATE bridge.broker_mappings
            SET source_broker_id = $1, source_topic = $2, target_broker_id = $3, target_topic = $4, 
                transformations = $5, keep_payload_same = $6, mapping_status = $7
            WHERE id = $8 RETURNING id;
        `;
        const result = await db.query(query, [
            sourceBrokerId,
            sourceTopic,
            targetBrokerId,
            targetTopic,
            transformations || {},
            keep_payload_same,
            mapping_status,
            id
        ]);

        if (result.rowCount === 0) {
            logger.warn(`Edit failed: Mapping with ID ${id} not found`);
            throw createError(404, 'Mapping not found');
        }

        logger.info(`Mapping with ID ${id} updated successfully`);
        res.status(200).json({ message: 'Mapping updated successfully' });
    } catch (error) {
        if (error.statusCode === 404) {
            logger.warn(`Error updating mapping: ${error.message}`, { id });
        } else {
            logger.error(`Unexpected error while updating mapping with ID ${id}: ${error.message}`, {
                errorStack: error.stack,
            });
        }
        next(error);
    }
}

async function collectAllMappings(req, res, next) {
    try {
        logger.info(`Fetching all mappings initiated by: ${req.ip}`);

        const query = `
            SELECT id, source_broker_id, source_topic, target_broker_id, target_topic, 
                   transformations, keep_payload_same, mapping_status 
            FROM bridge.broker_mappings;
        `;
        const result = await db.query(query);

        if (result.rowCount === 0) {
            logger.warn(`No mappings found in the database. Request initiated by: ${req.ip}`);
            throw createError(404, 'No mappings found');
        }

        logger.info(`Collected ${result.rowCount} mappings successfully.`);
        res.status(200).json({ message: 'Mappings fetched successfully', mappings: result.rows });
    } catch (error) {
        logger.error(`Error collecting mappings: ${error.message}`, {
            errorStack: error.stack,
        });
        next(error);
    }
}




module.exports = {
    addMapping,
    deleteMapping,
    editMapping,
    collectAllMappings
};
