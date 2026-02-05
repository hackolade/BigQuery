const _ = require('lodash');
const { PrimaryKeyTransitionDto, KeyScriptModificationDto } = require('../../types/AlterKeyDto');
const { getFullName, wrapByBackticks } = require('../../../helpers/utils');
const { alterPkConstraint, dropPK } = require('../../../helpers/constraints/constraintHelper');
const { CONSTRAINT_POSTFIX } = require('../../../helpers/constraints/constants');

const amountOfColumnsInRegularPk = 1;

const extractOptionsForComparisonWithRegularPkOptions = ({ optionHolder = {} }) => {
	return {
		id: optionHolder.id,
	};
};

const getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions = ({ columnJsonSchema }) => {
	return extractOptionsForComparisonWithRegularPkOptions({
		optionHolder: columnJsonSchema.primaryKeyOptions || {},
	});
};

const getCustomPropertiesOfCompositePkForComparisonWithRegularPkOptions = ({ compositePk }) => {
	const optionsForComparison = extractOptionsForComparisonWithRegularPkOptions({ optionHolder: compositePk });
	return optionsForComparison;
};

const wasCompositePkChangedInTransitionFromCompositeToRegular = ({ collection }) => {
	const pkDto = collection?.role?.compMod?.primaryKey || {};
	const oldPrimaryKeys = pkDto.old || [];
	const idsOfColumns = oldPrimaryKeys.flatMap(pk => pk.compositePrimaryKey?.map(dto => dto.keyId) || []);
	if (idsOfColumns.length !== amountOfColumnsInRegularPk) {
		// We return false, because it wouldn't count as transition between regular PK and composite PK
		// if composite PK did not constraint exactly 1 column
		return PrimaryKeyTransitionDto.noTransition();
	}
	const idOfPkColumn = idsOfColumns[0];
	const newColumnJsonSchema = Object.values(collection.properties).find(
		columnJsonSchema => columnJsonSchema.GUID === idOfPkColumn,
	);
	if (!newColumnJsonSchema) {
		return PrimaryKeyTransitionDto.noTransition();
	}
	const isNewColumnARegularPrimaryKey = newColumnJsonSchema?.primaryKey && !newColumnJsonSchema?.compositePrimaryKey;
	if (!isNewColumnARegularPrimaryKey) {
		return PrimaryKeyTransitionDto.noTransition();
	}
	const constraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions({
		columnJsonSchema: newColumnJsonSchema,
	});
	const areOptionsEqual = oldPrimaryKeys.some(compositePk => {
		if (compositePk.compositePrimaryKey?.length !== amountOfColumnsInRegularPk) {
			return false;
		}
		const oldCompositePkAsRegularPkOptions = getCustomPropertiesOfCompositePkForComparisonWithRegularPkOptions({
			compositePk,
		});

		return _.isEqual(oldCompositePkAsRegularPkOptions, constraintOptions);
	});

	return PrimaryKeyTransitionDto.transition(!areOptionsEqual);
};

const wasCompositePkChangedInTransitionFromRegularToComposite = ({ collection }) => {
	const pkDto = collection?.role?.compMod?.primaryKey || {};
	const newPrimaryKeys = pkDto.new || [];
	const idsOfColumns = newPrimaryKeys.flatMap(pk => pk.compositePrimaryKey?.map(dto => dto.keyId) || []);
	if (idsOfColumns.length !== amountOfColumnsInRegularPk) {
		// We return false, because it wouldn't count as transition between regular PK and composite PK
		// if composite PK does not constraint exactly 1 column
		return PrimaryKeyTransitionDto.noTransition();
	}
	const idOfPkColumn = idsOfColumns[0];
	const oldColumnJsonSchema = Object.values(collection.role.properties).find(
		columnJsonSchema => columnJsonSchema.GUID === idOfPkColumn,
	);
	if (!oldColumnJsonSchema) {
		return PrimaryKeyTransitionDto.noTransition();
	}
	const isOldColumnARegularPrimaryKey = oldColumnJsonSchema?.primaryKey && !oldColumnJsonSchema?.compositePrimaryKey;
	if (!isOldColumnARegularPrimaryKey) {
		return PrimaryKeyTransitionDto.noTransition();
	}
	const constraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions({
		columnJsonSchema: oldColumnJsonSchema,
	});
	const areOptionsEqual = newPrimaryKeys.some(compositePk => {
		if (compositePk.compositePrimaryKey?.length !== amountOfColumnsInRegularPk) {
			return false;
		}
		const oldCompositePkAsRegularPkOptions = getCustomPropertiesOfCompositePkForComparisonWithRegularPkOptions({
			compositePk,
		});

		return _.isEqual(oldCompositePkAsRegularPkOptions, constraintOptions);
	});

	return PrimaryKeyTransitionDto.transition(!areOptionsEqual);
};

const getCreateCompositePKDDLProviderConfig = ({ primaryKey, entityName, entity }) => {
	const pkColumns = _.toPairs(entity.role.properties)
		.filter(([name, jsonSchema]) =>
			Boolean(primaryKey.compositePrimaryKey?.find(keyDto => keyDto.keyId === jsonSchema.GUID)),
		)
		.map(([name, jsonSchema]) => ({
			name,
			isActivated: jsonSchema.isActivated,
		}));

	return {
		columns: pkColumns,
	};
};

const getAddCompositePkScriptDtos = ({ app, collection, tableData }) => {
	const pkDto = collection?.role?.compMod?.primaryKey || {};
	const newPrimaryKeys = pkDto.new || [];
	const oldPrimaryKeys = pkDto.old || [];
	if (newPrimaryKeys.length === 0 && oldPrimaryKeys.length === 0) {
		return [];
	}
	const transitionToCompositeDto = wasCompositePkChangedInTransitionFromRegularToComposite({ collection });
	if (transitionToCompositeDto.didTransitionHappen && !transitionToCompositeDto.wasPkChangedInTransition) {
		return [];
	}
	if (newPrimaryKeys.length === oldPrimaryKeys.length) {
		const areKeyArraysEqual = _(oldPrimaryKeys).differenceWith(newPrimaryKeys, _.isEqual).isEmpty();
		if (areKeyArraysEqual) {
			return [];
		}
	}

	const tableName = tableData.name;
	const isCollectionActivated = collection.isActivated !== false;

	return newPrimaryKeys
		.map(newPk => {
			const ddlConfig = getCreateCompositePKDDLProviderConfig({
				primaryKey: newPk,
				entityName: tableName,
				entity: collection,
			});
			if (_.isEmpty(ddlConfig.columns)) {
				return null;
			}
			const statementDto = alterPkConstraint({
				tableName,
				isCollectionActivated,
				keyData: ddlConfig,
				app,
			});
			return new KeyScriptModificationDto(statementDto.statement, tableName, false, statementDto.isActivated);
		})
		.filter(scriptDto => Boolean(scriptDto?.script));
};

const getDropCompositePkScriptDtos = ({ app, collection, tableData }) => {
	const pkDto = collection?.role?.compMod?.primaryKey || {};
	const newPrimaryKeys = pkDto.new || [];
	const oldPrimaryKeys = pkDto.old || [];
	if (newPrimaryKeys.length === 0 && oldPrimaryKeys.length === 0) {
		return [];
	}
	const transitionToCompositeDto = wasCompositePkChangedInTransitionFromCompositeToRegular({ collection });
	if (transitionToCompositeDto.didTransitionHappen && !transitionToCompositeDto.wasPkChangedInTransition) {
		return [];
	}
	if (newPrimaryKeys.length === oldPrimaryKeys.length) {
		const areKeyArraysEqual = _(oldPrimaryKeys).differenceWith(newPrimaryKeys, _.isEqual).isEmpty();
		if (areKeyArraysEqual) {
			return [];
		}
	}

	const tableName = tableData.name;

	const isCollectionActivated = collection.isActivated !== false;

	return oldPrimaryKeys
		.map(oldPk => {
			const script = dropPK({ tableName, app });
			return new KeyScriptModificationDto(script, tableName, true, isCollectionActivated);
		})
		.filter(scriptDto => Boolean(scriptDto.script));
};

const getModifyCompositePkScriptDtos = ({ collection, app, tableData }) => {
	const dropCompositePkScriptDtos = getDropCompositePkScriptDtos({ app, collection, tableData });
	const addCompositePkScriptDtos = getAddCompositePkScriptDtos({ app, collection, tableData });

	return [...dropCompositePkScriptDtos, ...addCompositePkScriptDtos].filter(Boolean);
};

const getCreateRegularPKDDLProviderConfig = ({ columnName, columnJsonSchema, entityName }) => {
	const pkColumns = [
		{
			name: columnName,
			isActivated: columnJsonSchema.isActivated,
		},
	];

	return {
		columns: pkColumns,
	};
};

const wasFieldChangedToBeARegularPk = ({ columnJsonSchema, collection }) => {
	const oldName = columnJsonSchema.compMod?.oldField?.name;
	if (!oldName) {
		return false;
	}
	const oldColumnJsonSchema = collection.role.properties[oldName];

	const isRegularPrimaryKey = columnJsonSchema.primaryKey && !columnJsonSchema.compositePrimaryKey;
	const wasTheFieldAnyPrimaryKey = Boolean(oldColumnJsonSchema?.primaryKey);

	return isRegularPrimaryKey && !wasTheFieldAnyPrimaryKey;
};

const wasRegularPkChangedInTransitionFromCompositeToRegular = ({ columnJsonSchema, collection }) => {
	const oldName = columnJsonSchema.compMod?.oldField?.name;
	if (!oldName) {
		return PrimaryKeyTransitionDto.noTransition();
	}
	const oldColumnJsonSchema = collection.role.properties[oldName];

	const isRegularPrimaryKey = columnJsonSchema.primaryKey && !columnJsonSchema.compositePrimaryKey;
	const wasTheFieldAnyPrimaryKey = Boolean(oldColumnJsonSchema?.primaryKey);

	if (!(isRegularPrimaryKey && wasTheFieldAnyPrimaryKey)) {
		return PrimaryKeyTransitionDto.noTransition();
	}

	const pkDto = collection?.role?.compMod?.primaryKey || {};
	const newPrimaryKeys = pkDto.new || [];
	const oldPrimaryKeys = pkDto.old || [];
	const wasTheFieldACompositePrimaryKey = oldPrimaryKeys.some(compPk =>
		compPk.compositePrimaryKey?.some(pk => pk.keyId === oldColumnJsonSchema.GUID),
	);
	const isTheFieldACompositePrimaryKey = newPrimaryKeys.some(compPk =>
		compPk.compositePrimaryKey?.some(pk => pk.keyId === columnJsonSchema.GUID),
	);

	const wasCompositePkRemoved = wasTheFieldACompositePrimaryKey && !isTheFieldACompositePrimaryKey;

	if (isRegularPrimaryKey && wasCompositePkRemoved) {
		const constraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions({
			columnJsonSchema,
		});
		const areOptionsEqual = oldPrimaryKeys.some(oldCompositePk => {
			if (oldCompositePk.compositePrimaryKey?.length !== amountOfColumnsInRegularPk) {
				return false;
			}
			const oldCompositePkAsRegularPkOptions = getCustomPropertiesOfCompositePkForComparisonWithRegularPkOptions({
				compositePk: oldCompositePk,
			});

			return _.isEqual(oldCompositePkAsRegularPkOptions, constraintOptions);
		});
		return PrimaryKeyTransitionDto.transition(!areOptionsEqual);
	}

	return PrimaryKeyTransitionDto.noTransition();
};

const wasRegularPkChangedInTransitionFromRegularToComposite = ({ columnJsonSchema, collection }) => {
	const oldName = columnJsonSchema.compMod?.oldField?.name;
	if (!oldName) {
		return PrimaryKeyTransitionDto.noTransition();
	}
	const oldColumnJsonSchema = collection.role.properties[oldName];

	const wasRegularPrimaryKey = oldColumnJsonSchema?.primaryKey && !oldColumnJsonSchema?.compositePrimaryKey;
	const isTheFieldAnyPrimaryKey = Boolean(columnJsonSchema?.primaryKey);

	if (!(wasRegularPrimaryKey && isTheFieldAnyPrimaryKey)) {
		return PrimaryKeyTransitionDto.noTransition();
	}

	const pkDto = collection?.role?.compMod?.primaryKey || {};
	const newPrimaryKeys = pkDto.new || [];
	const oldPrimaryKeys = pkDto.old || [];
	const wasTheFieldACompositePrimaryKey = oldPrimaryKeys.some(compPk =>
		compPk.compositePrimaryKey?.some(pk => pk.keyId === oldColumnJsonSchema.GUID),
	);
	const isTheFieldACompositePrimaryKey = newPrimaryKeys.some(compPk =>
		compPk.compositePrimaryKey?.some(pk => pk.keyId === columnJsonSchema.GUID),
	);

	const wasCompositePkAdded = isTheFieldACompositePrimaryKey && !wasTheFieldACompositePrimaryKey;

	if (wasRegularPrimaryKey && wasCompositePkAdded) {
		const constraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions({
			columnJsonSchema: oldColumnJsonSchema,
		});
		const areOptionsEqual = newPrimaryKeys.some(newCompositePk => {
			if (newCompositePk.compositePrimaryKey?.length !== amountOfColumnsInRegularPk) {
				return false;
			}
			const newCompositePkAsRegularPkOptions = getCustomPropertiesOfCompositePkForComparisonWithRegularPkOptions({
				compositePk: newCompositePk,
			});

			return _.isEqual(newCompositePkAsRegularPkOptions, constraintOptions);
		});
		return PrimaryKeyTransitionDto.transition(!areOptionsEqual);
	}

	return PrimaryKeyTransitionDto.noTransition();
};

const isFieldNoLongerARegularPk = ({ columnJsonSchema, collection }) => {
	const oldName = columnJsonSchema.compMod?.oldField?.name;
	if (!oldName) {
		return false;
	}

	const oldJsonSchema = collection.role.properties[oldName];
	const wasTheFieldARegularPrimaryKey = oldJsonSchema?.primaryKey && !oldJsonSchema?.compositePrimaryKey;

	const isNotAnyPrimaryKey = !columnJsonSchema.primaryKey && !columnJsonSchema.compositePrimaryKey;
	return wasTheFieldARegularPrimaryKey && isNotAnyPrimaryKey;
};

const wasRegularPkModified = ({ columnJsonSchema, collection }) => {
	const oldName = columnJsonSchema.compMod?.oldField?.name;
	if (!oldName) {
		return false;
	}
	const oldJsonSchema = collection.role.properties[oldName] || {};

	const isRegularPrimaryKey = columnJsonSchema.primaryKey && !columnJsonSchema.compositePrimaryKey;
	const wasTheFieldARegularPrimaryKey = oldJsonSchema?.primaryKey && !oldJsonSchema?.compositePrimaryKey;

	if (!(isRegularPrimaryKey && wasTheFieldARegularPrimaryKey)) {
		return false;
	}
	const constraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions({
		columnJsonSchema,
	});
	const oldConstraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions({
		columnJsonSchema: oldJsonSchema,
	});

	return !_.isEqual(oldConstraintOptions, constraintOptions);
};

const getAddPkScriptDtos = ({ app, collection, tableData }) => {
	const tableName = tableData.name;
	const isCollectionActivated = collection.isActivated !== false;

	return _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => {
			if (wasFieldChangedToBeARegularPk({ columnJsonSchema: jsonSchema, collection })) {
				return true;
			}
			const transitionToRegularDto = wasRegularPkChangedInTransitionFromCompositeToRegular({
				columnJsonSchema: jsonSchema,
				collection,
			});
			if (transitionToRegularDto.didTransitionHappen) {
				return transitionToRegularDto.wasPkChangedInTransition;
			}
			return wasRegularPkModified({ columnJsonSchema: jsonSchema, collection });
		})
		.map(([name, jsonSchema]) => {
			const ddlConfig = getCreateRegularPKDDLProviderConfig({
				columnName: name,
				columnJsonSchema: jsonSchema,
				entityName: tableName,
			});
			const statementDto = alterPkConstraint({
				tableName,
				isCollectionActivated,
				keyData: ddlConfig,
				app,
			});
			return new KeyScriptModificationDto(statementDto.statement, tableName, false, statementDto.isActivated);
		})
		.filter(scriptDto => Boolean(scriptDto?.script));
};

const getDropPkScriptDto = ({ app, collection, tableData }) => {
	const tableName = tableData.name;
	const isCollectionActivated = collection.isActivated !== false;

	return _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => {
			if (isFieldNoLongerARegularPk({ columnJsonSchema: jsonSchema, collection })) {
				return true;
			}
			const transitionToRegularDto = wasRegularPkChangedInTransitionFromRegularToComposite({
				columnJsonSchema: jsonSchema,
				collection,
			});
			if (transitionToRegularDto.didTransitionHappen) {
				return transitionToRegularDto.wasPkChangedInTransition;
			}
			return wasRegularPkModified({ columnJsonSchema: jsonSchema, collection });
		})
		.map(([name, jsonSchema]) => {
			const script = dropPK({ tableName, app });
			return new KeyScriptModificationDto(script, tableName, true, isCollectionActivated);
		})
		.filter(scriptDto => Boolean(scriptDto.script));
};

const getModifyPkScriptDtos = ({ app, collection, tableData }) => {
	const dropPkScriptDtos = getDropPkScriptDto({ app, collection, tableData });
	const addPkScriptDtos = getAddPkScriptDtos({ app, collection, tableData });

	return [...dropPkScriptDtos, ...addPkScriptDtos].filter(Boolean);
};

const sortModifyPkConstraints = ({ constraintDtos }) => {
	return constraintDtos.sort((c1, c2) => {
		if (c1.fullTableName === c2.fullTableName) {
			// Number(true) = 1, Number(false) = 0;
			// This ensures that DROP script appears before CREATE script
			// if the same table has 2 scripts that drop and recreate PK
			return Number(c2.isDropScript) - Number(c1.isDropScript);
		}
		// This sorts all statements based on full table name, ASC
		return c1.fullTableName.localeCompare(c2.fullTableName);
	});
};

const getModifyPkConstraintsScriptDtos = ({ app, collection, tableData }) => {
	const modifyCompositePkScriptDtos = getModifyCompositePkScriptDtos({ app, collection, tableData });
	const modifyPkScriptDtos = getModifyPkScriptDtos({ app, collection, tableData });

	const allDtos = [...modifyCompositePkScriptDtos, ...modifyPkScriptDtos];
	const sortedAllDtos = sortModifyPkConstraints({ constraintDtos: allDtos });

	return sortedAllDtos.map(dto => dto.script).filter(Boolean);
};

module.exports = {
	getModifyPkConstraintsScriptDtos,
};
