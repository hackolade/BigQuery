const _ = require('lodash');
const templates = require('../../../configs/templates');
const { getModifyOptions } = require('../common');

const viewOptions = {
	businessName: 'friendly_name',
	description: 'description',
	expiration: 'expiration_timestamp',
	labels: 'labels',
};

const materializedViewOptions = {
	...viewOptions,
	enableRefresh: 'enable_refresh',
	refreshInterval: 'refresh_interval_minutes',
	maxStaleness: 'max_staleness',
	allowNonIncrementalDefinition: 'allow_non_incremental_definition',
};

const getModifyViewOptionsScript = ({ jsonSchema, viewData, app }) => {
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');
	const options = jsonSchema.materialized ? materializedViewOptions : viewOptions;
	const optionsToUpdate = getModifyOptions({ jsonSchema, app, options });

	if (!optionsToUpdate) {
		return '';
	}

	return assignTemplates(templates.alterViewOptions, {
		materialized: jsonSchema.materialized ? 'MATERIALIZED ' : '',
		name: viewData.name,
		options: optionsToUpdate,
	});
};

module.exports = {
	getModifyViewOptionsScript,
};
