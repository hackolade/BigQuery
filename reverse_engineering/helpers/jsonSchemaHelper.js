
const createJsonSchema = (schema) => {
	const properties = getProperties(schema.fields);

	return {
		properties,
	};
};

const getProperties = (fields) => {
	return fields.reduce((properties, field) => {
		return {
			...properties,
			[field.name]: convertField(field),
		};
	}, {});
};

const convertField = (field) => {
	const type = getType(field.type);
	const dataTypeMode = getTypeMode(field.mode);
	const description = field.description;

	if (field.mode === 'REPEATED') {
		return {
			type: 'array',
			items: convertField({
				...field,
				mode: 'REQUIRED',
			}),
		};
	}

	if (Array.isArray(field.fields)) {
		const properties = getProperties(field.fields);

		return {
			type,
			description,
			properties,
			dataTypeMode,
		};
	}


	return {
		type,
		description,
		dataTypeMode,
	};
};

const getTypeMode = (mode) => {
	switch(mode) {
		case 'REQUIRED':
			return 'Required';
		case 'REPEATED':
			return 'Repeated';
		default:
			return 'Nullable';
	}
};

const getType = (fieldType) => {
	switch(fieldType) {
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
		case 'STRING':
		default:
			return 'string';
	}
};

module.exports = {
	createJsonSchema,
};
