const createBigQueryHelper = (client) => {

	const getDatasets = async () => {
		const [datasets] = await client.getDatasets();

		return datasets;
	};

	const getTables = async (datasetId) => {
		const [tables] = await client.dataset(datasetId).getTables();

		return tables || [];
	};

	return {
		getDatasets,
		getTables,
	};
};


module.exports = createBigQueryHelper;
