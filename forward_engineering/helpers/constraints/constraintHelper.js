const _ = require('lodash');
const { wrapByBackticks } = require('../utils');
const templates = require('../../configs/templates');

const getKeyOptions = ({ keyData, isParentActivated, app }) => {
	const { checkAllKeysDeactivated } = app.require('@hackolade/ddl-fe-utils').general;

	const constraintName = keyData.name ? wrapByBackticks(keyData.name.trim()) : '';
	const isAllColumnsDeactivated = checkAllKeysDeactivated({ keys: keyData.columns || [] });

	const columns = _.isEmpty(keyData.columns)
		? ''
		: keyData.columns.map(column => wrapByBackticks(column.name)).join(', ');

	return {
		constraintName,
		columns,
		isActivated: !isAllColumnsDeactivated && isParentActivated,
	};
};

const alterPkConstraint = ({ tableName, isCollectionActivated, keyData, app }) => {
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');
	const { isActivated, ...templateData } = getKeyOptions({ keyData, isParentActivated: isCollectionActivated, app });

	const template = templateData.constraintName ? templates.alterPkConstraint : templates.alterPkConstraintSimple;

	return {
		statement: assignTemplates(template, {
			tableName,
			...templateData,
		}),
		isActivated,
	};
};

const dropPK = ({ tableName, constraintName, app }) => {
	if (!constraintName) {
		return '';
	}

	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');
	const templateData = {
		tableName,
		constraintName: wrapByBackticks(constraintName),
	};

	return assignTemplates(templates.dropPkConstraint, templateData);
};

module.exports = {
	alterPkConstraint,
	dropPK,
};
