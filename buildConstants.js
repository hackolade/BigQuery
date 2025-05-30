const path = require('path');

const DEFAULT_RELEASE_FOLDER_PATH = path.resolve(__dirname, 'release');

const EXCLUDED_EXTENSIONS = ['.js', '.g4', '.interp', '.tokens'];
const EXCLUDED_FILES = [
	'.github',
	'.DS_Store',
	'.editorconfig',
	'.eslintignore',
	'.eslintrc',
	'.git',
	'.gitignore',
	'.vscode',
	'.idea',
	'.prettierignore',
	'.prettierrc',
	'.dockerignore',
	'.sonarlint',
	'build',
	'release',
	'node_modules',
];

module.exports = {
	DEFAULT_RELEASE_FOLDER_PATH,
	EXCLUDED_EXTENSIONS,
	EXCLUDED_FILES,
};
