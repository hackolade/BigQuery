const { generateAlterScript } = require('../alterScript/alterScriptBuilder');
const { convertJsonSchemaToBigQuerySchema } = require('../helpers/schemaHelper');

const generateContainerScript = (data, logger, callback, app) => {
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
};

module.exports = {
	generateContainerScript,
};
