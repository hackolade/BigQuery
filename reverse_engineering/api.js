'use strict';

const connectionHelper = require('./helpers/connectionHelper');
const createBigQueryHelper = require('./helpers/bigQueryHelper');

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
		const bigQueryHelper = createBigQueryHelper(client);
		const project = await bigQueryHelper.getProjectInfo();

		const modelInfo = {
			projectID: project.id,
			projectName: project.friendlyName, 
		};

		const packages = await async.reduce(data.collectionData.dataBaseNames, [], async (result, datasetName) => {
			const dataset = await bigQueryHelper.getDataset(datasetName);
			const bucketInfo = getBucketInfo({
				metadata: dataset.metadata,
				_,
			});

			const collectionPackages = await async.mapSeries(data.collectionData.collections[datasetName], async (tableName) => {
				const viewName = getViewName(tableName);
				const [table] = await dataset.table(viewName || tableName).get();
				const entityLevelData = getTableInfo({ _, table });
				const jsonSchema = createJsonSchema(table.metadata.schema);

				return {
					dbName: datasetName,
					collectionName: tableName,
					entityLevel: entityLevelData,
					documents: [],
					views: [],
					emptyBucket: false,
					validation: {
						jsonSchema,
					},
					bucketInfo,
				};
			});

			return result.concat(collectionPackages);
		});

		cb(null, packages, modelInfo);
	} catch (err) {
		cb(prepareError(logger, err));
	}
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

const createJsonSchema = (schema) => {
	const properties = getProperties(schema.fields);

	return {
		properties,
	};
};

const getProperties = (fields) => {
	return fields.reduce((properties, field) => {
		return {
			...properties,
			[field.name]: convertField(field),
		};
	}, {});
};

const convertField = (field) => {
	const type = getType(field.type);
	const dataTypeMode = getTypeMode(field.mode);
	const description = field.description;

	if (field.mode === 'REPEATED') {
		return {
			type: 'array',
			items: convertField({
				...field,
				mode: 'NULLABLE',
			}),
		};
	}

	if (Array.isArray(field.fields)) {
		const properties = getProperties(field.fields);

		return {
			type,
			description,
			properties,
			dataTypeMode,
		};
	}


	return {
		type,
		description,
		dataTypeMode,
	};
};

const getTypeMode = (mode) => {
	switch(mode) {
		case 'REQUIRED':
			return 'Required';
		case 'REPEATED':
			return 'Repeated';
		default:
			return 'Nullable';
	}
};

const getType = (fieldType) => {
	switch(fieldType) {
		case 'RECORD':
			return 'struct';
		case 'GEOGRAPHY':
			return 'geography';
		case 'TIME':
			return 'time';
		case 'DATETIME':
			return 'datetime';
		case 'DATE':
			return 'date';
		case 'TIMESTAMP':
			return 'timestamp';
		case 'BOOLEAN':
			return 'bool';
		case 'BIGNUMERIC':
			return 'bignumeric';
		case 'NUMERIC':
			return 'numeric';
		case 'FLOAT':
			return 'float64';
		case 'INTEGER':
			return 'int64';
		case 'BYTES':
			return 'bytes';
		case 'STRING':
		default:
			return 'string';
	}
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

module.exports = {
	disconnect,
	testConnection,
	getDbCollectionsNames,
	getDbCollectionsData,
}