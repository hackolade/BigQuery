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
	escapeQuotes,
	clearEmptyStatements,
	prepareConstraintName,
	wrapByBackticks,
} = require('./helpers/utils');

module.exports = (baseProvider, options, app) => {
	const { tab, commentIfDeactivated, hasType, checkAllKeysDeactivated } =
		app.require('@hackolade/ddl-fe-utils').general;
	const assignTemplates = app.require('@hackolade/ddl-fe-utils').assignTemplates;
	const _ = app.require('lodash');
	const {
		getLabels,
		getFullName,
		getContainerOptions,
		getViewOptions,
		cleanObject,
		foreignKeysToString,
		foreignActiveKeysToString,
	} = require('./helpers/general')(app);

	const { joinActivatedAndDeactivatedStatements } = require('./utils/statementJoiner');

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
			return assignTemplates(templates.createDatabase, {
				name: getFullName(projectId, databaseName),
				ifNotExist: ifNotExist ? ' IF NOT EXISTS' : '',
				dbOptions: getContainerOptions({
					friendlyName,
					description,
					defaultExpiration,
					customerEncryptionKey,
					labels,
				}),
			});
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
				externalTableOptions,
				foreignKeyConstraints,
				primaryKey,
				properties,
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
				properties,
			});
			const clustering = getClusteringKey(clusteringKey, isActivated);
			const isExternal = tableType === 'External';
			const options = getTableOptions(
				tab,
				getLabels,
			)({
				externalTableOptions: isExternal ? _.omit(externalTableOptions, 'autodetect') : null,
				partitioningFilterRequired: isExternal ? false : partitioningFilterRequired,
				customerEncryptionKey,
				partitioning,
				friendlyName,
				description,
				expiration,
				labels,
			});
			const external = isExternal ? 'EXTERNAL ' : '';
			const columnStatementDtos = (columns || []).map(columnDto => ({
				statement: columnDto.column,
				isActivated: columnDto.isActivated,
			}));
			const partitionsStatement = commentIfDeactivated(partitions, { isActivated: isPartitionActivated });
			const compositePkFieldsNamesList = primaryKey.flatMap(compositePK =>
				compositePK?.compositePrimaryKey.map(key => wrapByBackticks(key.name)),
			);
			const compositePrimaryKeyOutlineConstraint = compositePkFieldsNamesList.length
				? `PRIMARY KEY (${compositePkFieldsNamesList.join(', ')}) NOT ENFORCED`
				: '';
			const compositePrimaryKeyOutlineConstraintStatementDto = {
				statement: compositePrimaryKeyOutlineConstraint,
				isActivated: true,
			};
			const foreignKeyConstraintStatementDtos = (foreignKeyConstraints || []).map(constraintDto => ({
				statement: commentIfDeactivated(constraintDto.statement, { isActivated: constraintDto.isActivated }),
				isActivated: constraintDto.isActivated,
			}));

			const statementDtosToAddInsideTable = [
				...columnStatementDtos,
				compositePrimaryKeyOutlineConstraintStatementDto,
				...foreignKeyConstraintStatementDtos,
			].filter(statementDto => Boolean(statementDto.statement));
			const joinedStatementsToAddInsideTable = joinActivatedAndDeactivatedStatements({
				statementDtos: statementDtosToAddInsideTable,
				delimiter: ',\n',
				delimiterForLastActivatedStatement: '\n',
			});

			const tableStatement = assignTemplates(templates.createTable, {
				name: tableName,
				column_definitions: externalTableOptions?.autodetect
					? ''
					: '(\n' + tab(joinedStatementsToAddInsideTable) + '\n)',
				orReplace: orReplaceTable,
				temporary: temporaryTable,
				ifNotExist: ifNotExistTable,
				partitions: partitionsStatement && !isExternal ? '\n' + partitionsStatement : '',
				clustering: isExternal ? '' : clustering,
				external,
				options,
			});

			return tableStatement;
		},

		convertColumnDefinition(columnDefinition) {
			return {
				column: commentIfDeactivated(getColumnSchema({ assignTemplates, tab, templates })(columnDefinition), {
					isActivated: columnDefinition.isActivated,
				}),
				isActivated: columnDefinition.isActivated,
			};
		},

		createView(viewData, dbData, isActivated) {
			const viewName = getFullName(dbData.projectId, dbData.databaseName, viewData.name);
			let columns = '';
			const allDeactivated = viewData.keys.length && viewData.keys.every(key => !key.isActivated);

			if (!viewData.materialized) {
				if (isActivated && !allDeactivated) {
					const activated = viewData.keys
						.filter(key => key.isActivated)
						.map(key => key.alias || key.name)
						.filter(Boolean)
						.map(wrapByBackticks);
					const deActivated = viewData.keys
						.filter(key => !key.isActivated)
						.map(key => key.alias || key.name)
						.filter(Boolean)
						.map(wrapByBackticks);

					columns = activated.join(', ') + (deActivated.length ? `/* ${deActivated.join(', ')} */` : '');
				} else {
					columns = viewData.keys
						.map(key => wrapByBackticks(key.alias || key.name))
						.filter(Boolean)
						.join(', ');
				}
			}
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
				properties: viewData.properties,
			});
			const clustering = getClusteringKey(viewData.clusteringKey, isActivated);
			const partitionsStatement = commentIfDeactivated(partitions, { isActivated: isPartitionActivated });

			const statement = assignTemplates(templates.createView, {
				name: viewName,
				materialized: viewData.materialized ? 'MATERIALIZED ' : '',
				orReplace: viewData.orReplace && !viewData.materialized ? 'OR REPLACE ' : '',
				ifNotExist: viewData.ifNotExist ? 'IF NOT EXISTS ' : '',
				columns: columns.length ? `\n (${columns})` : '',
				selectStatement: `\n ${_.trim(
					viewData.selectStatement
						? viewData.selectStatement
						: generateViewSelectStatement(
								getFullName,
								isActivated && !allDeactivated,
							)({
								columns: viewData.keys,
								datasetName: dbData.databaseName,
								projectId: dbData.projectId,
							}),
				)}`,
				options: getViewOptions(viewData),
				partitions: partitionsStatement ? '\n' + partitionsStatement : '',
				clustering,
			});

			if (isActivated && allDeactivated) {
				return commentIfDeactivated(statement, { isActivated: false });
			} else {
				return statement;
			}
		},

		createForeignKeyConstraint(
			{
				name,
				isActivated,
				foreignKey,
				primaryTable,
				primaryKey,
				primaryTableActivated,
				foreignTableActivated,
				primarySchemaName,
			},
			dbData,
			schemaData,
		) {
			const isAllPrimaryKeysDeactivated = checkAllKeysDeactivated(primaryKey);
			const isAllForeignKeysDeactivated = checkAllKeysDeactivated(foreignKey);
			const isActivatedBasedOnTableData =
				isActivated &&
				!isAllPrimaryKeysDeactivated &&
				!isAllForeignKeysDeactivated &&
				primaryTableActivated &&
				foreignTableActivated;

			return {
				statement: assignTemplates(templates.createForeignKeyConstraint, {
					constraintName: name ? `CONSTRAINT ${prepareConstraintName(name)} ` : '',
					foreignKeys: isActivatedBasedOnTableData
						? foreignKeysToString(foreignKey)
						: foreignActiveKeysToString(foreignKey),
					primaryTableName: getFullName(null, primarySchemaName, primaryTable),
					primaryKeys: isActivatedBasedOnTableData
						? foreignKeysToString(primaryKey)
						: foreignActiveKeysToString(primaryKey),
				}),
				isActivated: isActivatedBasedOnTableData,
			};
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
				description: jsonSchema.refDescription || jsonSchema.description,
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
				customerEncryptionKey:
					containerData.encryption === 'Customer-managed' ? containerData.customerEncryptionKey : '',
				labels: Array.isArray(containerData.labels) ? containerData.labels : [],
			};
		},

		hydrateTable({ tableData, entityData, jsonSchema }) {
			const data = entityData[0];
			const primaryKey = entityData[1]?.primaryKey ?? [];
			const tableOptions = data.tableOptions || {};
			const uris = (tableOptions.uris || []).map(uri => uri.uri).filter(Boolean);
			const decimal_target_types = (tableOptions.decimal_target_types || []).map(({ value }) => value);
			const commonOptions = {
				format: tableOptions.format,
				uris: !_.isEmpty(uris) ? uris : undefined,
				decimal_target_types: !_.isEmpty(decimal_target_types) ? decimal_target_types : undefined,
				autodetect: tableOptions.autodetect,
			};

			return {
				...tableData,
				name: data.code || data.collectionName,
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
				customerEncryptionKey: data.encryption ? data.customerEncryptionKey : '',
				labels: data.labels,
				primaryKey,
				externalTableOptions: cleanObject(
					{
						AVRO: {
							...commonOptions,
							..._.pick(tableOptions, [
								'require_hive_partition_filter',
								'hive_partition_uri_prefix',
								'reference_file_schema_uri',
								'enable_logical_types',
							]),
						},
						CSV: {
							...commonOptions,
							..._.pick(tableOptions, [
								'allow_quoted_newlines',
								'allow_jagged_rows',
								'quote',
								'skip_leading_rows',
								'preserve_ascii_control_characters',
								'null_marker',
								'field_delimiter',
								'encoding',
								'ignore_unknown_values',
								'compression',
								'max_bad_records',
								'require_hive_partition_filter',
								'hive_partition_uri_prefix',
							]),
						},
						DATASTORE_BACKUP: {
							...commonOptions,
							..._.pick(tableOptions, ['projection_fields']),
						},
						GOOGLE_SHEETS: {
							...commonOptions,
							..._.pick(tableOptions, ['max_bad_records', 'sheet_range']),
						},
						JSON: {
							...commonOptions,
							..._.pick(tableOptions, [
								'ignore_unknown_values',
								'compression',
								'max_bad_records',
								'require_hive_partition_filter',
								'hive_partition_uri_prefix',
								'json_extension',
							]),
						},
						ORC: {
							...commonOptions,
							..._.pick(tableOptions, [
								'require_hive_partition_filter',
								'hive_partition_uri_prefix',
								'reference_file_schema_uri',
							]),
						},
						PARQUET: {
							...commonOptions,
							..._.pick(tableOptions, [
								'require_hive_partition_filter',
								'hive_partition_uri_prefix',
								'reference_file_schema_uri',
								'enable_list_inference',
								'enum_as_string',
							]),
						},
						CLOUD_BIGTABLE: {
							...commonOptions,
							uris: [tableOptions.bigtableUri],
							bigtable_options: tableOptions.bigtable_options,
						},
					}[tableOptions.format] || {},
				),
				properties: jsonSchema.properties,
			};
		},

		hydrateViewColumn(data) {
			return {
				name: data.name,
				tableName: data.entityName,
				alias: data.alias,
				isActivated: data.isActivated,
			};
		},

		hydrateView({ viewData, entityData, jsonSchema }) {
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
				maxStaleness: detailsTab.maxStaleness,
				allowNonIncrementalDefinition: detailsTab.allowNonIncrementalDefinition,
				properties: jsonSchema.properties,
			};
		},

		commentIfDeactivated(statement, data, isPartOfLine) {
			return commentIfDeactivated(statement, data, isPartOfLine);
		},

		// * statements for alter script from delta model
		dropDatabase(name) {
			return assignTemplates(templates.dropDatabase, { name });
		},

		alterDatabase({
			databaseName,
			friendlyName,
			description,
			projectId,
			defaultExpiration,
			customerEncryptionKey,
			labels,
		}) {
			return assignTemplates(templates.alterDatabase, {
				name: getFullName(projectId, databaseName),
				dbOptions: getContainerOptions({
					friendlyName,
					description,
					defaultExpiration,
					customerEncryptionKey,
					labels,
				}),
			});
		},

		dropTable(tableName, databaseName, projectId) {
			return assignTemplates(templates.dropTable, {
				name: getFullName(projectId, databaseName, tableName),
			});
		},

		alterTableOptions({
			name,
			dbData,
			description,
			partitioning,
			partitioningFilterRequired,
			expiration,
			tableType,
			customerEncryptionKey,
			labels,
			friendlyName,
		}) {
			const tableName = getFullName(dbData.projectId, dbData.databaseName, name);
			const isExternal = tableType === 'External';

			const options = getTableOptions(
				tab,
				getLabels,
			)({
				partitioningFilterRequired: isExternal ? false : partitioningFilterRequired,
				customerEncryptionKey,
				partitioning,
				friendlyName,
				description,
				expiration,
				labels,
			});

			return assignTemplates(templates.alterTable, {
				name: tableName,
				options,
			});
		},

		alterColumnOptions(tableName, columnName, description) {
			return assignTemplates(templates.alterColumnOptions, {
				description: escapeQuotes(description),
				tableName: wrapByBackticks(tableName),
				columnName: wrapByBackticks(columnName),
			});
		},

		alterColumnType(tableName, columnDefinition) {
			const columnSchema = getColumnSchema({ assignTemplates, tab, templates })(
				_.pick(columnDefinition, 'type', 'dataTypeMode', 'jsonSchema'),
			);

			return assignTemplates(templates.alterColumnType, {
				columnName: wrapByBackticks(columnDefinition.name),
				type: columnSchema,
				tableName: wrapByBackticks(columnDefinition.name),
			});
		},

		alterColumnDropNotNull(tableName, columnName) {
			return assignTemplates(templates.alterColumnDropNotNull, {
				columnName: wrapByBackticks(columnName),
				tableName: wrapByBackticks(columnName),
			});
		},

		addColumn({ column }, tableName, dbData) {
			const fullTableName = getFullName(dbData.projectId, dbData.databaseName, tableName);

			return assignTemplates(templates.alterTableAddColumn, {
				tableName: fullTableName,
				column: column,
			});
		},

		dropColumn(columnName, tableName, dbData) {
			const fullTableName = getFullName(dbData.projectId, dbData.databaseName, tableName);

			return assignTemplates(templates.alterTableDropColumn, {
				tableName: fullTableName,
				columnName: wrapByBackticks(columnName),
			});
		},

		dropView(viewName, databaseName, projectId) {
			return assignTemplates(templates.dropView, {
				name: getFullName(projectId, databaseName, viewName),
			});
		},

		alterView(viewData, dbData) {
			const viewName = getFullName(dbData.projectId, dbData.databaseName, viewData.name);

			return assignTemplates(templates.alterViewOptions, {
				materialized: viewData.materialized ? 'MATERIALIZED ' : '',
				name: viewName,
				options: getViewOptions(viewData),
			});
		},
	};
};
