const { toPairs } = require('lodash');
const templates = require('../../../configs/templates');
const { wrapByBackticks } = require('../../../helpers/utils');

const getModifyColumnNameScript = ({ app, collection, tableData }) => {
	const { tab } = app.require('@hackolade/ddl-fe-utils').general;
	const assignTemplates = app.require('@hackolade/ddl-fe-utils').assignTemplates;

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
			.join(',\n');

		return assignTemplates(templates.alterTableStatement, {
			name: tableData.name,
			alterStatements: tab(alterStatements),
		});
	}

	return '';
};

module.exports = {
	getModifyColumnNameScript,
};
