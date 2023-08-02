const { escapeQuotes, getTimestamp } = require('./utils');

module.exports = app => {
	const _ = app.require('lodash');
	const { tab } = app.require('@hackolade/ddl-fe-utils').general;

	const getFullName = (projectId, datasetName, tableName) => {
		let name = [];

		if (projectId) {
			name.push(projectId);
		}

		if (datasetName) {
			name.push(datasetName);
		}

		if (tableName) {
			name.push(tableName);
		}

		return '`' + name.join('.') + '`';
	};

	const getLabels = labels => {
		return labels
			.map(({ labelKey, labelValue }) => {
				return `("${labelKey}", "${labelValue}")`;
			})
			.join(',\n');
	};

	const getContainerOptions = ({ friendlyName, description, defaultExpiration, customerEncryptionKey, labels }) => {
		let dbOptions = [];

		if (friendlyName) {
			dbOptions.push(`friendly_name="${friendlyName}"`);
		}

		if (description) {
			dbOptions.push(`description="${escapeQuotes(description)}"`);
		}

		if (customerEncryptionKey) {
			dbOptions.push(`default_kms_key_name="${customerEncryptionKey}"`);
		}

		if (defaultExpiration) {
			dbOptions.push(`default_table_expiration_days=${defaultExpiration}`);
		}

		if (labels.length) {
			dbOptions.push(`labels=[\n${tab(getLabels(labels))}\n]`);
		}

		return dbOptions.length ? `\nOPTIONS(\n${tab(dbOptions.join(',\n'))}\n)` : '';
	};

	const getViewOptions = viewData => {
		let options = [];

		if (viewData.friendlyName) {
			options.push(`friendly_name="${viewData.friendlyName}"`);
		}

		if (viewData.description) {
			options.push(`description="${escapeQuotes(viewData.description)}"`);
		}

		if (viewData.expiration) {
			options.push(`expiration_timestamp=TIMESTAMP "${getTimestamp(viewData.expiration)}"`);
		}

		if (Array.isArray(viewData.labels) && viewData.labels.length) {
			options.push(`labels=[\n${tab(getLabels(viewData.labels))}\n]`);
		}

		if (viewData.materialized && viewData.enableRefresh) {
			options.push(`enable_refresh=true`);

			if (viewData.refreshInterval) {
				options.push(`refresh_interval_minutes=${viewData.refreshInterval}`);
			}
		}

		return options.length ? `\n OPTIONS(\n${tab(options.join(',\n'))}\n)` : '';
	};

	const cleanObject = (obj) => Object.entries(obj)
		.filter(([name, value]) => value)
		.reduce(
			(result, [name, value]) => ({
				...result,
				[name]: value,
			}),
			{},
		);

	const foreignKeysToString = keys => {
		if (Array.isArray(keys)) {
			const activatedKeys = keys.filter(key => _.get(key, 'isActivated', true)).map(key => key.name.trim());
			const deactivatedKeys = keys.filter(key => !_.get(key, 'isActivated', true)).map(key => key.name.trim());
			const deactivatedKeysAsString = deactivatedKeys.length
				? commentIfDeactivated(deactivatedKeys, { isActivated: false }, true)
				: '';
		
			return activatedKeys.join(', ') + deactivatedKeysAsString;
		}
		return keys;
	};
		
	const foreignActiveKeysToString = keys => {
		return keys.map(key => key.name.trim()).join(', ');
	};

	return {
		getLabels,
		getFullName,
		getContainerOptions,
		getViewOptions,
		cleanObject,
		foreignKeysToString,
		foreignActiveKeysToString,
	};
};
