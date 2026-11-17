const _ = require('lodash');
const templates = require('../../configs/templates');

const getKeyOptions = ({ keyData, isParentActivated, app }) => {
	const { checkAllKeysDeactivated } = app.require('@hackolade/ddl-fe-utils').general;
	const { foreignKeysToString, foreignActiveKeysToString } = require('../general')(app);

	const keyColumns = keyData.columns || [];
	const isAllColumnsDeactivated = checkAllKeysDeactivated(keyColumns);
	const isActivated = !isAllColumnsDeactivated && isParentActivated;
	let columns = '';

	if (!_.isEmpty(keyColumns)) {
		columns = isActivated ? foreignKeysToString(keyColumns) : foreignActiveKeysToString(keyColumns);
	}

	return {
		columns,
		isActivated,
	};
};

const alterPkConstraint = ({ tableName, isCollectionActivated, keyData, app }) => {
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');
	const { isActivated, ...templateData } = getKeyOptions({ keyData, isParentActivated: isCollectionActivated, app });

	return {
		statement: assignTemplates(templates.alterPkConstraint, {
			tableName,
			...templateData,
		}),
		isActivated,
	};
};

const dropPK = ({ tableName, app }) => {
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');

	return assignTemplates(templates.dropPk, { tableName });
};

module.exports = {
	alterPkConstraint,
	dropPK,
};
