const { BigQuery, credentials } = require('@google-cloud/bigquery');
const fsExtra = require('fs-extra');

let client = null;

const connect = async connectionInfo => {
	if (client) {
		return client;
	}

	const projectId = connectionInfo.projectId;
	const location = connectionInfo.location;
	const credentials = await fsExtra.readJson(connectionInfo.keyFilename);

	client = new BigQuery({
		credentials,
		location,
		projectId,
		scopes: ['https://www.googleapis.com/auth/bigquery', 'https://www.googleapis.com/auth/drive'],
	});

	return client;
};

const disconnect = () => {
	client = null;
};

module.exports = {
	connect,
	disconnect,
};
