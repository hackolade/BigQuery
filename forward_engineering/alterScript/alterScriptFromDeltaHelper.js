const getItems = data => [data?.items].flat().filter(Boolean);
const getItemProperties = data => getItems(data).map(item => Object.values(item.properties)[0]);

const getContainersScripts = data =>
	getItems(data).map(container => {
		const [containerName, containerData] = Object.entries(container.properties)[0];
		return {
			...containerData,
			...containerData?.role,
			name: containerName,
		};
	});

const getAlterContainersScripts = (collection, app, modelData) => {
	const { getAddContainerScript, getDeleteContainerScript, getModifiedContainer } =
		require('./alterScriptHelpers/alterContainerHelper')(app);

	const containersData = collection.properties?.containers?.properties;
	const addedContainers = getContainersScripts(containersData?.added);
	const deletedContainers = getContainersScripts(containersData?.deleted);
	const modifiedContainers = getContainersScripts(containersData?.modified);

	const addContainersScripts = addedContainers.map(container => getAddContainerScript(modelData)(container));
	const deleteContainersScripts = deletedContainers.map(container => getDeleteContainerScript(modelData)(container));
	const modifiedContainersScripts = modifiedContainers.map(container => getModifiedContainer(modelData)(container));

	return [...deleteContainersScripts, ...addContainersScripts, ...modifiedContainersScripts].map(script =>
		script.trim(),
	);
};

const getAlterCollectionsScripts = (collection, app, modelData) => {
	const {
		getAddCollectionScript,
		getDeleteCollectionScript,
		getAddColumnScript,
		getDeleteColumnScript,
		getModifyCollectionScript,
	} = require('./alterScriptHelpers/alterEntityHelper')(app);

	const entitiesData = collection.properties?.entities?.properties;
	const createScriptsData = getItemProperties(entitiesData?.added);
	const deleteScriptsData = getItemProperties(entitiesData?.deleted);
	const modifyScriptsData = getItemProperties(entitiesData?.modified);

	const createCollectionsScripts = createScriptsData
		.filter(collection => collection.compMod?.created)
		.map(getAddCollectionScript(modelData));

	const deleteCollectionScripts = modifyScriptsData
		.filter(collection => collection.compMod?.deleted)
		.map(getDeleteCollectionScript(modelData));

	const modifyCollectionScripts = modifyScriptsData.map(getModifyCollectionScript(modelData));

	const addColumnScripts = createScriptsData
		.filter(collection => !collection.compMod?.created)
		.flatMap(getAddColumnScript(modelData));

	const deleteColumnScripts = deleteScriptsData
		.filter(collection => !collection.compMod?.deleted)
		.flatMap(getDeleteColumnScript(modelData));

	return [
		...createCollectionsScripts,
		...deleteCollectionScripts,
		...modifyCollectionScripts,
		...addColumnScripts,
		...deleteColumnScripts,
	]
		.map(script => script.trim())
		.filter(Boolean);
};

const getAlterViewScripts = (collection, app, modelData) => {
	const { getAddViewScript, getDeleteViewScript, getModifiedViewScript } =
		require('./alterScriptHelpers/alterViewHelper')(app);

	const viewsData = collection.properties?.views?.properties;

	const createViewsScripts = getItemProperties(viewsData.added)
		.map(view => ({ ...view, ...view.role }))
		.filter(view => view.compMod?.created)
		.map(getAddViewScript(modelData));

	const deleteViewsScripts = getItemProperties(viewsData.deleted)
		.map(view => ({ ...view, ...view.role }))
		.filter(view => view.compMod?.deleted)
		.map(getDeleteViewScript(modelData));

	const modifiedViewsScripts = getItemProperties(viewsData.modified)
		.map(view => ({ ...view, ...view.role }))
		.map(getModifiedViewScript(modelData));

	return [...deleteViewsScripts, ...createViewsScripts, ...modifiedViewsScripts].map(script => script.trim());
};

module.exports = {
	getAlterContainersScripts,
	getAlterCollectionsScripts,
	getAlterViewScripts,
};
