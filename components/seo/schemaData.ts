export type JsonLdObject = Record<string, unknown>;

interface BuildFinalSchemaDataOptions {
  includeSchema: boolean;
  schemaItems: JsonLdObject[];
  breadcrumbSchema?: JsonLdObject | null;
  faqSchema?: JsonLdObject | null;
}

const isJsonLdObject = (input: unknown): input is JsonLdObject => (
  typeof input === 'object' && input !== null && !Array.isArray(input)
);

const withoutContext = (item: JsonLdObject): JsonLdObject => {
  const { ['@context']: _context, ...rest } = item;
  return rest;
};

export const collectSchemaItems = (input: unknown): JsonLdObject[] => {
  const items: JsonLdObject[] = [];

  const addItems = (item: unknown) => {
    if (!item) return;
    if (Array.isArray(item)) {
      item.forEach(addItems);
      return;
    }
    if (isJsonLdObject(item) && '@graph' in item) {
      const graph = item['@graph'];
      if (Array.isArray(graph)) graph.forEach(addItems);
      return;
    }
    if (isJsonLdObject(item)) {
      items.push(item);
    }
  };

  addItems(input);
  return items.filter(Boolean);
};

export const buildSchemaData = (items: JsonLdObject[]): JsonLdObject | null => {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0];
  return {
    '@context': 'https://schema.org',
    '@graph': items.map(withoutContext),
  };
};

export const buildFinalSchemaData = ({
  includeSchema,
  schemaItems,
  breadcrumbSchema,
  faqSchema,
}: BuildFinalSchemaDataOptions): JsonLdObject | null => {
  if (!includeSchema) return null;

  const extraItems = [breadcrumbSchema, faqSchema]
    .filter(isJsonLdObject)
    .map(withoutContext);

  const items = [...schemaItems, ...extraItems];
  return buildSchemaData(items);
};

export const serializeJsonLd = (data: JsonLdObject) => (
  JSON.stringify(data).replace(/<\//g, '<\\/')
);
