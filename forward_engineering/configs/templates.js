module.exports = {
	createDatabase: 'CREATE SCHEMA${ifNotExist} ${name}${dbOptions};\n',

	createTable:
		'CREATE ${orReplace}${temporary}${external}TABLE ${ifNotExist}${name} ${column_definitions}${partitions}${clustering}${options};\n',

	columnDefinition: '${name}${type}${primaryKey}${notNull}${options}',

	createForeignKeyConstraint:
		'${constraintName}FOREIGN KEY (${foreignKeys}) REFERENCES ${primaryTableName}(${primaryKeys}) NOT ENFORCED',

	createView:
		'CREATE ${orReplace}${materialized}VIEW ${ifNotExist}${name}${columns}${partitions}${clustering}${options} AS ${selectStatement};\n',

	dropDatabase: 'DROP SCHEMA IF EXISTS ${name};',

	alterDatabase: 'ALTER SCHEMA IF EXISTS ${name} SET ${dbOptions};',

	dropTable: 'DROP TABLE IF EXISTS ${name};',

	alterTable: 'ALTER TABLE IF EXISTS ${name} SET ${options};',

	alterColumnOptions:
		'ALTER TABLE IF EXISTS ${tableName}\nALTER COLUMN IF EXISTS ${columnName}\nSET OPTIONS (\n${options}\n);',

	alterColumnType: 'ALTER TABLE IF EXISTS ${tableName} ALTER COLUMN IF EXISTS ${columnName} SET DATA TYPE ${type};',

	alterColumnDropNotNull: 'ALTER TABLE IF EXISTS ${tableName} ALTER COLUMN IF EXISTS ${columnName} DROP NOT NULL;',

	alterTableAddColumn: 'ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${column};',

	alterTableDropColumn: 'ALTER TABLE ${tableName} DROP COLUMN IF EXISTS ${columnName};',

	renameColumn: 'RENAME COLUMN IF EXISTS ${oldColumnName} TO ${newColumnName}',

	dropView: 'DROP VIEW IF EXISTS ${name};',

	alterViewOptions: 'ALTER ${materialized}VIEW ${name} SET ${options};',

	alterTableStatement: 'ALTER TABLE IF EXISTS ${name}\n${alterStatements};',

	renameTable: 'ALTER TABLE IF EXISTS ${oldTableName} RENAME TO ${newTableName};',

	alterPkConstraint:
		'ALTER TABLE IF EXISTS ${tableName} ADD CONSTRAINT ${constraintName} PRIMARY KEY (${columns}) NOT ENFORCED;',

	alterPkConstraintSimple: 'ALTER TABLE IF EXISTS ${tableName} ADD PRIMARY KEY (${columns}) NOT ENFORCED;',

	dropPkConstraint: 'ALTER TABLE IF EXISTS ${tableName} DROP CONSTRAINT IF EXISTS ${constraintName};',
};
