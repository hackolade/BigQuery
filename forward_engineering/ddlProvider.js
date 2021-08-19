const defaultTypes = require('./configs/defaultTypes');
const types = require('./configs/types');
const templates = require('./configs/templates');
const {
	isActivatedPartition,
	getTablePartitioning,
	getClusteringKey,
	getTableOptions,
	getColumnSchema,
	generateViewSelectStatement,
	getTimestamp,
} = require('./helpers');

module.exports = (baseProvider, options, app) => {
	const {
		tab,
		commentIfDeactivated,
		hasType,
	} = app.utils.general;
	const assignTemplates = app.utils.assignTemplates;
	const _ = app.require('lodash');
	const { getLabels, getFullName } = require('./helpers/general')(_);

	return {
		createDatabase({
			databaseName,
			friendlyName,
			description,
			ifNotExist,
			projectId,
			defaultExpiration,
			customerEncryptionKey,
			labels,
		}) {
			let dbOptions = [];

			if (friendlyName) {
				dbOptions.push(`friendly_name="${friendlyName}"`);
			}

			if (description) {
				dbOptions.push(`description="${description}"`);
			}

			if (customerEncryptionKey) {
				dbOptions.push(`default_kms_key_name="${customerEncryptionKey}"`);
			}

			if (defaultExpiration) {
				dbOptions.push(`default_table_expiration_days=${defaultExpiration}`);
			}

			if (labels.length) {
				dbOptions.push(`labels=[\n${
					tab(
						getLabels(labels)
					)}\n]`);
			}

			const databaseStatement = assignTemplates(templates.createDatabase, {
				name: getFullName(projectId, databaseName),
				ifNotExist: ifNotExist ? ' IF NOT EXISTS' : '',
				dbOptions: dbOptions.length ? `OPTIONS(\n${tab(dbOptions.join(',\n'))}\n)` : '',
			});

			return databaseStatement;
		},

		createTable(
			{
				name,
				columns,
				dbData,
				description,
				orReplace,
				ifNotExist,
				partitioning,
				partitioningType,
				timeUnitPartitionKey,
				partitioningFilterRequired,
				rangeOptions,
				temporary,
				expiration,
				tableType,
				clusteringKey,
				customerEncryptionKey,
				labels,
				friendlyName,
			},
			isActivated,
		) {
			const tableName = getFullName(dbData.projectId, dbData.databaseName, name);
			const orReplaceTable = orReplace ? 'OR REPLACE ' : '';
			const temporaryTable = temporary ? 'TEMPORARY ' : '';
			const ifNotExistTable = ifNotExist ? 'IF NOT EXISTS ' : '';
			const isPartitionActivated = isActivatedPartition({
				partitioning,
				timeUnitPartitionKey,
				rangeOptions,
			});
			const partitions = getTablePartitioning({
				partitioning,
				partitioningType,
				timeUnitPartitionKey,
				rangeOptions,
			});
			const clustering = getClusteringKey(clusteringKey, isActivated);
			const options = getTableOptions(tab, getLabels)({
				partitioningFilterRequired,
				customerEncryptionKey,
				partitioning,
				friendlyName,
				description,
				expiration,
				labels,
			});
			const external = tableType === 'External' ? 'EXTERNAL ' : '';
			const activatedColumns = columns.filter(column => column.isActivated).map(({ column }) => column);
			const deActivatedColumns = columns.filter(column => !column.isActivated).map(({ column }) => column);
			const partitionsStatement = commentIfDeactivated(partitions, { isActivated: isPartitionActivated });

			const tableStatement = assignTemplates(templates.createTable, {
				name: tableName,
				column_definitions: tab([activatedColumns.join(',\n'), deActivatedColumns.join(',\n')].filter(Boolean).join('\n')),
				orReplace: orReplaceTable,
				temporary: temporaryTable,
				ifNotExist: ifNotExistTable,
				partitions: partitionsStatement ? '\n' + partitionsStatement : '',
				clustering,
				external,
				options,
			});

			return tableStatement;
		},

		convertColumnDefinition(columnDefinition) {
			return {
				column: commentIfDeactivated(
					getColumnSchema({ assignTemplates, tab })(columnDefinition),
					{ isActivated: columnDefinition.isActivated }
				),
				isActivated: columnDefinition.isActivated,
			};
		},

		createView(viewData, dbData, isActivated) {
			const viewName = getFullName(dbData.projectId, dbData.databaseName, viewData.name);
			const columns = viewData.materialized ? [] : viewData.keys.map(key => key.alias || key.name);
			const isPartitionActivated = isActivatedPartition({
				partitioning: viewData.partitioning,
				timeUnitPartitionKey: viewData.partitioningType,
				rangeOptions: viewData.rangeOptions,
			});
			const partitions = getTablePartitioning({
				partitioning: viewData.partitioning,
				partitioningType: viewData.partitioningType,
				timeUnitPartitionKey: viewData.timeUnitPartitionKey,
				rangeOptions: viewData.rangeOptions,
			});
			const clustering = getClusteringKey(viewData.clusteringKey, isActivated)
			let options = [];

			if (viewData.friendlyName) {
				options.push(`friendly_name="${viewData.friendlyName}"`);
			}

			if (viewData.description) {
				options.push(`description="${viewData.description}"`);
			}

			if (viewData.expiration) {
				options.push(`expiration_timestamp=TIMESTAMP "${getTimestamp(viewData.expiration)}"`);
			}

			if (Array.isArray(viewData.labels) && viewData.labels.length) {
				options.push(`labels=[\n${tab(getLabels(viewData.labels))}\n]`);
			}

			if (viewData.enableRefresh) {
				options.push(`enable_refresh=true`);

				if (viewData.refreshInterval) {
					options.push(`refresh_interval_minutes=${viewData.refreshInterval}`);
				}
			}
			const partitionsStatement = commentIfDeactivated(partitions, { isActivated: isPartitionActivated });

			return assignTemplates(templates.createView, {
				name: viewName,
				materialized: viewData.materialized ? 'MATERIALIZED ' : '',
				orReplace: (viewData.orReplace && !viewData.materialized) ? 'OR REPLACE ' : '',
				ifNotExist: viewData.ifNotExist ? 'IF NOT EXISTS ' : '',
				columns: columns.length ? `\n (${columns.join(', ')})` : '',
				selectStatement: `\n ${_.trim(viewData.selectStatement ? viewData.selectStatement : generateViewSelectStatement(getFullName)({
					columns: viewData.keys,
					datasetName: dbData.databaseName,
					projectId: dbData.projectId,
				}))}`,
				options: options.length ? `\n OPTIONS(\n${tab(options.join(',\n'))}\n)` : '',
				partitions: partitionsStatement ? '\n' + partitionsStatement : '',
				clustering,
			});
		},

		getDefaultType(type) {
			return defaultTypes[type];
		},

		getTypesDescriptors() {
			return types;
		},

		hasType(type) {
			return hasType(types, type);
		},

		hydrateColumn({ columnDefinition, jsonSchema, dbData }) {
			return {
				name: columnDefinition.name,
				type: columnDefinition.type,
				isActivated: columnDefinition.isActivated,
				description: jsonSchema.description,
				dataTypeMode: jsonSchema.dataTypeMode,
				jsonSchema,
			};
		},


		hydrateDatabase(containerData, data) {
			const modelData = data?.modelData;

			return {
				databaseName: containerData.name,
				friendlyName: containerData.businessName,
				description: containerData.description,
				isActivated: containerData.isActivated,
				ifNotExist: containerData.ifNotExist,
				projectId: modelData?.[0]?.projectID,
				defaultExpiration: containerData.enableTableExpiration ? containerData.defaultExpiration : '',
				customerEncryptionKey: containerData.encryption === 'Customer-managed' ? containerData.customerEncryptionKey : '',
				labels: Array.isArray(containerData.labels) ? containerData.labels : [],
			};
		},

		hydrateTable({ tableData, entityData, jsonSchema }) {
			const data = entityData[0];

			return {
				...tableData,
				name: data.collectionName,
				friendlyName: jsonSchema.title && jsonSchema.title !== data.collectionName ? jsonSchema.title : '',
				description: data.description,
				orReplace: data.orReplace,
				ifNotExist: data.ifNotExist,
				partitioning: data.partitioning,
				partitioningType: data.partitioningType,
				timeUnitPartitionKey: data.timeUnitpartitionKey,
				partitioningFilterRequired: data.partitioningFilterRequired,
				rangeOptions: data.rangeOptions,
				temporary: data.temporary,
				expiration: data.expiration,
				tableType: data.tableType,
				clusteringKey: data.clusteringKey,
				clusteringOrder: data.clusteringOrder,
				customerEncryptionKey: data.encryption ? data.customerEncryptionKey : '',
				labels: data.labels,
			};
		},

		hydrateViewColumn(data) {
			return {
				name: data.name,
				tableName: data.entityName,
				alias: data.alias,
			};
		},

		hydrateView({ viewData, entityData, relatedSchemas, relatedContainers }) {
			const detailsTab = entityData[0];

			return {
				name: viewData.name,
				tableName: viewData.tableName,
				keys: viewData.keys,
				materialized: detailsTab.materialized,
				orReplace: detailsTab.orReplace,
				ifNotExist: detailsTab.ifNotExist,
				selectStatement: detailsTab.selectStatement,
				labels: detailsTab.labels,
				description: detailsTab.description,
				expiration: detailsTab.expiration,
				friendlyName: detailsTab.businessName,
				partitioning: detailsTab.partitioning,
				partitioningType: detailsTab.partitioningType,
				timeUnitPartitionKey: detailsTab.timeUnitpartitionKey,
				clusteringKey: detailsTab.clusteringKey,
				rangeOptions: detailsTab.rangeOptions,
				refreshInterval: detailsTab.refreshInterval,
				enableRefresh: detailsTab.enableRefresh,
			};
		},

		commentIfDeactivated(statement, data, isPartOfLine) {
			return commentIfDeactivated(statement, data, isPartOfLine);
		},
	};
};
