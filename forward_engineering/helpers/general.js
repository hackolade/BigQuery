module.exports = (_) => {
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

	const escapeQuotes = (str = '') => {
		return str.replace(/(')/gi, '\\$1');
	};

	const getLabels = (labels) => {
		return labels.map(({ labelKey, labelValue }) => {
			return `("${labelKey}", "${labelValue}")`;
		}).join(',\n');
	};

	return {
		escapeQuotes,
		getLabels,
		getFullName,
	};
};
