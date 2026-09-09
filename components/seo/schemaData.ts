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
  JSON.stringify(data)
    // </script>가 파서를 벗어나지 못하게 이스케이프.
    .replace(/<\//g, '<\\/')
    // <!--가 들어가면 <script> 파서가 "script data escaped" 상태로 진입해 그 뒤 닫는 태그를
    // 삼킨다(현재 frontmatter에 0건이라 미노출이지만 재발 방지). U+2028/U+2029은 JSON 문자열
    // 안에서는 유효하지만 HTML 밖 일부 JS 파서(줄 종결자 처리)에서 문제가 될 수 있어 함께 이스케이프.
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
);
