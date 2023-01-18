const createBigQueryHelper = (client, log) => {
	const getDatasets = async () => {
		const [datasets] = await client.getDatasets();

		return datasets;
	};

	const getTables = async datasetId => {
		const [tables] = await client.dataset(datasetId).getTables();

		return tables || [];
	};

	const getProjectList = () =>
		new Promise((resolve, reject) => {
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

	const getDataset = async datasetName => {
		const [dataset] = await client.dataset(datasetName).get();

		return dataset;
	};

	const getRows = async ({ name, table, logger, recordSamplingSettings, datasetName }) => {
		const numberOfRows = await getTableRowsCount(datasetName, name);
		const limit = getCount(numberOfRows, recordSamplingSettings);

		const wrapIntegers = {
			integerTypeCastFunction(n) {
				return Number(n);
			},
		};

		if (table.metadata.type !== 'EXTERNAL') {
			return table.getRows({
				wrapIntegers,
				maxResults: limit,
			});
		}

		try {
			return await table.query({
				query: `SELECT * FROM ${name} LIMIT ${limit};`,
				wrapIntegers,
			});
		} catch (e) {
			logger.warn(`There is an issue during getting data from external table ${name}. Error: ${e.message}`, e);

			return [[]];
		}
	};

	const getTableRowsCount = async (datasetName, tableName) => {
		try {
			const [result] = await client.query({
				query: `SELECT COUNT(*) AS rows_count FROM \`${datasetName}.${tableName}\``,
			});

			return result[0]?.rows_count || 1000;
		} catch (error) {
			log.warn('Error while getting rows count, using default value: 1000', error);

			return 1000;
		}
	};

	const getCount = (count, recordSamplingSettings) => {
		const per = recordSamplingSettings.relative.value;
		const size =
			recordSamplingSettings.active === 'absolute'
				? recordSamplingSettings.absolute.value
				: Math.round((count / 100) * per);
		return size;
	};

	return {
		getDatasets,
		getTables,
		getProjectInfo,
		getDataset,
		getRows,
		getTableRowsCount,
	};
};

module.exports = createBigQueryHelper;
