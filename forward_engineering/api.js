const reApi = require('../reverse_engineering/api');
const applyToInstanceHelper = require('./helpers/applyToInstanceHelper');
const { generateScript } = require('./generateScript');
const { generateContainerScript } = require('./generateContainerScript');
const { generateViewScript } = require('./generateViewScript');
const { isDropInStatements } = require('./isDropInStatements');

module.exports = {
	generateScript,

	generateContainerScript,

	generateViewScript,

	isDropInStatements,

	testConnection(connectionInfo, logger, callback, app) {
		reApi.testConnection(connectionInfo, logger, callback, app).then(callback, callback);
	},

	applyToInstance(connectionInfo, logger, callback, app) {
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
};
