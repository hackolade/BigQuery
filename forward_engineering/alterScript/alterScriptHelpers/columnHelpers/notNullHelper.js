const { pick, toPairs } = require('lodash');
const { wrapByBackticks } = require('../../../helpers/utils');
const templates = require('../../../configs/templates');
const { DATA_TYPE_MODE } = require('../../../helpers/constants');

const getModifiedColumnNotNullScripts = ({ collection, app, tableData }) => {
	const { assignTemplates, general } = app.require('@hackolade/ddl-fe-utils');
	const isCollectionActivated = collection.role?.isActivated !== false;

	return toPairs(collection.properties)
		.map(([name, newJsonSchema]) => {
			const { oldField } = newJsonSchema.compMod;
			const oldJsonSchema = collection.role.properties[oldField.name];
			const isNullDrop =
				newJsonSchema.dataTypeMode === DATA_TYPE_MODE.nullable &&
				oldJsonSchema.dataTypeMode === DATA_TYPE_MODE.required;

			if (isNullDrop) {
				const script = assignTemplates(templates.alterColumnDropNotNull, {
					tableName: tableData.name,
					columnName: wrapByBackticks(name),
				});
				const isActivated = isCollectionActivated && newJsonSchema.isActivated !== false;
				return general.commentIfDeactivated(script, { isActivated });
			}

			return '';
		})
		.filter(Boolean);
};

module.exports = {
	getModifiedColumnNotNullScripts,
};
