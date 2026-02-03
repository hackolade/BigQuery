const templates = require('../../..//configs/templates');
const { wrapByBackticks } = require('../../../helpers/utils');

const getModifyCollectionNameScript = ({ app, collection, dbData }) => {
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');
	const collectionName = collection?.role?.compMod?.collectionName;

	if (!collectionName) {
		return undefined;
	}

	const { old: name, new: newName } = collectionName;

	if (!newName || newName === name) {
		return undefined;
	}

	const fullTableName = [dbData.projectId, dbData.databaseName, name].filter(Boolean).join('.');

	return assignTemplates(templates.renameTable, {
		oldTableName: wrapByBackticks(fullTableName),
		newTableName: wrapByBackticks(newName),
	});
};

module.exports = {
	getModifyCollectionNameScript,
};
