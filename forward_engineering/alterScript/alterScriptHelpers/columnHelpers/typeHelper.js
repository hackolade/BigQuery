const { pick, toPairs } = require('lodash');
const { getFullName, wrapByBackticks, escapeQuotes, getColumnSchema } = require('../../../helpers/utils');
const templates = require('../../../configs/templates');

const TYPE_CHANGE = {
	recreate: 'recreate',
	update: 'update',
};

const allowedConversion = {
	int64: ['numeric', 'bignumeric', 'float64'],
	numeric: ['bignumeric', 'float64'],
};

/**
 * Compares old and new fields to determine whether the column type can be updated
 * using ALTER SET DATA TYPE or whether the column must be recreated.
 *
 * A type can be updated only for supported BigQuery type conversions.
 *
 * Any other change leads to recreate.
 */
const setTypeChangeAction = (oldField, newField, changeState) => {
	if (changeState.action === TYPE_CHANGE.recreate) {
		return;
	}

	if (oldField.type !== newField.type) {
		const isAllowedTypeChange = allowedConversion[oldField.type]?.includes(newField.type);
		changeState.action = isAllowedTypeChange ? TYPE_CHANGE.update : TYPE_CHANGE.recreate;
		return changeState;
	}

	if (newField.type === 'struct') {
		const getLength = schema => Object.keys(schema.properties).length;
		const hasDifferentPropLength = getLength(oldField) !== getLength(newField);

		if (hasDifferentPropLength) {
			changeState.action = TYPE_CHANGE.recreate;
			return changeState;
		}

		for (const [name, newChildField] of toPairs(newField.properties)) {
			const oldChildField = oldField.properties[name];
			if (!oldChildField) {
				changeState.action = TYPE_CHANGE.recreate;
				return changeState;
			}
			setTypeChangeAction(oldChildField, newChildField, changeState);
			if (changeState.action === TYPE_CHANGE.recreate) {
				return changeState;
			}
		}
		return changeState;
	}

	if (newField.type === 'array') {
		const oldChildItems = [oldField.items].flat();
		const newChildItems = [newField.items].flat();
		const hasDifferentPropLength = oldChildItems.length !== newChildItems.length;

		if (hasDifferentPropLength) {
			changeState.action = TYPE_CHANGE.recreate;
			return changeState;
		}

		for (let index = 0; index < newChildItems.length; index++) {
			const oldChildField = oldChildItems[index];
			const newChildField = newChildItems[index];
			setTypeChangeAction(oldChildField, newChildField, changeState);
			if (changeState.action === TYPE_CHANGE.recreate) {
				return;
			}
		}
		return;
	}

	if (oldField.dataTypeMode !== newField.dataTypeMode) {
		if (newField.dataTypeMode.toLowerCase() !== 'nullable') {
			changeState.action = TYPE_CHANGE.recreate;
			return;
		}
	}

	if (isFinite(oldField.length) && isFinite(newField.length) && newField.length > oldField.length) {
		changeState.action = TYPE_CHANGE.update;
		return;
	}

	const newPrecision = newField.precision ?? 0;
	const oldPrecision = oldField.precision ?? 0;

	const newScale = newField.scale ?? 0;
	const oldScale = oldField.scale ?? 0;

	const isPrecisionChanged = newPrecision > oldPrecision;

	if (isPrecisionChanged && newScale >= oldScale) {
		changeState.action = TYPE_CHANGE.update;
		return;
	}
	const isScaleChanged = newScale > oldScale;

	if (isScaleChanged && newPrecision >= oldPrecision) {
		changeState.action = TYPE_CHANGE.update;
	}
};

const getModifiedColumnTypeScripts = ({ collection, app, tableData }) => {
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');
	const { tab } = app.require('@hackolade/ddl-fe-utils').general;

	const fullTableName = getFullName(tableData.dbData.projectId, tableData.dbData.databaseName, tableData.name);

	return toPairs(collection.properties)
		.map(([name, newJsonSchema]) => {
			const { oldField } = newJsonSchema.compMod;
			const oldJsonSchema = collection.role.properties[oldField.name];

			const typeChangeState = { action: null };
			setTypeChangeAction(oldJsonSchema, newJsonSchema, typeChangeState);

			if (typeChangeState.action === TYPE_CHANGE.update) {
				const typeStatement = getColumnSchema({ assignTemplates, tab, templates })({
					type: newJsonSchema.type,
					dataTypeMode: newJsonSchema.dataTypeMode,
					jsonSchema: newJsonSchema,
				});

				return assignTemplates(templates.alterColumnType, {
					columnName: wrapByBackticks(name),
					type: typeStatement.trim(),
					tableName: fullTableName,
				});
			}

			return '';
		})
		.filter(Boolean);
};

module.exports = {
	getModifiedColumnTypeScripts,
};
