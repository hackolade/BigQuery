const _ = require('lodash');
const { wrapByBackticks } = require('../utils');
const templates = require('../../configs/templates');

const getKeyOptions = ({ keyData, isParentActivated, app }) => {
	const { checkAllKeysDeactivated } = app.require('@hackolade/ddl-fe-utils').general;

	const isAllColumnsDeactivated = checkAllKeysDeactivated({ keys: keyData.columns || [] });
	const columns = _.isEmpty(keyData.columns)
		? ''
		: keyData.columns.map(column => wrapByBackticks(column.name)).join(', ');

	return {
		columns,
		isActivated: !isAllColumnsDeactivated && isParentActivated,
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
