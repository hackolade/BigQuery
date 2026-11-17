const { getFullName, wrapByBackticks, prepareConstraintName } = require('../../helpers/utils');
const templates = require('../../configs/templates');

const getRelationshipName = ({ relationship }) => {
	const compMod = relationship.role.compMod;
	return compMod.code?.new || compMod.name?.new || relationship.role.code || relationship.role.name;
};

const getOldRelationshipName = ({ relationship }) => {
	const compMod = relationship.role.compMod;
	return compMod.code?.old || compMod.name?.old || relationship.role.code || relationship.role.name;
};

const isRelationshipActivated = ({ relationship }) => {
	return (relationship.role?.compMod?.isActivated?.new ?? relationship.role?.isActivated) !== false;
};

const isRelatedTableActivated = ({ bucket, collection } = {}) => {
	return bucket?.isActivated !== false && collection?.isActivated !== false;
};

const getFullChildTableName = ({ relationship, modelData }) => {
	const compMod = relationship.role.compMod;

	const childBucketName = compMod.child.bucket.name;
	const childEntityName = compMod.child.collection.name;
	const projectId = modelData?.[0]?.projectID;

	return getFullName(projectId, childBucketName, childEntityName);
};

const getAddSingleForeignKeyStatementDto = ({ relationship, modelData, app }) => {
	const compMod = relationship.role.compMod;
	const { checkAllKeysDeactivated } = app.require('@hackolade/ddl-fe-utils').general;
	const { foreignKeysToString, foreignActiveKeysToString } = require('../../helpers/general')(app);
	const assignTemplates = app.require('@hackolade/ddl-fe-utils').assignTemplates;

	const relationshipName = getRelationshipName({ relationship });
	const fullTableName = getFullChildTableName({ relationship, modelData });
	const constraintName = prepareConstraintName(relationshipName);

	const foreignKey = compMod.child.collection.fkFields;
	const primaryKey = compMod.parent.collection.fkFields;
	const isAllPrimaryKeysDeactivated = checkAllKeysDeactivated(primaryKey);
	const isAllForeignKeysDeactivated = checkAllKeysDeactivated(foreignKey);
	const isActivatedBasedOnTableData =
		isRelationshipActivated({ relationship }) &&
		!isAllPrimaryKeysDeactivated &&
		!isAllForeignKeysDeactivated &&
		isRelatedTableActivated(compMod.parent) &&
		isRelatedTableActivated(compMod.child);

	const primaryTableName = getFullName(
		modelData?.[0]?.projectID,
		compMod.parent.bucket.name,
		compMod.parent.collection.name,
	);

	const foreignKeysString = isActivatedBasedOnTableData
		? foreignKeysToString(foreignKey)
		: foreignActiveKeysToString(foreignKey);
	const primaryKeysString = isActivatedBasedOnTableData
		? foreignKeysToString(primaryKey)
		: foreignActiveKeysToString(primaryKey);

	const statement = assignTemplates(templates.alterForeignKeyConstraint, {
		tableName: fullTableName,
		constraintName: constraintName ? ` CONSTRAINT IF NOT EXISTS ${wrapByBackticks(constraintName)}` : '',
		foreignKeys: foreignKeysString,
		primaryTableName,
		primaryKeys: primaryKeysString,
	});

	return {
		statement,
		isActivated: isActivatedBasedOnTableData,
	};
};

const canRelationshipBeAdded = ({ relationship }) => {
	const compMod = relationship.role.compMod;
	if (!compMod) {
		return false;
	}
	return [
		compMod.parent?.bucket,
		compMod.parent?.collection,
		compMod.parent?.collection?.fkFields?.length,
		compMod.child?.bucket,
		compMod.child?.collection,
		compMod.child?.collection?.fkFields?.length,
	].every(Boolean);
};

const getAddForeignKeyScripts =
	({ app, modelData }) =>
	addedRelationships => {
		const { commentIfDeactivated } = app.require('@hackolade/ddl-fe-utils').general;

		return addedRelationships
			.filter(relationship => canRelationshipBeAdded({ relationship }))
			.map(relationship => {
				const scriptDto = getAddSingleForeignKeyStatementDto({ relationship, modelData, app });
				return commentIfDeactivated(scriptDto.statement, { isActivated: scriptDto.isActivated });
			});
	};

const getDeleteSingleForeignKeyStatementDto = ({ app, relationship, modelData }) => {
	const compMod = relationship.role.compMod;
	const tableName = getFullChildTableName({ relationship, modelData });
	const relationshipName = getOldRelationshipName({ relationship });
	const constraintName = prepareConstraintName(relationshipName);
	const assignTemplates = app.require('@hackolade/ddl-fe-utils').assignTemplates;

	const statement = assignTemplates(templates.dropForeignKeyConstraint, {
		tableName,
		constraintName: wrapByBackticks(constraintName),
	});

	return {
		statement,
		isActivated: isRelationshipActivated({ relationship }) && isRelatedTableActivated(compMod.child),
	};
};

const canRelationshipBeDeleted = ({ relationship }) => {
	const compMod = relationship.role.compMod;
	if (!compMod) {
		return false;
	}
	return [
		compMod.code?.old || compMod.name?.old || getRelationshipName({ relationship }),
		compMod.child?.bucket,
		compMod.child?.collection,
	].every(Boolean);
};

const getDeleteForeignKeyScripts =
	({ modelData, app }) =>
	deletedRelationships => {
		const { commentIfDeactivated } = app.require('@hackolade/ddl-fe-utils').general;

		return deletedRelationships
			.filter(relationship => canRelationshipBeDeleted({ relationship }))
			.map(relationship => {
				const scriptDto = getDeleteSingleForeignKeyStatementDto({ app, relationship, modelData });
				return commentIfDeactivated(scriptDto.statement, { isActivated: scriptDto.isActivated });
			});
	};

const getModifyForeignKeyScripts =
	({ modelData, app }) =>
	modifiedRelationships => {
		const { commentIfDeactivated } = app.require('@hackolade/ddl-fe-utils').general;

		return modifiedRelationships
			.filter(
				relationship => canRelationshipBeAdded({ relationship }) && canRelationshipBeDeleted({ relationship }),
			)
			.flatMap(relationship => {
				const deleteScriptDto = getDeleteSingleForeignKeyStatementDto({ app, relationship, modelData });
				const addScriptDto = getAddSingleForeignKeyStatementDto({ relationship, modelData, app });
				const isActivated = deleteScriptDto.isActivated && addScriptDto.isActivated;

				return [
					commentIfDeactivated(deleteScriptDto.statement, { isActivated }),
					commentIfDeactivated(addScriptDto.statement, { isActivated }),
				];
			});
	};

module.exports = ({ modelData, app }) => {
	return {
		getDeleteForeignKeyScripts: getDeleteForeignKeyScripts({ modelData, app }),
		getModifyForeignKeyScripts: getModifyForeignKeyScripts({ modelData, app }),
		getAddForeignKeyScripts: getAddForeignKeyScripts({ modelData, app }),
	};
};
