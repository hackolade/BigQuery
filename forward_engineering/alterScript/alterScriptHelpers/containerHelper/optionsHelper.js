const _ = require('lodash');
const { wrapByBackticks } = require('../../../helpers/utils');
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
	const optionsToUpdate = getModifyOptions({ jsonSchema, app, options });

	if (!optionsToUpdate) {
		return '';
	}

	return assignTemplates(templates.alterDatabaseOptions, {
		name: wrapByBackticks(containerData.name),
		options: optionsToUpdate,
	});
};

module.exports = {
	getModifyContainerOptionsScript,
};
