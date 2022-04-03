const getComparisonModelCollection = collections => {
	return collections
		.map(collection => JSON.parse(collection))
		.find(collection => collection.collectionName === 'comparisonModelCollection');
};

const getContainersScripts = (collection, mode, getScript) => {
	const containers = collection.properties?.containers?.properties?.[mode]?.items;

	return []
		.concat(containers)
		.filter(Boolean)
		.map(container => ({
			...Object.values(container.properties)[0],
			...(Object.values(container.properties)[0]?.role ?? {}),
			name: Object.keys(container.properties)[0],
		}))
		.map(getScript);
};

const getAlterContainersScripts = (collection, app, modelData) => {
	const { getAddContainerScript, getDeleteContainerScript, getModifiedContainer } =
		require('./alterScriptHelpers/alterContainerHelper')(app);

	const addContainersScripts = getContainersScripts(collection, 'added', getAddContainerScript(modelData));
	const deleteContainersScripts = getContainersScripts(collection, 'deleted', getDeleteContainerScript(modelData));
	const modifiedContainersScripts = getContainersScripts(collection, 'modified', getModifiedContainer(modelData));

	return [].concat(addContainersScripts).concat(deleteContainersScripts).concat(modifiedContainersScripts);
};

const getAlterCollectionsScripts = (collection, app, modelData) => {
	const {
		getAddCollectionScript,
		getDeleteCollectionScript,
		getAddColumnScript,
		getDeleteColumnScript,
		getModifyCollectionScript,
	} = require('./alterScriptHelpers/alterEntityHelper')(app);

	const createCollectionsScripts = []
		.concat(collection.properties?.entities?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => collection.compMod?.created)
		.map(getAddCollectionScript(modelData));
	const deleteCollectionScripts = []
		.concat(collection.properties?.entities?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => collection.compMod?.deleted)
		.map(getDeleteCollectionScript(modelData));
	const modifyCollectionScripts = []
		.concat(collection.properties?.entities?.properties?.modified?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.map(getModifyCollectionScript(modelData));
	const addColumnScripts = []
		.concat(collection.properties?.entities?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => !collection.compMod?.created)
		.flatMap(getAddColumnScript(modelData));
	const deleteColumnScripts = []
		.concat(collection.properties?.entities?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => !collection.compMod?.deleted)
		.flatMap(getDeleteColumnScript(modelData));

	return [
		...createCollectionsScripts,
		...deleteCollectionScripts,
		...modifyCollectionScripts,
		...addColumnScripts,
		...deleteColumnScripts,
	].map(script => script.trim());
};

const getAlterViewScripts = (collection, app, modelData) => {
	const { getAddViewScript, getDeleteViewScript, getModifiedViewScript } =
		require('./alterScriptHelpers/alterViewHelper')(app);

	const createViewsScripts = []
		.concat(collection.properties?.views?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.map(view => ({ ...view, ...(view.role || {}) }))
		.filter(view => view.compMod?.created)
		.map(getAddViewScript(modelData));

	const deleteViewsScripts = []
		.concat(collection.properties?.views?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.map(view => ({ ...view, ...(view.role || {}) }))
		.filter(view => view.compMod?.deleted)
		.map(getDeleteViewScript(modelData));

	const modifiedViewsScripts = []
		.concat(collection.properties?.views?.properties?.modified?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.map(view => ({ ...view, ...(view.role || {}) }))
		.map(getModifiedViewScript(modelData));

	return [...deleteViewsScripts, ...createViewsScripts, ...modifiedViewsScripts].map(script => script.trim());
};

module.exports = {
	getComparisonModelCollection,
	getAlterContainersScripts,
	getAlterCollectionsScripts,
	getAlterViewScripts,
};
