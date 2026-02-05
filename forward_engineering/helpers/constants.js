const DROP_STATEMENTS = [
	'DROP SCHEMA',
	'DROP TABLE',
	'DROP COLUMN',
	'DROP VIEW',
	'DROP CONSTRAINT',
	'DROP PRIMARY KEY',
];

const DATA_TYPE_MODE = {
	nullable: 'Nullable',
	required: 'Required',
	repeated: 'Repeated',
};

module.exports = {
	DROP_STATEMENTS,
	DATA_TYPE_MODE,
};
