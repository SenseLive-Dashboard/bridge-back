const db = require('../db');
const { createError } = require('../middleware/errorMiddleware');

// Add a new mapping
async function addMapping(req, res, next) {
    const { sourceBrokerId, sourceTopic, targetBrokerId, targetTopic, transformations, keep_payload_same, mapping_status } = req.body;

    try {
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

        res.status(201).json({ message: 'Mapping added successfully', mappingId: result.rows[0].id });
    } catch (error) {
        next(error);
    }
}

// Delete an existing mapping
async function deleteMapping(req, res, next) {
    const { id } = req.params;

    try {
        const query = `DELETE FROM bridge.broker_mappings WHERE id = $1 RETURNING id;`;
        const result = await db.query(query, [id]);

        if (result.rowCount === 0) {
            throw createError(404, 'Mapping not found');
        }

        res.status(200).json({ message: 'Mapping deleted successfully' });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    addMapping,
    deleteMapping,
};
