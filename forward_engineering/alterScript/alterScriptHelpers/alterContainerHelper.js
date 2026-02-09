const { getFullName } = require('../../helpers/utils');
const { checkCompModEqual, getCompMod } = require('./common');
const { getModifyContainerOptionsScript } = require('./containerHelper/optionsHelper');

module.exports = (app, options) => {
	const _ = app.require('lodash');
	const ddlProvider = require('../../ddlProvider')(null, options, app);
	const { getDbData } = app.require('@hackolade/ddl-fe-utils').general;

	const getAddContainerScript = modelData => containerData => {
		const constructedDbData = getDbData([containerData]);
		const dbData = ddlProvider.hydrateSchema(constructedDbData, { modelData });

		return _.trim(ddlProvider.createSchema(dbData));
	};

	const getDeleteContainerScript = modelData => containerData => {
		const { name } = getDbData([containerData]);
		const projectId = modelData?.[0]?.projectID;
		const fullName = getFullName(projectId, name);
		return ddlProvider.dropDatabase(fullName);
	};

	const getModifiedContainer = modelData => jsonSchema => {
		const containerData = getDbData([jsonSchema]);
		const modifyContainerOptionsScript = getModifyContainerOptionsScript({ app, jsonSchema, containerData });
		return modifyContainerOptionsScript;
	};

	return {
		getAddContainerScript,
		getDeleteContainerScript,
		getModifiedContainer,
	};
};
