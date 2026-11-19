const escapeTagText = value =>
	String(value)
		.replace(/(")/gi, String.raw`\$1`)
		.replace(/\n/gi, String.raw`\n`);

const withoutKeys = ({ item, keys }) => {
	if (!item) {
		return item;
	}

	return Object.fromEntries(Object.entries(item).filter(([key]) => !keys.includes(key)));
};

const isStructItem = item => item?.type === 'struct' || item?.childType === 'struct';

const getTags = tags => {
	if (!Array.isArray(tags)) {
		return '';
	}

	const tagsByKey = new Map();

	tags.forEach(tag => {
		if (!tag?.tagKey) {
			return;
		}

		tagsByKey.set(tag.tagKey, tag.tagValue ?? '');
	});

	return [...tagsByKey.entries()]
		.map(([tagKey, tagValue]) => `("${escapeTagText(tagKey)}", "${escapeTagText(tagValue)}")`)
		.join(',\n');
};

const getResourceTagsOption = ({ tags, tab }) => {
	const tagStatement = getTags(tags);

	if (!tagStatement) {
		return '';
	}

	return `tags=[\n${tab(tagStatement)}\n]`;
};

const getDataGovernanceTagClause = jsonSchema => {
	if (!jsonSchema || isStructItem(jsonSchema)) {
		return '';
	}

	const items = jsonSchema.items ? [jsonSchema.items].flat() : [];

	if (jsonSchema.type === 'array' && items.some(item => isStructItem(item))) {
		return '';
	}

	const tagKey = jsonSchema.dataGovernanceTag?.tagKey;

	if (!tagKey) {
		return '';
	}

	const tagValue = jsonSchema.dataGovernanceTag.tagValue ?? '';

	return `data_governance_tags=[("${escapeTagText(tagKey)}", "${escapeTagText(tagValue)}")]`;
};

const withoutDataGovernanceTag = item => {
	if (isStructItem(item)) {
		return item;
	}

	return withoutKeys({ item, keys: ['dataGovernanceTag'] });
};

// extra error processing, for better UX
const addTagKeyDetail = ({ error, query, logger }) => {
	if (!/invalid tagkey/i.test(error?.message || '')) {
		return error;
	}
	const dataGovTags = query.matchAll(/(?:data_governance_tags|(?:^|[^\w])tags)\s*=\s*\[([\s\S]*?)]/gi);

	const tagKeys = [];

	[...dataGovTags].forEach(([, body]) => {
		[...body.matchAll(/\(\s*(["'])((?:\\.|(?!\1).)*)\1/g)].forEach(([, quote, tagKey]) => {
			tagKeys.push(tagKey.replaceAll(`\\${quote}`, quote).replaceAll(String.raw`\n`, '\n'));
		});
	});

	const uniqueTagKeys = [...new Set(tagKeys)].map(tagKey => `"${tagKey}"`);

	if (!uniqueTagKeys.length) {
		return error;
	}

	const label = `\nTag key${uniqueTagKeys.length === 1 ? '' : 's'}`;

	error.message = `${error.message} ${label}:\n${uniqueTagKeys.join(', ')}.`;

	return error;
};

module.exports = {
	addTagKeyDetail,
	getDataGovernanceTagClause,
	getResourceTagsOption,
	withoutDataGovernanceTag,
};
