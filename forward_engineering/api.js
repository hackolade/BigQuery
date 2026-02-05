const reApi = require('../reverse_engineering/api');
const applyToInstanceHelper = require('./helpers/applyToInstanceHelper');
const { generateScript } = require('./api/generateScript');
const { generateContainerScript } = require('./api/generateContainerScript');
const { generateViewScript } = require('./api/generateViewScript');
const { isDropInStatements } = require('./api/isDropInStatements');

module.exports = {
	generateScript,

	generateContainerScript,

	generateViewScript,

	isDropInStatements,

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
};
