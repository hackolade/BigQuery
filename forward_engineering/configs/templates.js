module.exports = {
	createDatabase: 'CREATE SCHEMA${ifNotExist} ${name}${dbOptions};\n',

	createTable:
		'CREATE ${orReplace}${temporary}${external}TABLE ${ifNotExist}${name} ${column_definitions}${partitions}${clustering}${options};\n',

	columnDefinition: '${name}${type}${primaryKey}${default}${notNull}${options}',

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

	alterColumnType: 'ALTER TABLE ${tableName}\nALTER COLUMN IF EXISTS ${columnName}\nSET DATA TYPE ${type};',

	alterColumnDropNotNull: 'ALTER TABLE IF EXISTS ${tableName}\nALTER COLUMN IF EXISTS ${columnName} DROP NOT NULL;',

	alterTableAddColumn: 'ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${column};',

	alterTableDropColumn: 'ALTER TABLE ${tableName} DROP COLUMN IF EXISTS ${columnName};',

	alterTableSetDefault:
		'ALTER TABLE IF EXISTS ${tableName} ALTER COLUMN IF EXISTS ${columnName}\nSET DEFAULT ${default};',

	alterTableDropDefault: 'ALTER TABLE IF EXISTS ${tableName} ALTER COLUMN IF EXISTS ${columnName}\nDROP DEFAULT;',

	renameColumn: 'RENAME COLUMN IF EXISTS ${oldColumnName} TO ${newColumnName}',

	dropView: 'DROP VIEW IF EXISTS ${name};',

	alterViewOptions: 'ALTER ${materialized}VIEW ${name} SET ${options};',

	alterTableStatement: 'ALTER TABLE ${name}\n${alterStatements};',

	renameTable: 'ALTER TABLE IF EXISTS ${oldTableName} RENAME TO ${newTableName};',

	alterPkConstraint: 'ALTER TABLE ${tableName} ADD PRIMARY KEY (${columns}) NOT ENFORCED;',

	dropPk: 'ALTER TABLE ${tableName} DROP PRIMARY KEY IF EXISTS;',

	alterForeignKeyConstraint:
		'ALTER TABLE ${tableName}\nADD${constraintName} FOREIGN KEY (${foreignKeys})\nREFERENCES ${primaryTableName}(${primaryKeys}) NOT ENFORCED;',

	dropForeignKeyConstraint: 'ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${constraintName};',
};
