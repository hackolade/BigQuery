const { toPairs } = require('lodash');
const templates = require('../../../configs/templates');
const { wrapByBackticks } = require('../../../helpers/utils');

const getUpdatedDefaultColumnValueScript = ({ collection, commonProps }) => {
	const { assignTemplates, tableName } = commonProps;

	return toPairs(collection.properties)
		.filter(([_name, jsonSchema]) => {
			const newDefault = jsonSchema.default;
			const oldName = jsonSchema.compMod.oldField.name;
			const oldDefault = collection.role.properties[oldName]?.default;
			return newDefault !== undefined && (!oldDefault || newDefault !== oldDefault);
		})
		.map(([columnName, jsonSchema]) => {
			return assignTemplates(templates.alterTableSetDefault, {
				tableName,
				columnName: wrapByBackticks(columnName),
				default: jsonSchema.default,
			});
		});
};

const getDeletedDefaultColumnValueScript = ({ collection, commonProps }) => {
	const { assignTemplates, tableName } = commonProps;

	return toPairs(collection.properties)
		.filter(([_name, jsonSchema]) => {
			const newDefault = jsonSchema.default;
			const oldName = jsonSchema.compMod.oldField.name;
			const oldDefault = collection.role.properties[oldName]?.default;
			const hasPrevValue = oldDefault !== undefined;
			const hasNewValue = newDefault !== undefined;
			return hasPrevValue && !hasNewValue;
		})
		.map(([columnName, jsonSchema]) => {
			return assignTemplates(templates.alterTableDropDefault, {
				tableName,
				columnName: wrapByBackticks(columnName),
			});
		});
};

const getModifiedDefaultColumnValueScripts = ({ app, collection, tableData }) => {
	const assignTemplates = app.require('@hackolade/ddl-fe-utils').assignTemplates;

	const commonProps = {
		assignTemplates,
		tableName: tableData.name,
	};

	const updatedDefaultValuesScriptDtos = getUpdatedDefaultColumnValueScript({ collection, commonProps });
	const dropDefaultValuesScriptDtos = getDeletedDefaultColumnValueScript({ collection, commonProps });
	return [...updatedDefaultValuesScriptDtos, ...dropDefaultValuesScriptDtos];
};

module.exports = {
	getModifiedDefaultColumnValueScripts,
};
