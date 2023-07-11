const primaryKeyConstraintIntoPropertyInjector = (property, constraintData) => {
    const constraintType = constraintData.constraint_type
    if (constraintType !== 'PRIMARY KEY') {
        return property
    }

    return {
        ...property,
        primaryKey: true
    }
}

const constraintsInjectors = [primaryKeyConstraintIntoPropertyInjector]

const injectConstraintsIntoTable = (properties, constraintsData) => {
	return Object.fromEntries(Object.entries(properties).map(([propertyName, propertyValue]) => {
		const propertyConstraintData = constraintsData.find(({column_name}) => column_name === propertyName)

		if (!propertyConstraintData) {
			return [propertyName, propertyValue]
		}

		const newPropertyValue = constraintsInjectors.reduce((propertyWithInjectedConstraints, injector) => {
            return injector(propertyWithInjectedConstraints, propertyConstraintData)
        }, propertyValue)
        return [propertyName, newPropertyValue]
	}))
}

module.exports = {
    injectConstraintsIntoTable
}