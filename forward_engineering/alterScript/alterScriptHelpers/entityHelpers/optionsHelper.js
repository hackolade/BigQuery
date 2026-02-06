const _ = require('lodash');
const { wrapByBackticks, getFullName, escapeQuotes, getTimestamp } = require('../../../helpers/utils');
const templates = require('../../../configs/templates');

const columnOptions = {
	'description': 'description',
	'partitioningFilterRequired': 'require_partition_filter',
	'expiration': 'expiration_timestamp',
	'customerEncryptionKey': 'kms_key_name',
	'labels': 'labels',
};

const getModifyCollectionOptionsScript = ({ jsonSchema, tableData, app }) => {
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');
	const { tab } = app.require('@hackolade/ddl-fe-utils').general;
	const { getLabels } = require('../../../helpers/general')(app);
	const optionsToUpdate = [];

	Object.entries(columnOptions).forEach(([customOptionName, columnOptionName]) => {
		const { new: newOptionValue, old: oldOptionValue } = jsonSchema.compMod[customOptionName] || {};

		if (!_.isEqual(newOptionValue, oldOptionValue)) {
			switch (customOptionName) {
				case 'description': {
					const value = newOptionValue ? `"${escapeQuotes(newOptionValue)}"` : 'NULL';
					optionsToUpdate.push(`description=${value}`);
					break;
				}
				case 'expiration': {
					const value = newOptionValue ? `TIMESTAMP "${getTimestamp(newOptionValue)}"` : 'NULL';
					optionsToUpdate.push(`${columnOptionName}=${value}`);
					break;
				}
				case 'labels': {
					const value = newOptionValue.length ? `[\n${tab(getLabels(newOptionValue))}\n]` : 'NULL';
					optionsToUpdate.push(`labels=${value}`);
					break;
				}
				default: {
					const value = newOptionValue === undefined || newOptionValue === '' ? 'NULL' : newOptionValue;
					optionsToUpdate.push(`${columnOptionName}=${value}`);
				}
			}
		}
	});

	if (!optionsToUpdate.length) {
		return '';
	}

	return assignTemplates(templates.alterTableSetOptions, {
		tableName: tableData.name,
		options: tab(optionsToUpdate.join(',\n')),
	});
};

module.exports = {
	getModifyCollectionOptionsScript,
};
