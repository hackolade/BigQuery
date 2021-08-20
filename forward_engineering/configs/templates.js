module.exports = {
	createDatabase: 'CREATE SCHEMA${ifNotExist} ${name}\n${dbOptions};\n',

	createTable:
		'CREATE ${orReplace}${temporary}${external}TABLE ${ifNotExist}${name} (\n' +
		'${column_definitions}\n' +
		')${partitions}${clustering}${options};\n',

	columnDefinition:
		'${name}${type}${notNull}${options}',

	createView:
		'CREATE ${orReplace}${materialized}VIEW ${ifNotExist}${name}${columns}${partitions}${clustering}${options} AS ${selectStatement};\n',
};
