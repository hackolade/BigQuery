/**
 * @param index {number}
 * @param amountOfStatements {number}
 * @param lastIndexOfActivatedStatement {number}
 * @param delimiter {string}
 * @param delimiterForLastActivatedStatement {string}
 * @return {string}
 * */
const getDelimiterForJoiningStatementsBasedOnActivation = ({
                                                               index,
                                                               amountOfStatements,
                                                               lastIndexOfActivatedStatement,
                                                               delimiter = ',\n',
                                                               delimiterForLastActivatedStatement = '\n',
                                                           }) => {
    if (index === amountOfStatements - 1) {
        return '';
    }
    if (lastIndexOfActivatedStatement === -1) {
        return delimiter;
    }
    if (index === lastIndexOfActivatedStatement) {
        return delimiterForLastActivatedStatement;
    }
    return delimiter;
}

/**
 * @param statementDtos {Array<{
 *     statement: string,
 *     isActivated: boolean,
 * }>}
 * @return {number}
 */
const getLastIndexOfActivatedStatement = (statementDtos) => {
     for (let i = statementDtos.length - 1; i >= 0; i--) {
         const statementDto = statementDtos[i] || {};
         if (statementDto.isActivated) {
             return i;
         }
     }
     return -1;
}


/**
 * @param statementDtos {Array<{
 *     statement: string,
 *     isActivated: boolean,
 * }>}
 * @param delimiter {string | undefined}
 * @param delimiterForLastActivatedStatement {string | undefined}
 * @return {string}
 * */
const joinActivatedAndDeactivatedStatements = ({
                                                   statementDtos,
                                                   delimiter = ',\n',
                                                   delimiterForLastActivatedStatement = '\n',
                                               }) => {
    const partsOfFinalStatement = [];
    const lastIndexOfActivatedStatement = getLastIndexOfActivatedStatement(statementDtos);

    for (let i = 0; i < statementDtos.length; i++) {
        const statementDto = statementDtos[i] || {};
        const {statement} = statementDto;
        partsOfFinalStatement.push(statement);

        const currentDelimiter = getDelimiterForJoiningStatementsBasedOnActivation({
            index: i,
            amountOfStatements: statementDtos.length,
            lastIndexOfActivatedStatement,
            delimiter,
            delimiterForLastActivatedStatement,
        });
        partsOfFinalStatement.push(currentDelimiter);
    }
    return partsOfFinalStatement.join('');
}

module.exports = {
    joinActivatedAndDeactivatedStatements,
}
