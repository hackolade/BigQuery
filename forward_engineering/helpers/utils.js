const getPartitioningByIngestionTime = (partitioningType) => {
	const type = {
		'By day': 'DAY',
		'By hour': 'HOUR',
		'By month': 'MONTH',
		'By year': 'YEAR',
	}[partitioningType] || 'DAY';

	return `TIMESTAMP_TRUNC(_PARTITIONTIME, ${type})`;
};

const getPartitioningByIntegerRange = (rangeOptions = {}) => {
	const name = rangeOptions.rangePartitionKey?.[0]?.name;
	const start = Number(rangeOptions.rangeStart);
	const end = Number(rangeOptions.rangeEnd);
	const interval = Number(rangeOptions.rangeinterval);

	return `RANGE_BUCKET(${name}, GENERATE_ARRAY(${start}, ${end}${isNaN(interval) ? '' : `, ${interval}`}))`;
};

const isActivatedPartition = ({
	partitioning,
	timeUnitPartitionKey,
	rangeOptions,
}) => {
	if (partitioning === 'By time-unit column') {
		return timeUnitPartitionKey?.[0]?.isActivated;
	}

	if (partitioning === 'By integer-range') {
		return rangeOptions?.[0]?.rangePartitionKey?.[0]?.isActivated;
	}

	return true;
};

const getTablePartitioning = ({
	partitioning,
	partitioningType,
	timeUnitPartitionKey,
	rangeOptions,
}) => {
	if (partitioning === 'No partitioning') {
		return '';
	}

	if (partitioning === 'By ingestion time') {
		return 'PARTITION BY ' + getPartitioningByIngestionTime(partitioningType);
	}

	if (partitioning === 'By time-unit column') {
		return `PARTITION BY DATE(${timeUnitPartitionKey?.[0].name})`;
	}

	if (partitioning === 'By integer-range') {
		return 'PARTITION BY ' + getPartitioningByIntegerRange(rangeOptions[0]);
	}

	return '';
};

const getClusteringKey = (clusteringKey, isParentActivated) => {
	if (!Array.isArray(clusteringKey) || clusteringKey.length === 0) {
		return '';
	}

	const activated = clusteringKey.filter(key => key.isActivated).map(key => key.name).join(', ');
	const deActivated = clusteringKey.filter(key => !key.isActivated).map(key => key.name).join(', ');

	if (!isParentActivated) {
		return '\nCLUSTER BY ' + clusteringKey.map(key => key.name).join(', ');
	}

	if (activated.length === 0) {
		return '\n-- CLUSTER BY ' + deActivated;
	}

	if (deActivated.length === 0) {
		return '\nCLUSTER BY ' + activated;
	}

	return '\nCLUSTER BY ' + activated + ' /*' + deActivated + '*/';
};

const getTableOptions = (tab, getLabels) => ({
	expiration,
	partitioningFilterRequired,
	partitioning,
	customerEncryptionKey,
	description,
	labels,
	friendlyName,
}) => {
	const options = [];

	if (friendlyName) {
		options.push(`friendly_name="${friendlyName}"`);
	}

	if (description) {
		options.push(`description="${description}"`);
	}

	if (expiration) {
		options.push(`expiration_timestamp=TIMESTAMP "${getTimestamp(expiration)}"`);
	}

	if (partitioning === 'By ingestion time' && partitioningFilterRequired) {
		options.push(`require_partition_filter=true`);
	}

	if (customerEncryptionKey) {
		options.push(`kms_key_name="${customerEncryptionKey}"`);
	}

	if (Array.isArray(labels) && labels.length) {
		options.push(`labels=[\n${tab(getLabels(labels))}\n]`);
	}

	if (!options.length) {
		return '';
	}

	return `\nOPTIONS (\n${
		tab(options.join(',\n'))
	}\n)`;
};

const getTimestamp = (unixTs) => {
	const fill = (n) => (n + '').padStart(2, '0');
	
	const date = new Date(Number(unixTs));

	const day = fill(date.getUTCDate());
	const month = fill(date.getUTCMonth() + 1);
	const year = date.getUTCFullYear();
	const hours = fill(date.getUTCHours());
	const minutes = fill(date.getUTCMinutes());
	const seconds = fill(date.getUTCSeconds());

	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`
};

const convertItemsToType = (deps) => (items) => {
	if (!Array.isArray(items)) {
		items = [items];
	}

	return items.map(item => {
		return getColumnSchema(deps)({
			type: item.type,
			description: item.description,
			dataTypeMode: item.dataTypeMode,
			jsonSchema: item,
		}, true);
	});
};

const convertPropertiesToType = (deps) => (properties) => {
	return Object.keys(properties).map(name => {
		const item = properties[name];

		return getColumnSchema(deps)({
			name,
			type: item.type,
			description: item.description,
			dataTypeMode: item.dataTypeMode,
			jsonSchema: item,
		});
	});
};

const addParameters = (type, jsonSchema) => {
	const params = [];

	if (['bignumeric', 'numeric'].includes((type || '').toLowerCase())) {
		if (jsonSchema.precision) {
			params.push(jsonSchema.precision);
		}
	
		if (jsonSchema.scale) {
			params.push(jsonSchema.scale);
		}
	}

	if (['string', 'bytes'].includes((type || '').toLowerCase())) {
		if (jsonSchema.length) {
			params.push(jsonSchema.length);
		}
	}

	if (params.length) {
		return `(${params.join(', ')})`;
	}

	return '';
};

const getColumnSchema = (deps) => ({ type, description, dataTypeMode, name, jsonSchema }, isArrayItem) => {
	const { assignTemplates, tab } = deps;
	let dataType = type;
	let options = '';
	let notNull = '';

	if (type === 'array') {
		dataType = ` ARRAY<\n${
			tab(
				convertItemsToType(deps)(jsonSchema.items).join(',\n')
			)
		}\n>`;
	} else if (dataTypeMode === 'Repeated') {
		const {dataTypeMode, ...item} = jsonSchema; 

		dataType = getColumnSchema(deps)({
			type: 'array',
			description,
			jsonSchema: {
				items: [item],
			},
		});
	} else if (type === 'struct') {
		dataType = ` STRUCT<\n${
			tab(
				convertPropertiesToType(deps)(jsonSchema.properties).join(',\n'),
			)
		}\n>`;
	} else {
		dataType = (' ' + type).toUpperCase() + addParameters(type, jsonSchema);
	}

	if (description) {
		options += ` OPTIONS( description="${description}" )`;
	}

	if (dataTypeMode === 'Required' && !isArrayItem) {
		notNull = ' NOT NULL';
	}

	return assignTemplates(templates.columnDefinition, {
		type: dataType,
		options,
		notNull,
		name,
	});
};

const generateViewSelectStatement = (getFullName) => ({ columns, projectId, datasetName }) => {
	const keys = columns.reduce((tables, key) => {
		let column = key.name;

		if (key.alias) {
			column = `${column} as ${key.alias}`;
		}

		if (!Array.isArray(tables[key.tableName])) {
			tables[key.tableName] = [];
		}

		tables[key.tableName].push(column);

		return tables;
	}, {});

	return Object.keys(keys).map(tableName => {
		return `SELECT ${
			keys[tableName] ? keys[tableName].join(', ') : '*'
		} FROM ${
			getFullName(projectId, datasetName, tableName)
		}`;
	}).join('\nUNION ALL\n');
};

module.exports = {
	isActivatedPartition,
	getTablePartitioning,
	getClusteringKey,
	getTableOptions,
	getColumnSchema,
	generateViewSelectStatement,
	getTimestamp,
};
