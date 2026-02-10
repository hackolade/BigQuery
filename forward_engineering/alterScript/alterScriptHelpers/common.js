const { isEqual } = require('lodash');
const { escapeQuotes, getTimestamp, getName } = require('../../helpers/utils');

const getCompMod = containerData => containerData.role?.compMod ?? {};

const checkCompModEqual = ({ new: newItem, old: oldItem } = {}) => isEqual(newItem, oldItem);

const setEntityKeys = ({ idToNameHashTable, idToActivatedHashTable, entity }) => {
	const setKeyArray = obj =>
		Array.isArray(obj)
			? obj.map(item => ({
					...item,
					name: idToNameHashTable[item.keyId],
					isActivated: idToActivatedHashTable[item.keyId],
				}))
			: [];

	return {
		...entity,
		clusteringKey: setKeyArray(entity.clusteringKey),
		timeUnitpartitionKey: setKeyArray(entity.timeUnitpartitionKey),
		rangeOptions: [
			{
				...(entity.rangeOptions ?? {}),
				rangePartitionKey: setKeyArray(entity.rangeOptions?.rangePartitionKey),
			},
		],
	};
};

const getModifyOptions = ({ jsonSchema, app, options }) => {
	const { tab } = app.require('@hackolade/ddl-fe-utils').general;
	const { getLabels } = require('../../helpers/general')(app);
	const optionsToUpdate = [];

	Object.entries(options).forEach(([customOptionName, columnOptionName]) => {
		const { new: newOptionValue, old: oldOptionValue } = jsonSchema.compMod[customOptionName] || {};

		if (!isEqual(newOptionValue, oldOptionValue)) {
			switch (customOptionName) {
				case 'businessName': {
					const name = getName(jsonSchema.role);
					if (name !== newOptionValue) {
						const value = newOptionValue ? `"${newOptionValue}"` : 'NULL';
						optionsToUpdate.push(`${columnOptionName}=${value}`);
					}
					break;
				}
				case 'description': {
					const value = newOptionValue ? `"${escapeQuotes(newOptionValue)}"` : 'NULL';
					optionsToUpdate.push(`${columnOptionName}=${value}`);
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

	return tab(optionsToUpdate.join(',\n'));
};

module.exports = {
	getCompMod,
	checkCompModEqual,
	setEntityKeys,
	getModifyOptions,
};
