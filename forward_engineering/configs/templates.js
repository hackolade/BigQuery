module.exports = {
	createDatabase: 'CREATE SCHEMA${ifNotExist} ${name}${dbOptions};\n',

	createTable:
		'CREATE ${orReplace}${temporary}${external}TABLE ${ifNotExist}${name} ${column_definitions}${partitions}${clustering}${options};\n',

	columnDefinition: '${name}${type}${primaryKey}${notNull}${options}',

	createView:
		'CREATE ${orReplace}${materialized}VIEW ${ifNotExist}${name}${columns}${partitions}${clustering}${options} AS ${selectStatement};\n',

	dropDatabase: 'DROP SCHEMA IF EXISTS ${name};',

	alterDatabase: 'ALTER SCHEMA IF EXISTS ${name} SET ${dbOptions};',

	dropTable: 'DROP TABLE IF EXISTS ${name};',

	alterTable: 'ALTER TABLE IF EXISTS ${name} SET ${options};',

	alterColumnOptions:
		'ALTER TABLE IF EXISTS ${tableName} ALTER COLUMN IF EXISTS ${columnName} SET OPTIONS( description="${description}" );',

	alterColumnType: 'ALTER TABLE IF EXISTS ${tableName} ALTER COLUMN IF EXISTS ${columnName} SET DATA TYPE ${type};',

	alterColumnDropNotNull: 'ALTER TABLE IF EXISTS ${tableName} ALTER COLUMN IF EXISTS ${columnName} DROP NOT NULL;',

	alterTableAddColumn: 'ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${column};',

	alterTableDropColumn: 'ALTER TABLE ${tableName} DROP COLUMN IF EXISTS ${columnName};',

	dropView: 'DROP VIEW IF EXISTS ${name};',

	alterViewOptions: 'ALTER ${materialized}VIEW ${name} SET ${options};',
};
