'use strict'

const { convertJsonSchemaToBigQuerySchema } = require('./helpers/schemaHelper');
const reApi = require('../reverse_engineering/api');
const applyToInstanceHelper = require('./helpers/applyToInstanceHelper');

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
			callback({
				message: e.message,
				stack: e.stack,
			});
		}
	},

	generateViewScript(...args) {
		return this.generateScript(...args);
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

			const views = (data.views || []).reduce((result, viewId) => {
				const name = data.viewData[viewId]?.[0]?.name;
	
				logger.log('info', { message: 'Generate "' + name + '" schema' });
	
				return {
					...result,
					[name]: convertJsonSchemaToBigQuerySchema(
						JSON.parse(data.jsonSchema[viewId]),
					),
				};
			}, {});
	
			logger.log('info', { message: 'Generating schema finished' });
	
			callback(null, JSON.stringify({
				...entities,
				...(views || {}),
			}, null, 4));
		} catch (e) {
			logger.log('error', { message: e.message, stack: e.stack }, 'Error ocurred during generation schema on dataset level');
			callback({
				message: e.message,
				stack: e.stack,
			});
		}
	},
	testConnection(connectionInfo, logger, callback, app) {
		reApi.testConnection(connectionInfo, logger, callback, app)
			.then(
				callback,
				callback
			);
	},
	applyToInstance(connectionInfo, logger, callback, app) {
		logger.clear();
		logger.log('info', connectionInfo, 'connectionInfo', connectionInfo.hiddenKeys);

		applyToInstanceHelper.applyToInstance(connectionInfo, logger, app)
			.then(result => {
				callback(null, result);
			})
			.catch(error => {
				const err = {
					message: error.message,
					stack: error.stack,
				};
				logger.log('error', err, 'Error when applying to instance');
				callback(err);
			});
	},
};
