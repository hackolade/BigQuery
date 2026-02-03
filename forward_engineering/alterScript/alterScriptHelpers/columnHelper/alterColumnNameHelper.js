const _ = require('lodash');
const templates = require('../../../configs/templates');
const { wrapByBackticks } = require('../../../helpers/utils');

const getModifyColumnNameScript = ({ app, collection, dbData }) => {
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');
	const { getFullCollectionName } = require('../../../helpers/general')(app);

	const columnsToRename = _.toPairs(collection.properties).filter(([_, jsonSchema]) => {
		const compMod = jsonSchema.compMod || {};
		const { newField = {}, oldField = {} } = compMod;

		return newField.name && oldField.name && newField.name !== oldField.name;
	});

	if (columnsToRename.length) {
		const fullTableName = getFullCollectionName({ dbData, collection });
		const alterStatements = columnsToRename
			.map(([_, jsonSchema]) => {
				const compMod = jsonSchema.compMod || {};
				const { newField = {}, oldField = {} } = compMod;

				const isCollectionActivated = collection.isActivated;
				const isActivated = isCollectionActivated && jsonSchema.isActivated;

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
