const { getFullName, getName } = require('../../helpers/utils');
const { getModifiedDefaultColumnValueScripts } = require('./columnHelpers/defaultConstraintHelper');
const { getModifyColumnNameScript } = require('./columnHelpers/nameHelper');
const { getModifiedColumnNotNullScripts } = require('./columnHelpers/notNullHelper');
const { getModifiedColumnOptionScripts } = require('./columnHelpers/optionsHelper');
const { getModifiedColumnTypeScripts } = require('./columnHelpers/typeHelper');
const { getModifyCollectionNameScript } = require('./entityHelpers/nameHelper');
const { getModifyPkConstraintsScriptDtos } = require('./entityHelpers/primaryKeyHelper');
const { getCompMod, checkCompModEqual, setEntityKeys } = require('./common');

module.exports = (app, options) => {
	const _ = app.require('lodash');
	const { createColumnDefinitionBySchema } = require('./createColumnDefinition')(_);
	const ddlProvider = require('../../ddlProvider')(null, options, app);
	const { generateIdToNameHashTable, generateIdToActivatedHashTable } = app.require('@hackolade/ddl-fe-utils');

	const getAddCollectionScript = modelData => collection => {
		const databaseName = collection.compMod.keyspaceName;
		const dbData = { databaseName, projectId: _.first(modelData)?.projectId };
		const table = {
			..._.omit(collection, 'timeUnitpartitionKey', 'clusteringKey', 'rangePartitionKey'),
			...collection?.role,
		};
		const idToNameHashTable = generateIdToNameHashTable(table);
		const idToActivatedHashTable = generateIdToActivatedHashTable(table);
		const jsonSchema = setEntityKeys({ idToActivatedHashTable, idToNameHashTable, entity: table });
		const tableName = getName(jsonSchema);
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
		const jsonSchema = { ...collection, ...collection?.role };
		const tableName = getName(jsonSchema);
		const databaseName = collection.compMod.keyspaceName;
		const projectId = _.first(modelData)?.projectId;

		return ddlProvider.dropTable(tableName, databaseName, projectId);
	};

	const getModifyCollectionScript = modelData => collection => {
		const table = {
			..._.omit(collection, 'timeUnitpartitionKey', 'clusteringKey', 'rangePartitionKey'),
			...collection?.role,
		};

		const databaseName = table.compMod.keyspaceName;
		const dbData = { databaseName, projectId: _.first(modelData)?.projectId };
		const idToNameHashTable = generateIdToNameHashTable(table);
		const idToActivatedHashTable = generateIdToActivatedHashTable(table);
		const jsonSchema = setEntityKeys({ idToActivatedHashTable, idToNameHashTable, entity: table });
		const tableName = getName(jsonSchema);
		const fullTableName = getFullName(dbData.projectId, dbData.databaseName, collection.role?.name || tableName);

		const tableData = {
			name: fullTableName,
			columns: [],
			foreignKeyConstraints: [],
			columnDefinitions: [],
			dbData,
		};

		const modifyEntityNameScript = getModifyCollectionNameScript({ app, collection, dbData });
		const modifyTableOptionsScript = getModifyTableOptions({ jsonSchema, tableData });
		const modifyColumnNamesScript = getModifyColumnNameScript({ app, collection, tableData });
		const modifyColumnScripts = getModifyColumnScripts({ tableData, dbData, collection });
		const modifyPkScripts = getModifyPkConstraintsScriptDtos({ app, collection, tableData });

		return [
			modifyEntityNameScript,
			modifyTableOptionsScript,
			modifyColumnNamesScript,
			...modifyColumnScripts,
			...modifyPkScripts,
		]
			.filter(Boolean)
			.join('\n\n');
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
		const collectionSchema = { ...collection, ..._.omit(collection?.role, 'properties') };
		const tableName = getName(collectionSchema);
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
		const collectionSchema = { ...collection, ..._.omit(collection?.role, 'properties') };
		const tableName = getName(collectionSchema);
		const databaseName = collectionSchema.compMod?.keyspaceName;
		const dbData = { databaseName, projectId: _.first(modelData)?.projectId };

		return _.toPairs(collection.properties)
			.filter(([name, jsonSchema]) => !jsonSchema.compMod)
			.map(([name]) => ddlProvider.dropColumn(name, tableName, dbData));
	};

	const getModifyColumnScripts = ({ tableData, collection }) => {
		const updateTypeScripts = getModifiedColumnTypeScripts({ collection, app, tableData });
		const updateOptionScripts = getModifiedColumnOptionScripts({ collection, app, tableData });
		const modifyDefaultValueScripts = getModifiedDefaultColumnValueScripts({ app, collection, tableData });
		const modifiedColumnNotNullScripts = getModifiedColumnNotNullScripts({ app, collection, tableData });

		return [
			...updateTypeScripts,
			...updateOptionScripts,
			...modifyDefaultValueScripts,
			...modifiedColumnNotNullScripts,
		].filter(Boolean);
	};

	return {
		getAddCollectionScript,
		getDeleteCollectionScript,
		getModifyCollectionScript,
		getAddColumnScript,
		getDeleteColumnScript,
	};
};
