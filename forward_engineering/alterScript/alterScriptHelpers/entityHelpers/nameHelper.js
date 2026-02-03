const templates = require('../../..//configs/templates');
const { wrapByBackticks } = require('../../../helpers/utils');

const getModifyCollectionNameScript = ({ app, collection, dbData }) => {
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');
	const { getFullName } = require('../../../helpers/general')(app);
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
