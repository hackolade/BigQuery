const { pick, toPairs } = require('lodash');
const { getFullName, wrapByBackticks, escapeQuotes, getColumnSchema } = require('../../../helpers/utils');
const templates = require('../../../configs/templates');
const { DATA_TYPE_MODE } = require('../../../helpers/constants');

const getModifiedColumnNotNullScripts = ({ collection, app, tableData }) => {
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');

	return toPairs(collection.properties)
		.map(([name, newJsonSchema]) => {
			const { oldField } = newJsonSchema.compMod;
			const oldJsonSchema = collection.role.properties[oldField.name];
			const isNullDrop =
				newJsonSchema.dataTypeMode === DATA_TYPE_MODE.nullable &&
				oldJsonSchema.dataTypeMode === DATA_TYPE_MODE.required;

			if (isNullDrop) {
				return assignTemplates(templates.alterColumnDropNotNull, {
					tableName: tableData.name,
					columnName: wrapByBackticks(name),
				});
			}

			return '';
		})
		.filter(Boolean);
};

module.exports = {
	getModifiedColumnNotNullScripts,
};
