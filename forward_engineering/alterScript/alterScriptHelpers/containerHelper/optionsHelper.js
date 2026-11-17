const _ = require('lodash');
const { wrapByBackticks, isObjectInDeltaModelActivated } = require('../../../helpers/utils');
const templates = require('../../../configs/templates');
const { getModifyOptions } = require('../common');

const options = {
	businessName: 'friendly_name',
	description: 'description',
	customerEncryptionKey: 'default_kms_key_name',
	defaultExpiration: 'default_table_expiration_days',
	labels: 'labels',
};

const getModifyContainerOptionsScript = ({ jsonSchema, containerData, app }) => {
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');
	const { commentIfDeactivated } = app.require('@hackolade/ddl-fe-utils').general;
	const optionsToUpdate = getModifyOptions({ jsonSchema, app, options });

	if (!optionsToUpdate) {
		return '';
	}

	const script = assignTemplates(templates.alterDatabaseOptions, {
		name: wrapByBackticks(containerData.name),
		options: optionsToUpdate,
	});

	return commentIfDeactivated(script, { isActivated: isObjectInDeltaModelActivated(jsonSchema) });
};

module.exports = {
	getModifyContainerOptionsScript,
};
