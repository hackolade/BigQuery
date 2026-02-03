const { toPairs } = require('lodash');
const templates = require('../../../configs/templates');
const { wrapByBackticks, getFullName } = require('../../../helpers/utils');

const getModifyColumnNameScript = ({ app, collection, tableData }) => {
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');

	const columnsToRename = toPairs(collection.properties).filter(([_, jsonSchema]) => {
		const compMod = jsonSchema.compMod || {};
		const { newField = {}, oldField = {} } = compMod;

		return newField.name && oldField.name && newField.name !== oldField.name;
	});

	if (columnsToRename.length) {
		const alterStatements = columnsToRename
			.map(([_, jsonSchema]) => {
				const compMod = jsonSchema.compMod || {};
				const { newField = {}, oldField = {} } = compMod;

				return assignTemplates(templates.renameColumn, {
					oldColumnName: wrapByBackticks(oldField.name),
					newColumnName: wrapByBackticks(newField.name),
				});
			})
			.join(',');

		return assignTemplates(templates.alterTableStatement, {
			name: tableData.name,
			alterStatements,
		});
	}

	return '';
};

module.exports = {
	getModifyColumnNameScript,
};
