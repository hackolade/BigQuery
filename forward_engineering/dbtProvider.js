/**
 * @typedef {import('./types').ColumnDefinition} ColumnDefinition
 * @typedef {import('./types').ConstraintDto} ConstraintDto
 * @typedef {import('./types').JsonSchema} JsonSchema
 */
const { toLower } = require('lodash');

const types = require('./configs/types');
const defaultTypes = require('./configs/defaultTypes');
const { decorateType } = require('./helpers/utils');
const { getCompositePrimaryKeys, getColumnConstraints } = require('./helpers/constraints/dbtConstraintHelper');

class DbtProvider {
	/**
	 * @returns {DbtProvider}
	 */
	static createDbtProvider() {
		return new DbtProvider();
	}

	/**
	 * @param {string} type
	 * @returns {string | undefined}
	 */
	getDefaultType(type) {
		return defaultTypes[type];
	}

	/**
	 * @returns {Record<string, object>}
	 */
	getTypesDescriptors() {
		return types;
	}

	/**
	 * @param {string} type
	 * @returns {boolean}
	 */
	hasType(type) {
		return Object.keys(types).map(toLower).includes(toLower(type));
	}

	/**
	 * @param {{ columnDefinition: ColumnDefinition }}
	 * @returns {string}
	 */
	decorateType({ type, columnDefinition }) {
		return decorateType({ type, columnDefinition });
	}

	/**
	 * @param {{ jsonSchema: JsonSchema }}
	 * @returns {ConstraintDto[]}
	 */
	getCompositeKeyConstraints({ jsonSchema }) {
		return getCompositePrimaryKeys({ jsonSchema });
	}

	/**
	 * @param {{ columnDefinition: ColumnDefinition; jsonSchema: JsonSchema }}
	 * @returns {ConstraintDto[]}
	 */
	getColumnConstraints({ columnDefinition, jsonSchema }) {
		return getColumnConstraints({ columnDefinition, jsonSchema });
	}

	/**
	 * @param {{ columnDefinition: ColumnDefinition }}
	 * @returns {Record<string, unknown>}
	 */
	getEntityColumnProperties({ columnDefinition }) {
		const policyTags = columnDefinition.dbtPolicyTags?.filter(Boolean);

		return {
			...(policyTags?.length && { policy_tags: policyTags }),
		};
	}

	/**
	 * @param {{ modelData: object[]; containerData: object[]; entityData: object[];}}
	 * @returns {{ databaseName?: string, schemaName?: string }}
	 */
	getEntityProperties({ modelData, containerData, entityData }) {
		return {
			databaseName: modelData?.[0]?.projectID,
			schemaName: containerData?.[0]?.code ?? containerData?.[0]?.name,
		};
	}
}

module.exports = DbtProvider;
