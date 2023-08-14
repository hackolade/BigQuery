'use strict';

const connectionHelper = require('./helpers/connectionHelper');
const createBigQueryHelper = require('./helpers/bigQueryHelper');
const { createJsonSchema } = require('./helpers/jsonSchemaHelper');
const { injectPrimaryKeyConstraintsIntoTable, reverseForeignKeys } = require('./helpers/constraintsHelper')
const {
	BigQueryDate,
	BigQueryDatetime,
	BigQueryTime,
	BigQueryTimestamp,
	Geography,
} = require('@google-cloud/bigquery');
const { Big } = require('big.js');
const parseSelectStatement = require('@hackolade/sql-select-statement-parser');

const getDatabases = async (connectionInfo, logger, callback, app) => {
	try {
		await getDbCollectionsNames(connectionInfo, logger, callback, app)
	} catch (err) {
		callback(prepareError(logger, err));
	}
};

const getCollections = async (data, logger, callback, app) => {
	try {
		const datasetId = data.name
		const log = createLogger({
			title: 'Reverse-engineering process',
			hiddenKeys: data.hiddenKeys,
			logger,
		});
		log.info(`Retrieving dataset ${datasetId} tables`);
		const client = connect(data, logger);
		const bigQueryHelper = createBigQueryHelper(client, log);
		const rawTables = await bigQueryHelper.getTables(datasetId);
		const tables = rawTables.map(table => ({name: table.id, containerName: table.dataset.id, ...table}))
		callback(null, tables);
	} catch (err) {
		callback(prepareError(logger, err));
	}
};

const connect = (connectionInfo, logger) => {
	logger.clear();
	logger.log('info', connectionInfo, 'connectionInfo', connectionInfo.hiddenKeys);

	return connectionHelper.connect(connectionInfo);
};

const testConnection = async (connectionInfo, logger, cb) => {
	try {
		const log = createLogger({
			title: 'Reverse-engineering process',
			hiddenKeys: connectionInfo.hiddenKeys,
			logger,
		});
		const client = connect(connectionInfo, logger);
		const bigQueryHelper = createBigQueryHelper(client, log);
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
		const log = createLogger({
			title: 'Reverse-engineering process',
			hiddenKeys: connectionInfo.hiddenKeys,
			logger,
		});
		const client = connect(connectionInfo, logger);
		const bigQueryHelper = createBigQueryHelper(client, log);
		const datasets = await bigQueryHelper.getRequiredDatasets(connectionInfo.datasetId)
		const tablesByDataset = await async.mapSeries(datasets, async dataset => {
			const tables = await bigQueryHelper.getTables(dataset.id);
			const viewTypes = ['MATERIALIZED_VIEW', 'VIEW'];
			const dbCollections = tables.filter(t => !viewTypes.includes(t.metadata.type)).map(table => table.id);
			const views = tables.filter(t => viewTypes.includes(t.metadata.type)).map(table => table.id);

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
		const bigQueryHelper = createBigQueryHelper(client, log);
		const project = await bigQueryHelper.getProjectInfo();
		const recordSamplingSettings = data.recordSamplingSettings;

		const modelInfo = {
			projectID: project.id,
			projectName: project.friendlyName,
		};
		let relationships = []

		const packages = await async.reduce(data.collectionData.dataBaseNames, [], async (result, datasetName) => {
			log.info(`Process dataset "${datasetName}"`);
			log.progress(`Process dataset "${datasetName}"`, datasetName);

			const dataset = await bigQueryHelper.getDataset(datasetName);
			const bucketInfo = getBucketInfo({
				metadata: dataset.metadata,
				datasetName,
				_,
			});
			const tables = (data.collectionData.collections[datasetName] || []).filter(item => !getViewName(item));
			const views = (data.collectionData.collections[datasetName] || []).map(getViewName).filter(Boolean);

			const {
				primaryKeyConstraintsData, foreignKeyConstraintsData
			} = await bigQueryHelper.getConstraintsData(project.id, datasetName)
			const newRelationships = foreignKeyConstraintsData ? reverseForeignKeys(foreignKeyConstraintsData) : []
			relationships = [...relationships, ...newRelationships]
			
			log.info(`Getting dataset constraints "${datasetName}"`);
			log.progress(`Getting dataset constraints "${datasetName}"`, datasetName);

			const collectionPackages = await async.mapSeries(tables, async tableName => {
				log.info(`Get table metadata: "${tableName}"`);
				log.progress(`Get table metadata`, datasetName, tableName);

				const [table] = await dataset.table(tableName).get();
				const friendlyName = table.metadata.friendlyName;

				log.info(`Get table rows: "${tableName}"`);
				log.progress(`Get table rows`, datasetName, tableName);

				const [rows] = await bigQueryHelper.getRows(tableName, table, recordSamplingSettings);
				log.info(`Convert rows: "${tableName}"`);
				log.progress(`Convert rows`, datasetName, tableName);
				const rawJsonSchema = createJsonSchema(table.metadata.schema, rows);
				const { propertiesWithInjectedConstraints, primaryKey } = 
				injectPrimaryKeyConstraintsIntoTable(
						{
							datasetId: dataset.id, 
							properties: rawJsonSchema.properties, 
							tableName, 
							constraintsData: primaryKeyConstraintsData
						}
					)
				const jsonSchema = {
					...rawJsonSchema,
					properties: propertiesWithInjectedConstraints,
				}
				const documents = convertValue(rows);

				return {
					dbName: bucketInfo.name,
					collectionName: friendlyName || tableName,
					entityLevel: {...getTableInfo({ _, table, tableName }), primaryKey},
					documents: documents,
					standardDoc: documents[0],
					views: [],
					emptyBucket: false,
					validation: {
						jsonSchema,
					},
					bucketInfo,
				};
			});
			const viewsPackages = await async.mapSeries(views, async viewName => {
				log.info(`Get view metadata: "${viewName}"`);
				log.progress(`Get view metadata`, datasetName, viewName);

				const [view] = await dataset.table(viewName).get();
				const viewData = view.metadata.materializedView || view.metadata.view;

				log.info(`Process view: "${viewName}"`);
				log.progress(`Process view`, datasetName, viewName);

				const friendlyName = view.metadata.friendlyName;

				const viewJsonSchema = createJsonSchema(view.metadata.schema);

				return {
					dbName: bucketInfo.name,
					name: friendlyName || viewName,
					jsonSchema: createViewSchema({
						viewQuery: viewData.query,
						tablePackages: collectionPackages,
						viewJsonSchema,
						log,
					}),
					data: {
						name: friendlyName || viewName,
						code: friendlyName ? viewName : '',
						materialized: view.metadata.type === 'MATERIALIZED_VIEW',
						description: view.metadata.description,
						selectStatement: viewData.query,
						labels: getLabels(_, view.metadata.labels),
						expiration: view.metadata.expirationTime ? Number(view.metadata.expirationTime) : undefined,
						clusteringKey: view.metadata.clustering?.fields || [],
						...getPartitioning(view.metadata),
						enableRefresh: Boolean(viewData?.enableRefresh),
						refreshInterval: isNaN(viewData?.refreshIntervalMs)
							? ''
							: Number(viewData?.refreshIntervalMs) / (60 * 1000),
					},
				};
			});

			result = result.concat(collectionPackages);

			if (viewsPackages.length) {
				result = result.concat({
					dbName: bucketInfo.name,
					views: viewsPackages,
					emptyBucket: false,
				});
			}

			return result;
		});

		cb(null, packages, modelInfo, relationships);
	} catch (err) {
		cb(prepareError(logger, err));
	}
};

const createLogger = ({ title, logger, hiddenKeys }) => {
	return {
		info(message) {
			logger.log('info', { message }, title, hiddenKeys);
		},

		warn(message, context) {
			logger.log('info', { message: '[warning] ' + message, context }, title, hiddenKeys);
		},

		progress(message, dbName = '', tableName = '') {
			logger.progress({ message, containerName: dbName, entityName: tableName });
		},

		error(error) {
			logger.log(
				'error',
				{
					message: error.message,
					stack: error.stack,
				},
				title,
			);
		},
	};
};

const getBucketInfo = ({ _, metadata, datasetName }) => {
	const name = metadata?.datasetReference?.datasetId;
	const friendlyName = metadata.friendlyName;

	return {
		name: friendlyName || name,
		code: friendlyName ? name : friendlyName,
		datasetID: metadata.id,
		dataLocation: (metadata.location || '').toLowerCase(),
		description: metadata.description || '',
		labels: getLabels(_, metadata.labels),
		enableTableExpiration: Boolean(metadata.defaultTableExpirationMs),
		defaultExpiration: !isNaN(metadata.defaultTableExpirationMs)
			? metadata.defaultTableExpirationMs / (1000 * 60 * 60 * 24)
			: undefined,
		...getEncryption(metadata.defaultEncryptionConfiguration),
	};
};

const getLabels = (_, labels) => {
	return _.keys(labels).map(labelKey => ({ labelKey, labelValue: labels[labelKey] }));
};

const getViewName = viewName => {
	const regExp = / \(v\)$/i;

	if (regExp.test(viewName)) {
		return viewName.replace(regExp, '');
	}

	return '';
};

const getTableInfo = ({ _, table, tableName }) => {
	const metadata = table.metadata || {};
	const collectionName = metadata.friendlyName || tableName;

	return {
		...getPartitioning(metadata),
		collectionName,
		code: metadata.friendlyName ? tableName : '',
		tableType: metadata.tableType === 'EXTERNAL' || metadata.type === 'EXTERNAL' ? 'External' : 'Native',
		description: metadata.description,
		expiration: metadata.expirationTime ? Number(metadata.expirationTime) : undefined,
		clusteringKey: metadata.clustering?.fields || [],
		...getEncryption(metadata.encryptionConfiguration),
		labels: getLabels(_, metadata.labels),
		tableOptions: getExternalOptions(metadata),
	};
};

const getExternalOptions = metadata => {
	const options = metadata.externalDataConfiguration || {};
	const format =
		{
			CSV: 'CSV',
			GOOGLE_SHEETS: 'GOOGLE_SHEETS',
			NEWLINE_DELIMITED_JSON: 'JSON',
			AVRO: 'AVRO',
			DATASTORE_BACKUP: 'DATASTORE_BACKUP',
			ORC: 'ORC',
			PARQUET: 'PARQUET',
			BIGTABLE: 'CLOUD_BIGTABLE',
			JSON: 'JSON',
			CLOUD_BIGTABLE: 'CLOUD_BIGTABLE',
		}[(options.sourceFormat || '').toUpperCase()] || '';
	return {
		format: format,
		uris: (options.sourceUris || []).map(uri => ({ uri })),
		bigtableUri: format === 'CLOUD_BIGTABLE' ? options.sourceUris?.[0] || '' : '',
		autodetect: options.autodetect,
		max_staleness: metadata.maxStaleness,
		metadata_cache_mode:
			{
				AUTOMATIC: 'AUTOMATIC',
				MANUAL: 'MANUAL',
			}[(options.metadataCacheMode || '').toUpperCase()] || '',
		object_metadata: options.objectMetadata || '',
		decimal_target_types: (options.decimalTargetTypes || []).map(value => ({ value })),
		allow_quoted_newlines: options.csvOptions?.allowQuotedNewlines,
		allow_jagged_rows: options.csvOptions?.allowJaggedRows,
		quote: options.csvOptions?.quote,
		skip_leading_rows: options.csvOptions?.skipLeadingRows || options.googleSheetsOptions?.skipLeadingRows,
		preserve_ascii_control_characters: options.csvOptions?.preserveAsciiControlCharacters,
		null_marker: options.csvOptions?.nullMarker,
		field_delimiter: options.csvOptions?.fieldDelimiter,
		encoding: options.csvOptions?.encoding,
		ignore_unknown_values: options.ignoreUnknownValues,
		compression: options.compression,
		max_bad_records: options.maxBadRecords,
		require_hive_partition_filter: options.hivePartitioningOptions?.requirePartitionFilter,
		hive_partition_uri_prefix: options.hivePartitioningOptions?.sourceUriPrefix,
		sheet_range: options.googleSheetsOptions?.range,
		reference_file_schema_uri: options.referenceFileSchemaUri,
		enable_list_inference: options.parquetOptions?.enableListInference,
		enum_as_string: options.parquetOptions?.enumAsString,
		enable_logical_types: options.avroOptions?.useAvroLogicalTypes,
		bigtable_options: JSON.stringify(options.bigtableOptions, null, 4),
		json_extension: options.jsonExtension,
	};
};

const getEncryption = encryptionConfiguration => {
	return {
		encryption: encryptionConfiguration ? 'Customer-managed' : 'Google-managed',
		customerEncryptionKey: encryptionConfiguration?.kmsKeyName,
	};
};

const getPartitioning = metadata => {
	const partitioning = getPartitioningCategory(metadata);

	return {
		partitioning,
		partitioningFilterRequired: metadata.requirePartitionFilter,
		partitioningType: getPartitioningType(metadata.timePartitioning || {}),
		timeUnitpartitionKey: [metadata.timePartitioning?.field],
		rangeOptions: getPartitioningRange(metadata.rangePartitioning),
	};
};

const getPartitioningCategory = metadata => {
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

const getPartitioningType = timePartitioning => {
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

const getPartitioningRange = rangePartitioning => {
	if (!rangePartitioning) {
		return [];
	}

	return [
		{
			rangePartitionKey: [rangePartitioning.field],
			rangeStart: rangePartitioning.range?.start,
			rangeEnd: rangePartitioning.range?.end,
			rangeinterval: rangePartitioning.range?.interval,
		},
	];
};

const prepareError = (logger, error) => {
	const err = {
		message: error.message,
		stack: error.stack,
	};

	logger.log('error', err, 'Reverse Engineering error');

	return err;
};

const convertValue = value => {
	if (
		value instanceof BigQueryDate ||
		value instanceof BigQueryDatetime ||
		value instanceof BigQueryTime ||
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
		return Object.keys(value).reduce(
			(result, key) => ({
				...result,
				[key]: convertValue(value[key]),
			}),
			{},
		);
	}

	return value;
};

const equalByStructure = (a, b) => {
	if (!a || !b) {
		return false;
	}

	if (a.type !== b.type) {
		return false;
	}

	if (
		(a.properties && !b.properties) ||
		(!a.properties && b.properties) ||
		(!a.items && b.items) ||
		(a.items && !b.items)
	) {
		return false;
	}

	if (a.properties && b.properties) {
		return Object.keys(a.properties).every(key => equalByStructure(a.properties[key], b.properties[key]));
	}

	if (Array.isArray(a.items) && Array.isArray(b.items)) {
		return a.items.every((item, i) => equalByStructure(item, b.item[i]));
	}

	if (a.items && b.items) {
		return equalByStructure(a.items, b.items);
	}

	return true;
};

const findViewPropertyByTableProperty = (viewSchema, tableProperty) => {
	if (viewSchema.properties[tableProperty.alias]) {
		return tableProperty.alias;
	}

	return Object.keys(viewSchema.properties).find(key => equalByStructure(viewSchema.properties[key], tableProperty));
};

const createViewSchema = ({ viewQuery, tablePackages, viewJsonSchema, log }) => {
	try {
		const result = parseSelectStatement(viewQuery);
		const columns = result.selectItems.map(column => {
			return {
				alias: column.alias,
				name: column.name || column.fieldReferences[column.fieldReferences.length - 1] || column.alias,
				table: column.tableName || '',
			};
		});

		const tablesProperties = result.from.reduce((result, fromItem) => {
			const nameArray = fromItem.table.split('.');
			const tableName = nameArray.length > 1 ? nameArray[nameArray.length - 1] : nameArray[0];
			const schemaName = nameArray.length > 1 ? nameArray[nameArray.length - 2] : fromItem.schemaName;

			const pack = tablePackages.find(
				pack => (pack.dbName === schemaName || !schemaName) && pack.collectionName === tableName,
			);

			if (!pack) {
				return result;
			}

			const tableColumns = columns.filter(
				column => column.table === tableName || column.table === fromItem.alias || !column.table,
			);
			const tableSchema = pack.validation.jsonSchema;
			const tableProperties = tableColumns
				.map(column => {
					if (!tableSchema.properties[column.name]) {
						return;
					}

					return {
						...tableSchema.properties[column.name],
						table: tableName,
						name: column.name,
						alias: column.alias,
					};
				})
				.filter(Boolean);

			return result.concat(tableProperties);
		}, []);

		return tablesProperties.reduce((resultSchema, property, i) => {
			const viewProperty = findViewPropertyByTableProperty(resultSchema, property);

			if (!viewProperty) {
				return resultSchema;
			}

			return {
				...resultSchema,
				properties: {
					...resultSchema.properties,
					[viewProperty]: {
						$ref: `#collection/definitions/${property.table}/${property.name}`,
					},
				},
			};
		}, viewJsonSchema);
	} catch (e) {
		log.info('Error with processing view select statement: ' + viewQuery);
		log.error(e);

		return viewJsonSchema;
	}
};

module.exports = {
	disconnect,
	testConnection,
	getDbCollectionsNames,
	getDbCollectionsData,
	getDatabases,
	getCollections
};
