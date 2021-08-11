const createBigQueryHelper = (client) => {

	const getDatasets = async () => {
		const [datasets] = await client.getDatasets();

		return datasets;
	};

	const getTables = async (datasetId) => {
		const [tables] = await client.dataset(datasetId).getTables();

		return tables || [];
	};

	const getProjectList = () => new Promise((resolve, reject) => {
		client.request({ uri: 'https://bigquery.googleapis.com/bigquery/v2/projects' }, (error, result) => {
			if (error) {
				return reject(error);
			}

			resolve(result.projects || []);
		});
	});

	const getProjectInfo = async () => {
		const projectId = await client.getProjectId();
		const projects = await getProjectList();

		const project = projects.find(project => project.id === projectId);

		if (!project) {
			return {
				id: projectId,
			};
		}

		return project;
	};

	const getDataset = async (datasetName) => {
		const [dataset] = await client.dataset(datasetName).get();

		return dataset;
	};

	return {
		getDatasets,
		getTables,
		getProjectInfo,
		getDataset,
	};
};


module.exports = createBigQueryHelper;
