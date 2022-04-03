module.exports = (app, options) => {
	const _ = app.require('lodash');
	const ddlProvider = require('../../ddlProvider')(null, options, app);
	const { getDbData } = app.require('@hackolade/ddl-fe-utils').general;
	const { getFullName } = require('../general')(app);
	const { checkCompModEqual, getCompMod } = require('./common')(app);

	const getAddContainerScript = modelData => containerData => {
		const constructedDbData = getDbData([containerData]);
		const dbData = ddlProvider.hydrateDatabase(constructedDbData, { modelData });

		return _.trim(ddlProvider.createDatabase(dbData));
	};

	const getDeleteContainerScript = modelData => containerData => {
		const { name } = getDbData([containerData]);
		const projectId = modelData?.[0]?.projectID;
		const fullName = getFullName(projectId, name);
		return ddlProvider.dropDatabase(fullName);
	};

	const getModifiedContainer = modelData => containerData => {
		const compMod = getCompMod(containerData);
		const optionsProperties = [
			'businessName',
			'description',
			'customerEncryptionKey',
			'defaultExpiration',
			'labels',
		];

		const isAnyOptionChanged = _.some(optionsProperties, property => checkCompModEqual(compMod[property] ?? {}));

		if (!isAnyOptionChanged) {
			return '';
		}

		const constructedDbData = getDbData([containerData]);
		const dbData = ddlProvider.hydrateDatabase(constructedDbData, { modelData });

		return ddlProvider.alterDatabase(dbData);
	};

	return {
		getAddContainerScript,
		getDeleteContainerScript,
		getModifiedContainer,
	};
};
