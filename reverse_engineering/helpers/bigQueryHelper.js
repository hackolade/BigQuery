const createBigQueryHelper = (client, log) => {
	const getDatasets = async () => {
		const [datasets] = await client.getDatasets();

		return datasets;
	};

	const getPrimaryKeyConstraintsData = async (projectId, datasetId) => {
		try {
			return await client.query({
				query: `SELECT * 
				FROM ${projectId}.${datasetId}.INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS KCU
				INNER JOIN ${projectId}.${datasetId}.INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS TC
				USING(constraint_name)
				WHERE TC.constraint_type = "PRIMARY KEY";`,
			});
		} catch (error) {
			log.warn('Error while getting table constraints', error);
			return [];
		}
	};

	const getForeignKeyConstraintsData = async (projectId, datasetId) => {
		try {
			return await client.query({
				query: `SELECT 
				CCU.column_name as \`parent_column\`,
				KCU.column_name as \`child_column\`,
				TC.constraint_catalog, 
				TC.constraint_name, 
				TC.constraint_schema, 
				TC.constraint_type, 
				TC.table_catalog,
				CCU.table_schema as \`parent_schema\`,
				KCU.table_schema as \`child_schema\`,
				CCU.table_name as \`parent_table\`,
				KCU.table_name as \`child_table\`
				FROM (${projectId}.${datasetId}.INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE AS CCU 
				INNER JOIN ${projectId}.${datasetId}.INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS KCU
				USING(constraint_name)) 
				INNER JOIN ${projectId}.${datasetId}.INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS TC
				USING(constraint_name)
				WHERE TC.constraint_type = "FOREIGN KEY";`,
			});
		} catch (error) {
			log.warn('Error while getting table constraints', error);
			return [];
		}
	};

	const getConstraintsData = async (projectId, datasetId) => {
		const primaryKeyConstraintsData = (await getPrimaryKeyConstraintsData(projectId, datasetId)).flat();
		const foreignKeyConstraintsData = (await getForeignKeyConstraintsData(projectId, datasetId)).flat();
		return {
			primaryKeyConstraintsData,
			foreignKeyConstraintsData,
		};
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

		return getSampleDocSize(numberOfRows, recordSamplingSettings);
	};

	const getSampleDocSize = (count, recordSamplingSettings) => {
		const limit = Math.ceil((count * recordSamplingSettings.relative.value) / 100);

		return Math.min(limit, recordSamplingSettings.maxValue);
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

	const getViewName = name => `${name} (v)`;

	return {
		getDatasets,
		getTables,
		getProjectInfo,
		getDataset,
		getRows,
		getTableRowsCount,
		getConstraintsData,
		getViewName,
	};
};

module.exports = createBigQueryHelper;
