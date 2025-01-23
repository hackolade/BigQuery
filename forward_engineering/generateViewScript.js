const { generateScript } = require('./generateScript');

const generateViewScript = (...args) => {
	return generateScript(...args);
};

module.exports = {
	generateViewScript,
};
