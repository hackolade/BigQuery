const createJsonSchema = (schema, rows) => {
	const properties = getProperties(schema.fields || [], rows);

	return {
		properties,
	};
};

const getProperties = (fields, values) => {
	return fields.reduce((properties, field) => {
		return {
			...properties,
			[field.name]: convertField(field, getValues(field.name, values)),
		};
	}, {});
};

const getValues = (name, values = []) => values.map(row => row[name]).filter(Boolean);

const convertField = (field, values) => {
	const type = getType(field.type);
	const dataTypeMode = getTypeMode(field.mode);
	const subtype = getSubtype(type, values);
	const description = field.description;
	const precision = field.precision;
	const scale = field.scale;
	const length = field.maxLength;

	if (field.mode === 'REPEATED') {
		return {
			type: 'array',
			items: convertField(
				{
					...field,
					mode: 'REQUIRED',
				},
				getValues(0, values),
			),
		};
	}

	if (Array.isArray(field.fields)) {
		const properties = getProperties(field.fields, values);

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
	};
};

const getTypeMode = mode => {
	switch (mode) {
		case 'REQUIRED':
			return 'Required';
		case 'REPEATED':
			return 'Repeated';
		default:
			return 'Nullable';
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
