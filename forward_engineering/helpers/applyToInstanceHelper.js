const connectionHelper = require('../../reverse_engineering/helpers/connectionHelper');

const execute = async (bigquery, query, location) => {
	const response = await bigquery.createJob({
		configuration: {
			query: {
			  query: query,
			  useLegacySql: false,
			},
		},
		location,
	});
	const job = response[0];
	const result = await job.getQueryResults(job);

	return result;
};

const applyToInstance = async (connectionInfo, logger, app) => {
	const _ = app.require('lodash');
	const async = app.require('async');
	const connection = connectionHelper.connect(connectionInfo);
	const dataLocation = connectionInfo.containerData?.[0]?.dataLocation;
	const location = dataLocation === 'default' ? '' : dataLocation;

	const queries = connectionInfo.script.split('\n\n').map((query) => {
		return _.trim(query);
	}).filter(Boolean);

	await async.mapSeries(queries, async query => {
		const message = 'Query: ' + query.split('\n').shift().substr(0, 150);
		logger.progress({ message });
		await execute(connection, query, location);
	});
};

module.exports = { applyToInstance };
