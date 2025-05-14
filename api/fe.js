const { generateScript } = require('../forward_engineering/generateScript');
const { generateContainerScript } = require('../forward_engineering/generateContainerScript');
const { generateViewScript } = require('../forward_engineering/generateViewScript');
const { isDropInStatements } = require('../forward_engineering/isDropInStatements');

module.exports = {
	generateScript,
	generateContainerScript,
	generateViewScript,
	isDropInStatements,
};
