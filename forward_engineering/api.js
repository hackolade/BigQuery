'use strict';

const { convertJsonSchemaToBigQuerySchema } = require('./helpers/schemaHelper');
const reApi = require('../reverse_engineering/api');
const applyToInstanceHelper = require('./helpers/applyToInstanceHelper');
const { DROP_STATEMENTS } = require('./helpers/constants');
const { commentDropStatements } = require('./helpers/commentDropStatements');

module.exports = {
	generateScript(data, logger, callback, app) {
		try {
			logger.log('info', { message: 'Start generating schema' });

			if (data.isUpdateScript) {
				return generateAlterScript(data, callback, app);
			}

			const schema = convertJsonSchemaToBigQuerySchema(JSON.parse(data.jsonSchema));

			logger.log('info', { message: 'Generating schema finished' });

			callback(null, JSON.stringify(schema, null, 4));
		} catch (e) {
			logger.log(
				'error',
				{ message: e.message, stack: e.stack },
				'Error ocurred during generation schema on dataset level',
			);
			callback({
				message: e.message,
				stack: e.stack,
			});
		}
	},

	generateViewScript(...args) {
		return this.generateScript(...args);
	},

	generateContainerScript(data, logger, callback, app) {
		try {
			if (data.isUpdateScript) {
				data.jsonSchema = data.collections[0];
				return generateAlterScript(data, callback, app);
			}

			logger.log('info', { message: 'Start generating schema' });

			const entities = data.entities.reduce((result, entityId) => {
				const name = data.entityData[entityId]?.[0]?.collectionName;

				logger.log('info', { message: 'Generate "' + name + '" schema' });

				return {
					...result,
					[name]: convertJsonSchemaToBigQuerySchema(JSON.parse(data.jsonSchema[entityId])),
				};
			}, {});

			const views = (data.views || []).reduce((result, viewId) => {
				const name = data.viewData[viewId]?.[0]?.name;

				logger.log('info', { message: 'Generate "' + name + '" schema' });

				return {
					...result,
					[name]: convertJsonSchemaToBigQuerySchema(JSON.parse(data.jsonSchema[viewId])),
				};
			}, {});

			logger.log('info', { message: 'Generating schema finished' });

			callback(
				null,
				JSON.stringify(
					{
						...entities,
						...(views || {}),
					},
					null,
					4,
				),
			);
		} catch (e) {
			logger.log(
				'error',
				{ message: e.message, stack: e.stack },
				'Error ocurred during generation schema on dataset level',
			);
			callback({
				message: e.message,
				stack: e.stack,
			});
		}
	},
	testConnection(connectionInfo, logger, callback, app) {
		reApi.testConnection(connectionInfo, logger, callback, app).then(callback, callback);
	},
	applyToInstance(connectionInfo, logger, callback, app) {
		logger.clear();
		logger.log('info', connectionInfo, 'connectionInfo', connectionInfo.hiddenKeys);

		applyToInstanceHelper
			.applyToInstance(connectionInfo, logger, app)
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
	isDropInStatements(data, logger, callback, app) {
		try {
			const cb = (error, script = '') =>
				callback(
					error,
					DROP_STATEMENTS.some(statement => script.includes(statement)),
				);

			if (data.level === 'container') {
				this.generateContainerScript(data, logger, cb, app);
			} else {
				this.generateScript(data, logger, cb, app);
			}
		} catch (e) {
			callback({ message: e.message, stack: e.stack });
		}
	},
};

const generateAlterScript = (data, callback, app) => {
	const {
		getAlterContainersScripts,
		getAlterCollectionsScripts,
		getAlterViewScripts,
	} = require('./helpers/alterScriptFromDeltaHelper');

	const collection = JSON.parse(data.jsonSchema);
	if (!collection) {
		throw new Error(
			'"comparisonModelCollection" is not found. Alter script can be generated only from Delta model',
		);
	}

	const containersScripts = getAlterContainersScripts(collection, app, data.modelData);
	const collectionsScripts = getAlterCollectionsScripts(collection, app, data.modelData);
	const viewScripts = getAlterViewScripts(collection, app, data.modelData);
	const script = [...containersScripts, ...collectionsScripts, ...viewScripts].join('\n\n');

	const applyDropStatements = data.options?.additionalOptions?.some(
		option => option.id === 'applyDropStatements' && option.value,
	);

	callback(null, applyDropStatements ? script : commentDropStatements(script));
};
