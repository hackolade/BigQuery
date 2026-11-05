const { toPairs } = require('lodash');
const templates = require('../../../configs/templates');
const { wrapByBackticks } = require('../../../helpers/utils');

const getUpdatedDefaultColumnValueScript = ({ collection, commonProps }) => {
	const { assignTemplates, tableName, commentIfDeactivated } = commonProps;
	const isCollectionActivated = collection.role?.isActivated !== false;

	return toPairs(collection.properties)
		.filter(([_name, jsonSchema]) => {
			const newDefault = jsonSchema.default;
			const oldName = jsonSchema.compMod.oldField.name;
			const oldDefault = collection.role.properties[oldName]?.default;
			return newDefault !== undefined && (!oldDefault || newDefault !== oldDefault);
		})
		.map(([columnName, jsonSchema]) => {
			const script = assignTemplates(templates.alterTableSetDefault, {
				tableName,
				columnName: wrapByBackticks(columnName),
				default: jsonSchema.default,
			});
			const isActivated = isCollectionActivated && jsonSchema.isActivated !== false;
			return commentIfDeactivated(script, { isActivated });
		});
};

const getDeletedDefaultColumnValueScript = ({ collection, commonProps }) => {
	const { assignTemplates, tableName, commentIfDeactivated } = commonProps;
	const isCollectionActivated = collection.role?.isActivated !== false;

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
			const script = assignTemplates(templates.alterTableDropDefault, {
				tableName,
				columnName: wrapByBackticks(columnName),
			});
			const isActivated = isCollectionActivated && jsonSchema.isActivated !== false;
			return commentIfDeactivated(script, { isActivated });
		});
};

const getModifiedDefaultColumnValueScripts = ({ app, collection, tableData }) => {
	const { assignTemplates, general } = app.require('@hackolade/ddl-fe-utils');

	const commonProps = {
		assignTemplates,
		tableName: tableData.name,
		commentIfDeactivated: general.commentIfDeactivated,
	};

	const updatedDefaultValuesScriptDtos = getUpdatedDefaultColumnValueScript({ collection, commonProps });
	const dropDefaultValuesScriptDtos = getDeletedDefaultColumnValueScript({ collection, commonProps });
	return [...updatedDefaultValuesScriptDtos, ...dropDefaultValuesScriptDtos];
};

module.exports = {
	getModifiedDefaultColumnValueScripts,
};
