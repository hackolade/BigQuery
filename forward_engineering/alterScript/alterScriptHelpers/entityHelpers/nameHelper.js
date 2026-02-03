const { wrapByBackticks, getFullName } = require('../../../helpers/utils');
const templates = require('../../../configs/templates');

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

	const fullTableName = getFullName(dbData.projectId, dbData.databaseName, name);

	return assignTemplates(templates.renameTable, {
		oldTableName: fullTableName,
		newTableName: wrapByBackticks(newName),
	});
};

module.exports = {
	getModifyCollectionNameScript,
};
