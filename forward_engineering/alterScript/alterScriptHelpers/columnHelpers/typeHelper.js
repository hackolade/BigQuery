const { pick, toPairs } = require('lodash');
const { getFullName, wrapByBackticks, escapeQuotes, addParameters } = require('../../../helpers/utils');
const templates = require('../../../configs/templates');
const { DATA_TYPE_MODE } = require('../../../helpers/constants');

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
		if (newField.dataTypeMode !== DATA_TYPE_MODE.nullable) {
			changeState.action = TYPE_CHANGE.recreate;
			return;
		}
	}

	const newLength = newField.length ?? 0;
	const oldLength = oldField.length ?? 0;

	if (newLength > oldLength) {
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

const convertItemsToType = deps => items => {
	if (!Array.isArray(items)) {
		items = [items];
	}

	return items.map(item => {
		return getColumnType(deps)(
			{
				type: item.type,
				dataTypeMode: item.dataTypeMode,
				jsonSchema: item,
			},
			true,
		);
	});
};

const convertPropertiesToType = deps => properties => {
	return Object.keys(properties).map(name => {
		const item = properties[name];

		return getColumnType(deps)({
			name,
			type: item.type,
			dataTypeMode: item.dataTypeMode,
			jsonSchema: item,
		});
	});
};

const getColumnType =
	deps =>
	({ type, dataTypeMode, name, jsonSchema }, isArrayItem) => {
		const { tab } = deps;

		if (type === 'array') {
			return ` ARRAY<\n${tab(convertItemsToType(deps)(jsonSchema.items).join(',\n'))}\n>`;
		} else if (dataTypeMode === DATA_TYPE_MODE.repeated) {
			const { dataTypeMode, ...item } = jsonSchema;

			return getColumnType(deps)({
				type: 'array',
				jsonSchema: {
					items: [item],
				},
			});
		} else if (type === 'struct') {
			return ` STRUCT<\n${tab(convertPropertiesToType(deps)(jsonSchema.properties || {}).join(',\n'))}\n>`;
		}

		return type.toUpperCase() + addParameters(type, jsonSchema);
	};

const getModifiedColumnTypeScripts = ({ collection, app, tableData }) => {
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');
	const { tab } = app.require('@hackolade/ddl-fe-utils').general;

	return toPairs(collection.properties)
		.map(([name, newJsonSchema]) => {
			const { oldField } = newJsonSchema.compMod;
			const oldJsonSchema = collection.role.properties[oldField.name];

			const typeChangeState = { action: null };
			setTypeChangeAction(oldJsonSchema, newJsonSchema, typeChangeState);

			if (typeChangeState.action === TYPE_CHANGE.update) {
				const typeStatement = getColumnType({ assignTemplates, tab, templates })({
					type: newJsonSchema.type,
					dataTypeMode: newJsonSchema.dataTypeMode,
					jsonSchema: newJsonSchema,
				});

				return assignTemplates(templates.alterColumnType, {
					columnName: wrapByBackticks(name),
					type: typeStatement.trim(),
					tableName: tableData.name,
				});
			}

			return '';
		})
		.filter(Boolean);
};

module.exports = {
	getModifiedColumnTypeScripts,
};
