const { DROP_STATEMENTS } = require('./constants');

const commentDropStatements = (script = '') =>
	script
		.split('\n')
		.map(line => {
			const isAlreadyCommented = line.trimStart().startsWith('--');

			if (!isAlreadyCommented && DROP_STATEMENTS.some(statement => line.includes(statement))) {
				return `-- ${line}`;
			} else {
				return line;
			}
		})
		.join('\n');

module.exports = {
	commentDropStatements,
};
