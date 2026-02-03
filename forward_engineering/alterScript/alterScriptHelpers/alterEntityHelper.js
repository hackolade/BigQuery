module.exports = (app, options) => {
	const _ = app.require('lodash');
	const { getEntityName } = app.require('@hackolade/ddl-fe-utils').general;
	const { createColumnDefinitionBySchema } = require('./createColumnDefinition')(_);
	const ddlProvider = require('../../ddlProvider')(null, options, app);
	const { generateIdToNameHashTable, generateIdToActivatedHashTable } = app.require('@hackolade/ddl-fe-utils');
	const { checkFieldPropertiesChanged, getCompMod, checkCompModEqual, setEntityKeys } = require('./common')(app);

	const getAddCollectionScript = modelData => collection => {
		const databaseName = collection.compMod.keyspaceName;
		const dbData = { databaseName, projectId: _.first(modelData)?.projectId };
		const table = {
			..._.omit(collection, 'timeUnitpartitionKey', 'clusteringKey', 'rangePartitionKey'),
			...(collection?.role || {}),
		};
		const idToNameHashTable = generateIdToNameHashTable(table);
		const idToActivatedHashTable = generateIdToActivatedHashTable(table);
		const jsonSchema = setEntityKeys({ idToActivatedHashTable, idToNameHashTable, entity: table });
		const tableName = getEntityName(jsonSchema);
		const columnDefinitions = _.toPairs(jsonSchema.properties).map(([name, column]) =>
			createColumnDefinitionBySchema({
				jsonSchema: column,
				parentJsonSchema: jsonSchema,
				name,
				ddlProvider,
				dbData,
			}),
		);

		const tableData = {
			name: tableName,
			columns: columnDefinitions.map(ddlProvider.convertColumnDefinition),
			foreignKeyConstraints: [],
			dbData,
			columnDefinitions,
		};

		const hydratedTable = ddlProvider.hydrateTable({
			entityData: [jsonSchema],
			tableData,
			jsonSchema,
		});

		return ddlProvider.createTable(hydratedTable, jsonSchema.isActivated);
	};

	const getDeleteCollectionScript = modelData => collection => {
		const jsonSchema = { ...collection, ...(collection?.role || {}) };
		const tableName = getEntityName(jsonSchema);
		const databaseName = collection.compMod.keyspaceName;
		const projectId = _.first(modelData)?.projectId;

		return ddlProvider.dropTable(tableName, databaseName, projectId);
	};

	const getModifyCollectionScript = modelData => collection => {
		const table = {
			..._.omit(collection, 'timeUnitpartitionKey', 'clusteringKey', 'rangePartitionKey'),
			...(collection?.role || {}),
		};
		const databaseName = table.compMod.keyspaceName;
		const dbData = { databaseName, projectId: _.first(modelData)?.projectId };
		const idToNameHashTable = generateIdToNameHashTable(table);
		const idToActivatedHashTable = generateIdToActivatedHashTable(table);
		const jsonSchema = setEntityKeys({ idToActivatedHashTable, idToNameHashTable, entity: table });
		const tableName = getEntityName(jsonSchema);
		const tableData = {
			name: tableName,
			columns: [],
			foreignKeyConstraints: [],
			columnDefinitions: [],
			dbData,
		};

		const modifyTableOptionsScript = getModifyTableOptions({ jsonSchema, tableData });
		const modifyColumnScripts = getModifyColumnScripts({ tableData, dbData, collection });

		return [].concat(modifyTableOptionsScript).concat(modifyColumnScripts).filter(Boolean).join('\n\n');
	};

	const getModifyTableOptions = ({ jsonSchema, tableData }) => {
		const compMod = getCompMod(jsonSchema);
		const optionsProperties = [
			'description',
			'partitioning',
			'partitioningFilterRequired',
			'expiration',
			'tableType',
			'customerEncryptionKey',
			'encryption',
			'labels',
			'title',
		];

		const isAnyOptionChanged = _.some(optionsProperties, property => !checkCompModEqual(compMod[property]));

		if (!isAnyOptionChanged) {
			return '';
		}

		const hydratedTable = ddlProvider.hydrateTable({
			entityData: [jsonSchema],
			tableData,
			jsonSchema,
		});

		return ddlProvider.alterTableOptions(hydratedTable);
	};

	const getAddColumnScript = modelData => collection => {
		const collectionSchema = { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };
		const tableName = collectionSchema?.code || collectionSchema?.collectionName || collectionSchema?.name;
		const databaseName = collectionSchema.compMod?.keyspaceName;
		const dbData = { databaseName, projectId: _.first(modelData)?.projectId };

		return _.toPairs(collection.properties)
			.filter(([name, jsonSchema]) => !jsonSchema.compMod)
			.map(([name, jsonSchema]) =>
				createColumnDefinitionBySchema({
					name,
					jsonSchema,
					parentJsonSchema: collectionSchema,
					ddlProvider,
					dbData,
				}),
			)
			.map(ddlProvider.convertColumnDefinition)
			.map(column => ddlProvider.addColumn(column, tableName, dbData));
	};

	const getDeleteColumnScript = modelData => collection => {
		const collectionSchema = { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };
		const tableName = collectionSchema?.code || collectionSchema?.collectionName || collectionSchema?.name;
		const databaseName = collectionSchema.compMod?.keyspaceName;
		const dbData = { databaseName, projectId: _.first(modelData)?.projectId };

		return _.toPairs(collection.properties)
			.filter(([name, jsonSchema]) => !jsonSchema.compMod)
			.map(([name]) => ddlProvider.dropColumn(name, tableName, dbData));
	};

	const getModifyColumnScripts = ({ tableData, dbData, collection }) => {
		const collectionSchema = { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };

		return _.toPairs(collection.properties)
			.filter(([name, jsonSchema]) => checkFieldPropertiesChanged(jsonSchema.compMod, ['type', 'mode']))
			.map(([name, jsonSchema]) => {
				const columnDefinition = createColumnDefinitionBySchema({
					name,
					jsonSchema,
					parentJsonSchema: collectionSchema,
					ddlProvider,
					dbData,
				});

				return ddlProvider.alterColumnType(tableData.name, columnDefinition);
			});
	};

	return {
		getAddCollectionScript,
		getDeleteCollectionScript,
		getModifyCollectionScript,
		getAddColumnScript,
		getDeleteColumnScript,
	};
};
