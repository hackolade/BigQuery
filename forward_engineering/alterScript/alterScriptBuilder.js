const { commentDropStatements } = require('../helpers/commentDropStatements');

const generateAlterScript = (data, callback, app) => {
	const {
		getAlterContainersScripts,
		getAlterCollectionsScripts,
		getAlterViewScripts,
		getAlterRelationshipsScript,
		getInlineRelationships,
	} = require('./alterScriptFromDeltaHelper');

	const collection = JSON.parse(data.jsonSchema);
	if (!collection) {
		throw new Error(
			'"comparisonModelCollection" is not found. Alter script can be generated only from Delta model',
		);
	}

	const containersScripts = getAlterContainersScripts(collection, app, data.modelData);
	const collectionsScripts = getAlterCollectionsScripts(collection, app, data.modelData);
	const viewScripts = getAlterViewScripts(collection, app, data.modelData);
	const ignoreRelationshipIDs = getInlineRelationships({ data, options: data.options });
	const relationships = getAlterRelationshipsScript({
		collection,
		app,
		modelData: data.modelData,
		ignoreRelationshipIDs,
	});
	const script = [...containersScripts, ...collectionsScripts, ...relationships, ...viewScripts]
		.filter(Boolean)
		.join('\n\n');

	const applyDropStatements = data.options?.additionalOptions?.some(
		option => option.id === 'applyDropStatements' && option.value,
	);

	callback(null, applyDropStatements ? script : commentDropStatements(script));
};

module.exports = {
	generateAlterScript,
};
