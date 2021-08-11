const {BigQuery} = require('@google-cloud/bigquery');

let client = null;

const connect = (connectionInfo) => {
	if (client) {
		return client;
	}
	
	const projectId = connectionInfo.projectId;
	const keyFilename = connectionInfo.keyFilename;
	const location = connectionInfo.location;

	client = new BigQuery({
		keyFilename,
		location,
		projectId,
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
