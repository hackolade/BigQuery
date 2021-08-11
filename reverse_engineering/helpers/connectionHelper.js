const {BigQuery} = require('@google-cloud/bigquery');

const connect = (connectionInfo) => {
	const projectId = connectionInfo.projectId;
	const keyFilename = connectionInfo.keyFilename;
	const location = connectionInfo.location;

	const client = new BigQuery({
		keyFilename,
		location,
		projectId,
	});

	return client;
};

module.exports = {
	connect,
};
