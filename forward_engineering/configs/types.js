module.exports = {
	ARRAY: {
		mode: 'array',
	},
	BIGNUMERIC: {
		capacity: 16,
		mode: 'decimal',
	},
	BOOL: {
		mode: 'boolean',
	},
	BYTES: {
		mode: 'binary',
	},
	DATE: {
		format: 'YYYY-MM-DD',
	},
	DATETIME: {
		format: 'YYYY-MM-DD hh:mm:ss',
	},
	FLOAT64: {
		capacity: 8,
		mode: 'floating',
	},
	GEOGRAPHY: {
		format: 'euclidian',
		mode: 'geospatial',
	},
	INT64: {
		capacity: 8,
	},
	NUMERIC: {
		capacity: 8,
		mode: 'decimal',
	},
	STRING: {
		mode: 'varying',
	},
	STRUCT: {
		mode: 'object',
	},
	TIME: {
		format: 'hh:mm:ss.nnnnnn',
	},
	TIMESTAMP: {
		format: 'YYYY-MM-DD hh:mm:ss.nnnnnnZ',
	},
	JSON: {
		format: 'semi-structured',
	},
};
