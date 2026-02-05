/**
 * @typedef {import('../types').ColumnDefinition} ColumnDefinition
 * @typedef {import('../types').ConstraintDtoColumn} ConstraintDtoColumn
 * @typedef {import('../types').ConstraintDto} ConstraintDto
 * @typedef {import('../types').JsonSchema} JsonSchema
 */

const _ = require('lodash');
const { DATA_TYPE_MODE } = require('../constants');

/**
 * @param {ColumnDefinition} columnDefinition
 * @returns {boolean}
 */
const isPrimaryKey = columnDefinition => {
	return !columnDefinition.compositePrimaryKey && columnDefinition.primaryKey;
};

/**
 * @param {string} keyId
 * @param {Record<string, JsonSchema>} properties
 * @returns {string}
 */
const findName = (keyId, properties) => {
	return Object.keys(properties).find(name => properties[name].GUID === keyId);
};

/**
 * @param {string} keyId
 * @param {Record<string, JsonSchema>} properties
 * @returns {boolean}
 */
const checkIfActivated = (keyId, properties) => {
	return _.get(
		Object.values(properties).find(prop => prop.GUID === keyId),
		'isActivated',
		true,
	);
};

/**
 * @param {Array<{ keyId: string }>} keys
 * @param {JsonSchema} jsonSchema
 * @returns {ConstraintDtoColumn}
 */
const getKeys = (keys, jsonSchema) => {
	return _.map(keys, key => {
		return {
			name: findName(key.keyId, jsonSchema.properties),
			isActivated: checkIfActivated(key.keyId, jsonSchema.properties),
		};
	});
};

/**
 * @param {{ jsonSchema: JsonSchema }}
 * @returns {ConstraintDto[]}
 */
const getCompositePrimaryKeys = ({ jsonSchema }) => {
	if (!Array.isArray(jsonSchema.primaryKey)) {
		return [];
	}

	return jsonSchema.primaryKey
		.filter(primaryKey => !_.isEmpty(primaryKey.compositePrimaryKey))
		.map(primaryKey => ({
			keyType: 'PRIMARY KEY',
			columns: getKeys(primaryKey.compositePrimaryKey, jsonSchema),
		}));
};

/**
 * @param {{ columnDefinition: ColumnDefinition; jsonSchema: JsonSchema }}
 * @returns {ConstraintDto | undefined}
 */
const getPrimaryKeyConstraint = ({ columnDefinition, jsonSchema }) => {
	if (!isPrimaryKey(columnDefinition)) {
		return;
	}

	return {
		keyType: 'PRIMARY KEY',
	};
};

/**
 * @param {{ columnDefinition: ColumnDefinition }}
 * @returns {ConstraintDto | undefined}
 */
const getNotNullConstraint = ({ columnDefinition }) => {
	if (columnDefinition.dataTypeMode !== DATA_TYPE_MODE.required) {
		return;
	}

	return {
		keyType: 'NOT NULL',
	};
};

/**
 * @param {{ columnDefinition: ColumnDefinition; jsonSchema: JsonSchema }}
 * @returns {ConstraintDto[]}
 */
const getColumnConstraints = ({ columnDefinition, jsonSchema }) => {
	const notNullConstraint = getNotNullConstraint({ columnDefinition });
	const primaryKeyConstraint = getPrimaryKeyConstraint({ columnDefinition, jsonSchema });

	return [notNullConstraint, primaryKeyConstraint].filter(Boolean);
};

module.exports = {
	getCompositePrimaryKeys,
	getColumnConstraints,
};
