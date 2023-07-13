const primaryKeyConstraintIntoPropertyInjector = (property) => ({isConstraintComposed, constraintType}) =>  {
    if (constraintType !== 'PRIMARY KEY') {
        return property
    }

    if (isConstraintComposed) {
        return {
            ...property,
            compositePrimaryKey: true,
            primaryKey: true
        }
    }

    return {
        ...property,
        primaryKey: true
    }
}

const constraintsInjectors = [primaryKeyConstraintIntoPropertyInjector]

const injectConstraintsIntoTable = ({datasetId, tableName, properties, constraintsData}) => {
    let primaryKey = []
	const propertiesWithInjectedConstraints = Object.fromEntries(Object.entries(properties).map(([propertyName, propertyValue]) => {
		const propertyConstraintData = constraintsData.find(({table_schema, table_name, column_name}) => 
        table_schema === datasetId && 
        table_name === tableName && 
        column_name === propertyName)

		if (!propertyConstraintData) {
			return [propertyName, propertyValue]
		}
        const propertiesByConstraints = groupPropertiesByConstraints(constraintsData)
        const constraintName = propertyConstraintData.constraint_name
        const constraintType = propertyConstraintData.constraint_type
        const isConstraintComposed = propertiesByConstraints[constraintName].length > 1

        if (constraintType === 'PRIMARY KEY' && isConstraintComposed) {
            const composedPkToUpdate = primaryKey.find(({name}) => name === constraintName)
            if (composedPkToUpdate) {
                const newPrimaryKey = primaryKey.filter(({name}) => name !== constraintName)
                const newCompositePk = {...composedPkToUpdate, compositePrimaryKey: [...composedPkToUpdate.compositePrimaryKey, propertyName]}
                primaryKey = [...newPrimaryKey, newCompositePk]
            } else {
                primaryKey = [...primaryKey, {name: constraintName, compositePrimaryKey: [{name: propertyName}]}]
            }
            
        }

		const newPropertyValue = constraintsInjectors.reduce((propertyWithInjectedConstraints, injector) => {
            return injector(propertyWithInjectedConstraints, propertyConstraintData)({isConstraintComposed, constraintType})
        }, propertyValue)
        return [propertyName, newPropertyValue]
	}))

    return {
        propertiesWithInjectedConstraints,
        primaryKey: primaryKey.map(pk => ({compositePrimaryKey: pk.compositePrimaryKey}))
    }
}

const groupPropertiesByConstraints = (constraintsData) => {
    const constraintsNames = Array.from(new Set(constraintsData.map(({constraint_name}) => constraint_name)))
    let propertiesByConstraints = {}
    constraintsNames.forEach(constraintName => {
        propertiesByConstraints = {
            ...propertiesByConstraints,
            [constraintName] : constraintsData.filter(({constraint_name}) => constraint_name === constraintName)
        }
    })
    return propertiesByConstraints
}

module.exports = {
    injectConstraintsIntoTable
}