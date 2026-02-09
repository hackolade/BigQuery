const _ = require('lodash');
const templates = require('../../../configs/templates');
const { getModifyOptions } = require('../common');

const options = {
	businessName: 'friendly_name',
	description: 'description',
	partitioningFilterRequired: 'require_partition_filter',
	expiration: 'expiration_timestamp',
	customerEncryptionKey: 'kms_key_name',
	labels: 'labels',
};

const getModifyCollectionOptionsScript = ({ jsonSchema, tableData, app }) => {
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');
	const optionsToUpdate = getModifyOptions({ jsonSchema, app, options });

	if (!optionsToUpdate) {
		return '';
	}

	return assignTemplates(templates.alterTableSetOptions, {
		tableName: tableData.name,
		options: optionsToUpdate,
	});
};

module.exports = {
	getModifyCollectionOptionsScript,
};
