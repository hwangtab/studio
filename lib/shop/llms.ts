import { formatPriceAmount } from '../../data/pricing';
import type { ShopProduct } from '../../data/shop/catalog';
import { SHOP_FREE_SHIPPING_FROM, SHOP_SALES_OPEN, SHOP_SHIPPING_FEE } from '../../data/shop/policy';
import { loadShopPublicIndex } from './publicIndex';

const won = (n: number) => `${formatPriceAmount(n)} KRW`;

const priceText = (p: ShopProduct): string => {
  const prices = p.skus.filter((s) => !s.retired).map((s) => s.price);
  if (prices.length === 0) return '';
  const min = Math.min(...prices);
  return prices.some((x) => x !== min) ? `from ${won(min)}` : won(min);
};

/** llms.txt의 상점 절 — 순수 함수. 닫혀 있거나 공개 상품이 없으면 빈 문자열. */
export const renderShopLlmsSection = (input: {
  open: boolean;
  siteUrl: string;
  products: readonly ShopProduct[];
  artists: ReadonlyArray<{ slug: string; name: string }>;
}): string => {
  if (!input.open || input.products.length === 0) return '';
  const { siteUrl } = input;
  const lines = input.products.map((p) => `- ${p.title} (${p.category === 'album' ? 'record' : 'goods'}${p.kind === 'digital' ? ', digital download' : ''}) — ${priceText(p)}, VAT included: ${siteUrl}/ko/shop/${p.slug}`);
  const artists = input.artists.map((a) => `- ${a.name}: ${siteUrl}/ko/shop/artist/${a.slug}`);
  return [
    '\n## Shop — Records & Goods (Korean)\n',
    `Studio NOL sells records and goods online (Korea only, Korean-language pages). Sold and shipped by Studio NOL, including artists' items. Shipping fee ${won(SHOP_SHIPPING_FEE)} per order, free for physical goods of ${won(SHOP_FREE_SHIPPING_FROM)} or more. Pay by card, easy-pay or bank transfer through Toss. Shop: ${siteUrl}/ko/shop\n`,
    '### Products\n',
    ...lines,
    ...(artists.length > 0 ? ['\n### Artist shops\n', ...artists] : []),
    '',
  ].join('\n');
};

/** 현재 상점 절. 조회 실패는 삼키고 빈 문자열(llms.txt 전체가 500이 되면 안 된다). */
export const loadShopLlmsSection = async (siteUrl: string): Promise<string> => {
  if (!SHOP_SALES_OPEN) return '';
  try {
    const { products, artists } = await loadShopPublicIndex();
    return renderShopLlmsSection({ open: true, siteUrl, products, artists });
  } catch (error: unknown) {
    console.warn('[llms] 상점 목록을 읽지 못했습니다 —', error);
    return '';
  }
};
