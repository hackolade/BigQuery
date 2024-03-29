module.exports = (app, options) => {
	const _ = app.require('lodash');
	const { mapProperties } = app.require('@hackolade/ddl-fe-utils');
	const { setEntityKeys } = require('./common')(app);
	const { generateIdToNameHashTable, generateIdToActivatedHashTable } = app.require('@hackolade/ddl-fe-utils');
	const ddlProvider = require('../../ddlProvider')(null, options, app);
	const { checkCompModEqual, getCompMod } = require('./common')(app);

	const getAddViewScript = modelData => jsonSchema => {
		const view = _.omit(jsonSchema, 'timeUnitpartitionKey', 'clusteringKey', 'rangePartitionKey');
		const idToNameHashTable = generateIdToNameHashTable(view);
		const idToActivatedHashTable = generateIdToActivatedHashTable(view);
		const viewSchema = setEntityKeys({ idToActivatedHashTable, idToNameHashTable, entity: view });
		const dbData = { databaseName: viewSchema.compMod.keyspaceName, projectId: _.first(modelData)?.projectId };

		const viewData = {
			name: viewSchema.code || viewSchema.name,
			keys: getKeys(viewSchema, viewSchema.compMod?.collectionData?.collectionRefsDefinitionsMap ?? {}),
			dbData,
		};
		const hydratedView = ddlProvider.hydrateView({ viewData, entityData: [view] });

		return ddlProvider.createView(hydratedView, dbData, view.isActivated);
	};

	const getDeleteViewScript = modelData => view => {
		return ddlProvider.dropView(
			view.code || view.name,
			view?.role?.compMod?.keyspaceName,
			_.first(modelData)?.projectId,
		);
	};

	const getModifiedViewScript = modelData => jsonSchema => {
		const view = _.omit(jsonSchema, 'timeUnitpartitionKey', 'clusteringKey', 'rangePartitionKey');
		const idToNameHashTable = generateIdToNameHashTable(view);
		const idToActivatedHashTable = generateIdToActivatedHashTable(view);
		const viewSchema = setEntityKeys({ idToActivatedHashTable, idToNameHashTable, entity: view });
		const dbData = { databaseName: viewSchema.compMod.keyspaceName, projectId: _.first(modelData)?.projectId };
		const viewData = {
			name: viewSchema.code || viewSchema.name,
			keys: getKeys(viewSchema, viewSchema.compMod?.collectionData?.collectionRefsDefinitionsMap ?? {}),
			dbData,
		};

		const optionsProperties = viewSchema.materialized
			? ['enableRefresh', 'refreshInterval', 'expiration', 'businessName', 'description', 'labels']
			: ['expiration', 'businessName', 'description', 'labels'];

		const compMod = getCompMod(view);
		const isAnyOptionChanged = _.some(optionsProperties, property => !checkCompModEqual(compMod[property]));

		if (!isAnyOptionChanged) {
			return '';
		}

		const hydratedView = ddlProvider.hydrateView({ viewData, entityData: [viewSchema] });

		return ddlProvider.alterView(hydratedView, dbData);
	};

	const getKeys = (viewSchema, collectionRefsDefinitionsMap) => {
		return mapProperties(viewSchema, (propertyName, schema) => {
			const definition = collectionRefsDefinitionsMap[schema.refId];

			if (!definition) {
				return ddlProvider.hydrateViewColumn({
					name: propertyName,
					isActivated: schema.isActivated,
				});
			}

			const entityName =
				_.get(definition.collection, '[0].code', '') ||
				_.get(definition.collection, '[0].collectionName', '') ||
				'';
			const dbName = _.get(definition.bucket, '[0].code') || _.get(definition.bucket, '[0].name', '');
			const name = definition.name;

			if (name === propertyName) {
				return ddlProvider.hydrateViewColumn({
					containerData: definition.bucket,
					entityData: definition.collection,
					isActivated: schema.isActivated,
					definition: definition.definition,
					entityName,
					name,
					dbName,
				});
			}

			return ddlProvider.hydrateViewColumn({
				containerData: definition.bucket,
				entityData: definition.collection,
				isActivated: schema.isActivated,
				definition: definition.definition,
				alias: propertyName,
				entityName,
				name,
				dbName,
			});
		});
	};

	return {
		getAddViewScript,
		getDeleteViewScript,
		getModifiedViewScript,
	};
};
