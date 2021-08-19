'use strict'

const { convertJsonSchemaToBigQuerySchema } = require('./helpers/schemaHelper');

module.exports = {
	generateScript(data, logger, callback) {
		try {
			logger.log('info', { message: 'Start generating schema' });

			const schema = convertJsonSchemaToBigQuerySchema(
				JSON.parse(data.jsonSchema),
			);

			logger.log('info', { message: 'Generating schema finished' });

			callback(null, JSON.stringify(schema, null, 4));
		} catch (e) {
			logger.log('error', { message: e.message, stack: e.stack }, 'Error ocurred during generation schema on dataset level');
			callback(e);
		}
	},

	generateContainerScript(data, logger, callback) {
		try {
			logger.log('info', { message: 'Start generating schema' });
			
			const entities = data.entities.reduce((result, entityId) => {
				const name = data.entityData[entityId]?.[0]?.collectionName;
	
				logger.log('info', { message: 'Generate "' + name + '" schema' });
	
				return {
					...result,
					[name]: convertJsonSchemaToBigQuerySchema(
						JSON.parse(data.jsonSchema[entityId]),
					),
				};
			}, {});
	
			logger.log('info', { message: 'Generating schema finished' });
	
			callback(null, JSON.stringify(entities, null, 4));
		} catch (e) {
			logger.log('error', { message: e.message, stack: e.stack }, 'Error ocurred during generation schema on dataset level');
			callback(e);
		}
	}
};
