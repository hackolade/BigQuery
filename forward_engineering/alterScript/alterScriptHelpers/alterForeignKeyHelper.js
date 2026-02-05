const { getFullName, wrapByBackticks, prepareConstraintName } = require('../../helpers/utils');
const templates = require('../../configs/templates');

const getRelationshipName = ({ relationship }) => {
	const compMod = relationship.role.compMod;
	return compMod.code?.new || compMod.name?.new || relationship.role.code || relationship.role.name;
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
	const isActivated = compMod.isActivated?.new ?? relationship.role.isActivated;
	const isAllPrimaryKeysDeactivated = checkAllKeysDeactivated(primaryKey);
	const isAllForeignKeysDeactivated = checkAllKeysDeactivated(foreignKey);
	const isActivatedBasedOnTableData =
		isActivated &&
		!isAllPrimaryKeysDeactivated &&
		!isAllForeignKeysDeactivated &&
		compMod.parent.collection.isActivated &&
		compMod.child.collection.isActivated;

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
		constraintName: constraintName ? ` CONSTRAINT ${wrapByBackticks(constraintName)}` : '',
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
		return addedRelationships
			.filter(relationship => canRelationshipBeAdded({ relationship }))
			.map(relationship => {
				const scriptDto = getAddSingleForeignKeyStatementDto({ relationship, modelData, app });
				return scriptDto.statement;
			});
	};

const getDeleteSingleForeignKeyStatementDto = ({ app, relationship, modelData }) => {
	const compMod = relationship.role.compMod;
	const tableName = getFullChildTableName({ relationship, modelData });
	const relationshipName = getRelationshipName({ relationship });
	const constraintName = prepareConstraintName(relationshipName);
	const assignTemplates = app.require('@hackolade/ddl-fe-utils').assignTemplates;

	const statement = assignTemplates(templates.dropForeignKeyConstraint, {
		tableName,
		constraintName: wrapByBackticks(constraintName),
	});

	const isRelationshipActivated = Boolean(relationship.role?.compMod?.isActivated?.new);
	const isChildTableActivated = compMod.child.collection.isActivated;
	return {
		statement,
		isActivated: isRelationshipActivated && isChildTableActivated,
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
		return deletedRelationships
			.filter(relationship => canRelationshipBeDeleted({ relationship }))
			.map(relationship => {
				const scriptDto = getDeleteSingleForeignKeyStatementDto({ app, relationship, modelData });
				return scriptDto.statement;
			});
	};

const getModifyForeignKeyScripts =
	({ modelData, app }) =>
	modifiedRelationships => {
		return modifiedRelationships
			.filter(
				relationship => canRelationshipBeAdded({ relationship }) && canRelationshipBeDeleted({ relationship }),
			)
			.map(relationship => {
				const deleteScriptDto = getDeleteSingleForeignKeyStatementDto({ app, relationship, modelData });
				const addScriptDto = getAddSingleForeignKeyStatementDto({ relationship, modelData, app });

				return [deleteScriptDto.statement, addScriptDto.statement];
			})
			.flat();
	};

module.exports = ({ modelData, app }) => {
	return {
		getDeleteForeignKeyScripts: getDeleteForeignKeyScripts({ modelData, app }),
		getModifyForeignKeyScripts: getModifyForeignKeyScripts({ modelData, app }),
		getAddForeignKeyScripts: getAddForeignKeyScripts({ modelData, app }),
	};
};
