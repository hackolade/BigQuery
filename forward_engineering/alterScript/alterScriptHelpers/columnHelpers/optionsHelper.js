const _ = require('lodash');
const { getFullName, wrapByBackticks, escapeQuotes } = require('../../../helpers/utils');
const templates = require('../../../configs/templates');

const columnOptions = {
	'description': 'description',
};

const getModifiedColumnOptionScripts = ({ collection, app, tableData }) => {
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');
	const { tab } = app.require('@hackolade/ddl-fe-utils').general;

	return _.toPairs(collection.properties)
		.map(([name, jsonSchema]) => {
			const oldName = jsonSchema.compMod.oldField.name;
			const optionsToUpdate = [];

			Object.entries(columnOptions).forEach(([customOptionName, columnOptionName]) => {
				const newOptionValue = jsonSchema[customOptionName];
				const oldOptionValue = collection.role.properties[oldName]?.[customOptionName];

				if (newOptionValue !== oldOptionValue) {
					const value = newOptionValue ? `"${escapeQuotes(newOptionValue)}"` : 'NULL';
					optionsToUpdate.push(`${columnOptionName}=${value}`);
				}
			});

			if (!optionsToUpdate.length) {
				return '';
			}

			return assignTemplates(templates.alterColumnOptions, {
				tableName: tableData.name,
				columnName: wrapByBackticks(name),
				options: tab(optionsToUpdate.join(',\n')),
			});
		})
		.filter(Boolean);
};

module.exports = {
	getModifiedColumnOptionScripts,
};
