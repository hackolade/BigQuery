const createBigQueryHelper = (client, log) => {
	const getDatasets = async () => {
		const [datasets] = await client.getDatasets();

		return datasets;
	};

	const getConstraints = async (projectId, datasetId) => {
		try {
			return await client.query({
				query: `SELECT * FROM ${projectId}.${datasetId}.INFORMATION_SCHEMA.TABLE_CONSTRAINTS;`
			})
		} catch (error) {
			log.warn('Error while getting table constraints', error)
		}
	}

	const getColumnsToConstraints = async (projectId, datasetId) => {
		try {
			return await client.query({
				query: `SELECT * FROM ${projectId}.${datasetId}.INFORMATION_SCHEMA.KEY_COLUMN_USAGE;`
			})
		} catch (error) {
			log.warn('Error while getting table constraints', error)
		}
	}

	const getConstraintsData = async (projectId, datasetId) => {
		const constraints = (await getConstraints(projectId, datasetId)).flat();
		const columnsToConstraints = (await getColumnsToConstraints(projectId, datasetId)).flat();
		return columnsToConstraints.map(columnsToConstraintDto => {
			const constraint = constraints.find(({constraint_name}) => constraint_name === columnsToConstraintDto.constraint_name);
			return {...columnsToConstraintDto, ...constraint}
		})
	}

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

	const getRows = async (name, table, recordSamplingSettings) => {
		const limit = await getLimit(table, name, recordSamplingSettings);

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
			log.warn(`There is an issue during getting data from external table ${name}. Error: ${e.message}`, e);

			return [[]];
		}
	};

	const getLimit = async (table, name, recordSamplingSettings) => {
		if (recordSamplingSettings.active === 'absolute') {
			return Number(recordSamplingSettings.absolute.value);
		}

		const numberOfRows = await getTableRowsCount(table, name);

		return Math.round((numberOfRows / 100) * recordSamplingSettings.relative.value);
	};

	const getTableRowsCount = async (table, name) => {
		try {
			const [result] = await table.query({
				query: `SELECT COUNT(*) AS rows_count FROM ${name}`,
			});

			return result[0]?.rows_count || 1000;
		} catch (error) {
			log.warn('Error while getting rows count, using default value: 1000', error);

			return 1000;
		}
	};

	return {
		getDatasets,
		getTables,
		getProjectInfo,
		getDataset,
		getRows,
		getTableRowsCount,
		getConstraintsData
	};
};

module.exports = createBigQueryHelper;
