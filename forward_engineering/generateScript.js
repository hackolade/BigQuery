const { generateAlterScript } = require('./generateAlterScript');
const { convertJsonSchemaToBigQuerySchema } = require('./helpers/schemaHelper');

const generateScript = (data, logger, callback, app) => {
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
			'Error occurred during generation schema on dataset level',
		);
		callback({
			message: e.message,
			stack: e.stack,
		});
	}
};

module.exports = {
	generateScript,
};
