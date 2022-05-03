
const toUpper = (s) => String(s || '').toUpperCase();

const cleanUp = (obj) => Object.fromEntries(
	Object.entries(obj).filter(([key, value]) => value !== '')
);

const getType = (jsonSchema) => {
	if (jsonSchema.type === 'struct') {
		return 'record';
	}

	return jsonSchema.type;
};

const convertItem = ({ name, jsonSchema }) => {
	const schema = cleanUp({
		name,
		type: toUpper(getType(jsonSchema)),
		mode: toUpper(jsonSchema.dataTypeMode || 'Nullable'),
		description: jsonSchema.refDescription || jsonSchema.description,
	});

	if (jsonSchema.properties) {
		schema.fields = Object.keys(jsonSchema.properties)
			.flatMap(
				(name) => convertItem({
					name,
					jsonSchema: jsonSchema.properties[name],
				})
			);

		return [schema];
	} else if (jsonSchema.items) {
		const items = Array.isArray(jsonSchema.items) ? jsonSchema.items : [jsonSchema.items];

		return items.flatMap(schema => {
			return convertItem({
				name,
				jsonSchema: { ...schema, dataTypeMode: 'Repeated' },
			});
		});
	}

	return [schema];
};

const convertJsonSchemaToBigQuerySchema = (jsonSchema) => {
	let result = [];

	result = Object.keys(jsonSchema.properties || {}).flatMap(name => {
		return convertItem({ name, jsonSchema: jsonSchema.properties[name] });
	});

	return result;
};

module.exports = {
	convertJsonSchemaToBigQuerySchema,
};
