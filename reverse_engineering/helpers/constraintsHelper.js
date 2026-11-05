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
	const constraintNames = [
		...new Set(foreignKeyConstraintsData.map(({ constraint_name }) => getConstraintBusinessName(constraint_name))),
	];

	return constraintNames.map(constraintName => {
		const columns = foreignKeyConstraintsData
			.filter(({ constraint_name }) => getConstraintBusinessName(constraint_name) === constraintName)
			.toSorted((a, b) => a.ordinal_position - b.ordinal_position);
		const [firstColumn] = columns;

		return {
			relationshipName: constraintName,
			relationshipType: 'Foreign Key',
			childDbName: firstColumn.child_schema,
			childCollection: firstColumn.child_table,
			childField: columns.map(({ child_column }) => child_column),
			dbName: firstColumn.parent_schema,
			parentCollection: firstColumn.parent_table,
			parentField: columns.map(({ parent_column }) => parent_column),
			relationshipInfo: {},
		};
	});
};

module.exports = {
	injectPrimaryKeyConstraintsIntoTable,
	reverseForeignKeys,
};
