const { wrapByBackticks, getFullName, isCollectionInDeltaModelActivated } = require('../../../helpers/utils');
const templates = require('../../../configs/templates');

const getModifyCollectionNameScript = ({ app, collection, dbData }) => {
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');
	const { commentIfDeactivated } = app.require('@hackolade/ddl-fe-utils').general;
	const collectionName = collection?.role?.compMod?.collectionName;

	if (!collectionName) {
		return undefined;
	}

	const { old: name, new: newName } = collectionName;

	if (!newName || newName === name) {
		return undefined;
	}

	const fullTableName = getFullName(dbData.projectId, dbData.databaseName, name);

	const script = assignTemplates(templates.renameTable, {
		oldTableName: fullTableName,
		newTableName: wrapByBackticks(newName),
	});

	return commentIfDeactivated(script, { isActivated: isCollectionInDeltaModelActivated(collection) });
};

module.exports = {
	getModifyCollectionNameScript,
};
