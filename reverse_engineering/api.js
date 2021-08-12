'use strict';

const connectionHelper = require('./helpers/connectionHelper');
const createBigQueryHelper = require('./helpers/bigQueryHelper');
const { createJsonSchema } = require('./helpers/jsonSchemaHelper');
const {
	BigQueryDate,
	BigQueryDatetime,
	BigQueryTime,
	BigQueryTimestamp,
	Geography,
} = require('@google-cloud/bigquery');
const { Big } = require("big.js");

const connect = (connectionInfo, logger) => {
	logger.clear();
	logger.log('info', connectionInfo, 'connectionInfo', connectionInfo.hiddenKeys);

	return connectionHelper.connect(connectionInfo);
};

const testConnection = async (connectionInfo, logger, cb) => {
	try {
		const client = connect(connectionInfo, logger);
		const bigQueryHelper = createBigQueryHelper(client);
		await bigQueryHelper.getDatasets();

		cb();
	} catch (err) {
		cb(prepareError(logger, err));
	}
};

const disconnect = async (connectionInfo, logger, cb) => {
	connectionHelper.disconnect();
	cb();
};

const getDbCollectionsNames = async (connectionInfo, logger, cb, app) => {
	try {
		const async = app.require('async');
		const client = connect(connectionInfo, logger);
		const bigQueryHelper = createBigQueryHelper(client);
		const datasets = await bigQueryHelper.getDatasets();
		const tablesByDataset = await async.mapSeries(datasets, async (dataset) => {
			const tables = await bigQueryHelper.getTables(dataset.id);
			const dbCollections = tables.filter(t => t.metadata.type !== 'VIEW').map(table => table.id);
			const views = tables.filter(t => t.metadata.type === 'VIEW').map(table => table.id);

			return {
				isEmpty: tables.length === 0,
				dbName: dataset.id,
				dbCollections,
				views,
			};
		});

		cb(null, tablesByDataset);
	} catch (err) {
		cb(prepareError(logger, err));
	}
};

const getDbCollectionsData = async (data, logger, cb, app) => {
	try {
		const _ = app.require('lodash');
		const async = app.require('async');
		const client = connect(data, logger);
		const log = createLogger({
			title: 'Reverse-engineering process',
			hiddenKeys: data.hiddenKeys,
			logger,
		});
		const bigQueryHelper = createBigQueryHelper(client);
		const project = await bigQueryHelper.getProjectInfo();
		const recordSamplingSettings = data.recordSamplingSettings;

		const modelInfo = {
			projectID: project.id,
			projectName: project.friendlyName, 
		};

		const packages = await async.reduce(data.collectionData.dataBaseNames, [], async (result, datasetName) => {
			log.info(`Process dataset "${datasetName}"`);
			log.progress(`Process dataset "${datasetName}"`, datasetName);

			const dataset = await bigQueryHelper.getDataset(datasetName);
			const bucketInfo = getBucketInfo({
				metadata: dataset.metadata,
				_,
			});

			const collectionPackages = await async.mapSeries(data.collectionData.collections[datasetName], async (tableName) => {
				log.info(`Get table metadata: "${tableName}"`);
				log.progress(`Get table metadata`, datasetName, tableName);

				const viewName = getViewName(tableName);
				const [table] = await dataset.table(viewName || tableName).get();
				const entityLevelData = getTableInfo({ _, table });
				const jsonSchema = createJsonSchema(table.metadata.schema);
				const maxCountRows = getCount(Number(table?.metadata?.numRows), recordSamplingSettings);

				log.info(`Get table rows: "${tableName}"`);
				log.progress(`Get table rows`, datasetName, tableName);

				const [rows] = await table.getRows({
					wrapIntegers: {
						integerTypeCastFunction(n) {
							return Number(n);
						}
					},
					maxResults: maxCountRows,
				});

				log.info(`Convert rows: "${tableName}"`);
				log.progress(`Convert rows`, datasetName, tableName);

				const documents = convertValue(rows);

				return {
					dbName: datasetName,
					collectionName: tableName,
					entityLevel: entityLevelData,
					documents: documents,
					views: [],
					emptyBucket: false,
					validation: {
						jsonSchema,
					},
					bucketInfo,
					standardDoc: documents[0],
				};
			});

			return result.concat(collectionPackages);
		});

		cb(null, packages, modelInfo);
	} catch (err) {
		cb(prepareError(logger, err));
	}
};

const createLogger = ({ title, logger, hiddenKeys }) => {
	return {
		info(message) {
			logger.log('info', { message }, title, hiddenKeys);
		},

		progress(message, dbName = '', tableName = '') {
			logger.progress({ message, containerName: dbName, entityName: tableName });
		},

		error(error) {
			logger.log('error', {
				message: error.message,
				stack: error.stack,
			}, title);
		}
	};
};

const getBucketInfo = ({ _, metadata }) => {
	return {
		name: metadata?.datasetReference.datasetId,
		datasetID: metadata.id,
		dataLocation: (metadata.location || '').toLowerCase(),
		description: metadata.description || '',
		labels: getLabels(_, metadata.labels),
		enableTableExpiration: Boolean(metadata.defaultTableExpirationMs),
		defaultExpiration: !isNaN(metadata.defaultTableExpirationMs) ? metadata.defaultTableExpirationMs / (1000 * 60 * 60 * 24) : '',
		...getEncryption(metadata.defaultEncryptionConfiguration),
	};
};

const getLabels = (_, labels) => {
	return _.keys(labels).map((labelKey) => ({ labelKey, labelValue: labels[labelKey] }));
};

const getViewName = (viewName) => {
	const regExp = / \(v\)$/i;
	
	if (regExp.test(viewName)) {
		return viewName.replace(regExp, '');
	}

	return '';
};

const getTableInfo = ({ _, table }) => {
	const metadata = table.metadata || {};

	return {
		...getPartitioning(metadata),
		tableType: metadata.tableType === 'EXTERNAL' ? 'External' : 'Native',
		description: metadata.description,
		temporary: Boolean(metadata.expirationTime),
		expiration: metadata.expirationTime,
		clusteringKey: metadata.clustering?.fields || [],
		...getEncryption(metadata.encryptionConfiguration),
		labels: getLabels(_, metadata.labels),
	};
};

const getEncryption = (encryptionConfiguration) => {
	return {
		encryption: encryptionConfiguration ? 'Customer-managed' : 'Google-managed',
		customerEncryptionKey: encryptionConfiguration?.kmsKeyName,
	};
};

const getPartitioning = (metadata) => {
	const partitioning = getPartitioningCategory(metadata);

	return {
		partitioning,
		partitioningFilterRequired: metadata.requirePartitionFilter,
		partitioningType: getPartitioningType(metadata.timePartitioning || {}),
		timeUnitpartitionKey: [metadata.timePartitioning?.field],
		rangeOptions: getPartitioningRange(metadata.rangePartitioning),
	};
};

const getPartitioningCategory = (metadata) => {
	if (metadata.timePartitioning) {
		if (metadata.timePartitioning.field) {
			return 'By time-unit column';
		} else {
			return 'By ingestion time';
		}
	}

	if (metadata.rangePartitioning) {
		return 'By integer-range';
	}

	return 'No partitioning';
};

const getPartitioningType = (timePartitioning) => {
	if (timePartitioning.type === 'HOUR') {
		return 'By hour';
	}

	if (timePartitioning.type === 'MONTH') {
		return 'By month';
	}

	if (timePartitioning.type === 'YEAR') {
		return 'By year';
	}

	return 'By day';
};

const getPartitioningRange = (rangePartitioning) => {
	if (!rangePartitioning) {
		return [];
	}

	return [{
		rangePartitionKey: [rangePartitioning.field],
		rangeStart: rangePartitioning.range?.start,
		rangeEnd: rangePartitioning.range?.end,
		rangeinterval: rangePartitioning.range?.interval,
	}];
};

const getCount = (count, recordSamplingSettings) => {
	const per = recordSamplingSettings.relative.value;
	const size = (recordSamplingSettings.active === 'absolute')
		? recordSamplingSettings.absolute.value
		: Math.round(count / 100 * per);
	return size;
};

const prepareError = (logger, error) => {
	const err = {
		message: error.message,
		stack: error.stack,
	};	

	logger.log('error', err, 'Reverse Engineering error');

	return err;
};

const convertValue = (value) => {
	if (
		value instanceof BigQueryDate
		||
		value instanceof BigQueryDatetime
		||
		value instanceof BigQueryTime
		||
		value instanceof BigQueryTimestamp
	) {
		return value.value;
	}

	if (value instanceof Buffer) {
		return value.toString('base64');
	}

	if (value instanceof Big) {
		return value.toNumber();
	}

	if (value instanceof Geography) {
		value = value.value;
	}

	if (Array.isArray(value)) {
		return value.map(convertValue);
	}

	if (value && typeof value === 'object') {
		return Object.keys(value)
			.reduce((result, key) => ({
				...result,
				[key]: convertValue(value[key])
			}),	{});
	}

	return value;
};

module.exports = {
	disconnect,
	testConnection,
	getDbCollectionsNames,
	getDbCollectionsData,
}