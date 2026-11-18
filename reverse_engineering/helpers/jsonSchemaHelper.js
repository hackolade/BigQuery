const { DATA_TYPE_MODE } = require('../../forward_engineering/helpers/constants');

const createJsonSchema = (schema, rows, { includeDataGovernanceTags = false } = {}) => {
	const options = { includeDataGovernanceTags };
	const properties = getProperties(schema.fields || [], rows, options);

	return {
		properties,
	};
};

const getProperties = (fields, values, options) => {
	return fields.reduce((properties, field) => {
		return {
			...properties,
			[field.name]: convertField(field, getValues(field.name, values), options),
		};
	}, {});
};

const readDataGovernanceTag = (field, { includeDataGovernanceTags } = {}) => {
	if (!includeDataGovernanceTags) {
		return {};
	}

	const tags = field.dataGovernanceTagsInfo?.dataGovernanceTags;

	if (!tags || typeof tags !== 'object' || Array.isArray(tags)) {
		return {};
	}

	const [entry] = Object.entries(tags);

	if (!entry?.[0]) {
		return {};
	}

	const [tagKey, tagValue] = entry;

	return {
		dataGovernanceTag: {
			tagKey,
			tagValue: tagValue ?? '',
		},
	};
};

const getValues = (name, values = []) => values.map(row => row[name]).filter(Boolean);

const convertField = (field, values, options = {}) => {
	const type = getType(field.type);
	const dataTypeMode = getTypeMode(field.mode);
	const subtype = getSubtype(type, values);
	const description = field.description;
	const precision = field.precision;
	const scale = field.scale;
	const length = field.maxLength;

	if (field.mode === 'REPEATED') {
		const isRecord = Array.isArray(field.fields);

		return {
			type: 'array',
			items: convertField({ ...field, mode: 'REQUIRED' }, getValues(0, values), {
				...options,
				includeDataGovernanceTags: isRecord && options.includeDataGovernanceTags,
			}),
			...(isRecord ? {} : readDataGovernanceTag(field, options)),
		};
	}

	if (Array.isArray(field.fields)) {
		const properties = getProperties(field.fields, values, options);

		return {
			type,
			description,
			properties,
			dataTypeMode,
			subtype,
		};
	}

	return {
		type,
		description,
		dataTypeMode,
		precision,
		scale,
		length,
		subtype,
		default: field.defaultValueExpression,
		...readDataGovernanceTag(field, options),
	};
};

const getTypeMode = mode => {
	switch (mode) {
		case 'REQUIRED':
			return DATA_TYPE_MODE.required;
		case 'REPEATED':
			return DATA_TYPE_MODE.repeated;
		default:
			return DATA_TYPE_MODE.nullable;
	}
};

const getType = fieldType => {
	switch (fieldType) {
		case 'RECORD':
			return 'struct';
		case 'GEOGRAPHY':
			return 'geography';
		case 'TIME':
			return 'time';
		case 'DATETIME':
			return 'datetime';
		case 'DATE':
			return 'date';
		case 'TIMESTAMP':
			return 'timestamp';
		case 'BOOLEAN':
			return 'bool';
		case 'BIGNUMERIC':
			return 'bignumeric';
		case 'NUMERIC':
			return 'numeric';
		case 'FLOAT':
			return 'float64';
		case 'INTEGER':
			return 'int64';
		case 'BYTES':
			return 'bytes';
		case 'JSON':
			return 'json';
		case 'STRING':
		default:
			return 'string';
	}
};

const getSubtype = (fieldType, values) => {
	if (fieldType !== 'json') {
		return;
	}

	const jsonValue = findJsonValue(values) || values[0];

	return getParsedJsonValueType(safeParse(jsonValue));
};

const findJsonValue = values => {
	return values.find(value => {
		if (typeof value !== 'string') {
			return false;
		}

		try {
			return JSON.parse(value);
		} catch (e) {
			return false;
		}
	});
};

const safeParse = json => {
	try {
		return JSON.parse(json);
	} catch (error) {
		return json;
	}
};

const getParsedJsonValueType = value => {
	if (Array.isArray(value)) {
		return 'array';
	}

	const type = typeof value;

	if (type === 'undefined') {
		return 'object';
	}

	return type;
};

module.exports = {
	createJsonSchema,
};
