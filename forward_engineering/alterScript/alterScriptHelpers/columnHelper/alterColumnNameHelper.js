const { toPairs } = require('lodash');
const templates = require('../../../configs/templates');
const { wrapByBackticks } = require('../../../helpers/utils');

const getModifyColumnNameScript = ({ app, collection, dbData }) => {
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');
	const { getFullName } = require('../../../helpers/general')(app);

	const columnsToRename = toPairs(collection.properties).filter(([_, jsonSchema]) => {
		const compMod = jsonSchema.compMod || {};
		const { newField = {}, oldField = {} } = compMod;

		return newField.name && oldField.name && newField.name !== oldField.name;
	});

	if (columnsToRename.length) {
		const fullTableName = getFullName(
			dbData.projectId,
			dbData.databaseName,
			collection.role?.name || collection.name,
		);
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
			name: fullTableName,
			alterStatements,
		});
	}

	return '';
};

module.exports = {
	getModifyColumnNameScript,
};
