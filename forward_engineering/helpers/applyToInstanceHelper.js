const connectionHelper = require('../../reverse_engineering/helpers/connectionHelper');
const { addTagKeyDetail } = require('./tagsHelper');

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
	const connection = await connectionHelper.connect(connectionInfo);
	const dataLocation = connectionInfo.containerData?.[0]?.dataLocation;
	const location = dataLocation === 'default' ? '' : dataLocation;

	const queries = connectionInfo.script
		.split('\n\n')
		.map(_.trim)
		.filter(query => query && !query.startsWith('--'));

	await async.mapSeries(queries, async query => {
		const message = 'Query: ' + query.split('\n').shift().substr(0, 150);
		logger.progress({ message });

		try {
			await execute(connection, query, location);
		} catch (error) {
			throw addTagKeyDetail({ error, query, logger });
		}
	});
};

module.exports = { applyToInstance };
