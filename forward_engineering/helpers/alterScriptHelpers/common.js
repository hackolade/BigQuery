module.exports = app => {
	const _ = app.require('lodash');

	const checkFieldPropertiesChanged = (compMod, propertiesToCheck) => {
		return propertiesToCheck.some(prop => compMod?.oldField[prop] !== compMod?.newField[prop]);
	};

	const getCompMod = containerData => containerData.role?.compMod ?? {};

	const checkCompModEqual = ({ new: newItem, old: oldItem } = {}) => _.isEqual(newItem, oldItem);

	const setEntityKeys = ({ idToNameHashTable, idToActivatedHashTable, entity }) => {
		return {
			...entity,
			clusteringKey:
				entity.clusteringKey?.map(key => ({
					...key,
					name: idToNameHashTable[key.keyId],
					isActivated: idToActivatedHashTable[key.keyId],
				})) || [],
			timeUnitpartitionKey:
				entity.timeUnitpartitionKey?.map(key => ({
					...key,
					name: idToNameHashTable[key.keyId],
					isActivated: idToActivatedHashTable[key.keyId],
				})) || [],
			rangeOptions: [
				{
					...(entity.rangeOptions ?? {}),
					rangePartitionKey:
						entity.rangeOptions?.rangePartitionKey?.map(key => ({
							...key,
							name: idToNameHashTable[key.keyId],
							isActivated: idToActivatedHashTable[key.keyId],
						})) || [],
				},
			],
		};
	};

	return {
		checkFieldPropertiesChanged,
		getCompMod,
		checkCompModEqual,
		setEntityKeys,
	};
};
