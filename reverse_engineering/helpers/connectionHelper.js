const { BigQuery, credentials } = require('@google-cloud/bigquery');
const fsExtra = require('fs-extra');
const path = require('path');

let client = null;

function getAuthInfo({ authType, connectionInfo }) {
	if (authType === 'app_default_credentials') {
		// In this authType case projectId is mandatory
		return {
			projectId: connectionInfo.projectId,
			credentialsFilePath: connectionInfo.credentialsFilePath,
		};
	}
	// service account case and backward compatible value
	return {
		projectId: connectionInfo.projectId,
		credentialsFilePath: connectionInfo.keyFilename,
	};
}

const connect = async connectionInfo => {
	if (client) {
		return client;
	}
	const authType = connectionInfo.authType;
	const { projectId, credentialsFilePath } = getAuthInfo({ authType, connectionInfo });
	const location = connectionInfo.location;
	const credentials = await fsExtra.readJson(path.resolve(credentialsFilePath));

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
