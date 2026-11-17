const { toPairs, partition } = require('lodash');
const templates = require('../../../configs/templates');
const { wrapByBackticks, isCollectionInDeltaModelActivated } = require('../../../helpers/utils');

const getModifyColumnNameScript = ({ app, collection, tableData }) => {
	const { tab, commentIfDeactivated } = app.require('@hackolade/ddl-fe-utils').general;
	const assignTemplates = app.require('@hackolade/ddl-fe-utils').assignTemplates;
	const isCollectionActivated = isCollectionInDeltaModelActivated(collection);

	const columnsToRename = toPairs(collection.properties).filter(([_, jsonSchema]) => {
		const compMod = jsonSchema.compMod || {};
		const { newField = {}, oldField = {} } = compMod;

		return newField.name && oldField.name && newField.name !== oldField.name;
	});

	if (columnsToRename.length) {
		const hasActivatedRenames = columnsToRename.some(([_, jsonSchema]) => jsonSchema.isActivated !== false);
		const isStatementActivated = isCollectionActivated && hasActivatedRenames;

		const renameStatementDtos = columnsToRename.map(([_, jsonSchema]) => {
			const compMod = jsonSchema.compMod || {};
			const { newField = {}, oldField = {} } = compMod;

			return {
				statement: assignTemplates(templates.renameColumn, {
					oldColumnName: wrapByBackticks(oldField.name),
					newColumnName: wrapByBackticks(newField.name),
				}),
				isActivated: !isStatementActivated || jsonSchema.isActivated !== false,
			};
		});
		const [activatedRenames, deactivatedRenames] = partition(renameStatementDtos, dto => dto.isActivated);
		const alterStatements =
			activatedRenames.map(dto => dto.statement).join(',\n') +
			deactivatedRenames.map(dto => `\n/*, ${dto.statement} */`).join('');

		const script = assignTemplates(templates.alterTableStatement, {
			name: tableData.name,
			alterStatements: tab(alterStatements),
		});

		return commentIfDeactivated(script, { isActivated: isStatementActivated });
	}

	return '';
};

module.exports = {
	getModifyColumnNameScript,
};
