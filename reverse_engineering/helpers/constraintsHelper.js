const primaryKeyConstraintIntoPropertyInjector =
	(property, propertyConstraintData) =>
	({ isConstraintComposed, constraintType }) => {
		if (constraintType !== 'PRIMARY KEY') {
			return property;
		}

		if (isConstraintComposed) {
			return {
				...property,
				compositePrimaryKey: true,
				primaryKey: true,
			};
		}

		return {
			...property,
			primaryKey: true,
		};
	};

const constraintsInjectors = [primaryKeyConstraintIntoPropertyInjector];

const injectPrimaryKeyConstraintsIntoTable = ({ datasetId, tableName, properties, constraintsData }) => {
	let primaryKey = [];
	const propertiesWithInjectedConstraints = Object.fromEntries(
		Object.entries(properties).map(([propertyName, propertyValue]) => {
			const propertyPKConstraintData = constraintsData.find(
				({ table_schema, table_name, column_name }) =>
					table_schema === datasetId && table_name === tableName && column_name === propertyName,
			);

			if (!propertyPKConstraintData) {
				return [propertyName, propertyValue];
			}
			const propertiesByConstraints = groupPropertiesByConstraints(constraintsData);
			const constraintName = propertyPKConstraintData.constraint_name;
			const constraintType = propertyPKConstraintData.constraint_type;
			const isConstraintComposed = propertiesByConstraints[constraintName].length > 1;

			if (constraintType === 'PRIMARY KEY' && isConstraintComposed) {
				primaryKey = getCompositePrimaryKeyFieldModelData({ primaryKey, constraintName, propertyName });
			}

			const newPropertyValue = constraintsInjectors.reduce((propertyWithInjectedConstraints, injector) => {
				return injector(
					propertyWithInjectedConstraints,
					propertyPKConstraintData,
				)({ isConstraintComposed, constraintType });
			}, propertyValue);
			return [propertyName, newPropertyValue];
		}),
	);

	return {
		propertiesWithInjectedConstraints,
		primaryKey: primaryKey.map(pk => ({ compositePrimaryKey: pk.compositePrimaryKey })),
	};
};

const groupPropertiesByConstraints = constraintsData => {
	const constraintsNames = Array.from(new Set(constraintsData.map(({ constraint_name }) => constraint_name)));
	let propertiesByConstraints = {};
	constraintsNames.forEach(constraintName => {
		propertiesByConstraints = {
			...propertiesByConstraints,
			[constraintName]: constraintsData.filter(({ constraint_name }) => constraint_name === constraintName),
		};
	});
	return propertiesByConstraints;
};

const getCompositePrimaryKeyFieldModelData = ({ primaryKey, constraintName, propertyName }) => {
	const composedPkToUpdate = primaryKey.find(({ name }) => name === constraintName);
	if (composedPkToUpdate) {
		const newPrimaryKey = primaryKey.filter(({ name }) => name !== constraintName);
		const newCompositePk = {
			...composedPkToUpdate,
			compositePrimaryKey: [...composedPkToUpdate.compositePrimaryKey, propertyName],
		};
		return [...newPrimaryKey, newCompositePk];
	} else {
		return [...primaryKey, { name: constraintName, compositePrimaryKey: [{ name: propertyName }] }];
	}
};

const getConstraintBusinessName = constraintNameFromCloud => {
	const [constraintChildTableName, constraintBusinessName] = constraintNameFromCloud.split('.');
	return constraintBusinessName;
};

const reverseForeignKeys = foreignKeyConstraintsData => {
	return foreignKeyConstraintsData.reduce((constraints, fkConstraintData) => {
		const constraintNameToUse = getConstraintBusinessName(fkConstraintData.constraint_name);
		const constraintInList = constraints.find(({ relationshipName }) => relationshipName === constraintNameToUse);
		const { parent_column, child_column } = fkConstraintData;
		if (constraintInList) {
			const isParentAdded = constraintInList.parentField.includes(parent_column);
			const isChildAdded = constraintInList.childField.includes(child_column);
			const newConstraintData = {
				...constraintInList,
				childField: isChildAdded ? constraintInList.childField : [...constraintInList.childField, child_column],
				parentField: isParentAdded
					? constraintInList.parentField
					: [...constraintInList.parentField, parent_column],
			};
			return [
				...constraints.filter(({ relationshipName }) => relationshipName !== constraintNameToUse),
				newConstraintData,
			];
		} else {
			const newConstraint = {
				relationshipName: constraintNameToUse,
				relationshipType: 'Foreign Key',
				childDbName: fkConstraintData.child_schema,
				childCollection: fkConstraintData.child_table,
				childField: [fkConstraintData.child_column],
				dbName: fkConstraintData.parent_schema,
				parentCollection: fkConstraintData.parent_table,
				parentField: [fkConstraintData.parent_column],
				relationshipInfo: {},
			};
			return [...constraints, newConstraint];
		}
	}, []);
};

module.exports = {
	injectPrimaryKeyConstraintsIntoTable,
	reverseForeignKeys,
};
