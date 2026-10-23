import { PRICE_FACTS } from './priceFacts';
import { AI_REWORK_VOCAL_ONLY_PRICE } from '../../data/aiRework';
import { formatPriceAmount } from '../../data/pricing';

it('lists the AI demo rework with the composed vocal-only price', () => {
  const fact = PRICE_FACTS.find((f) => f.includes('AI Demo Rework'));
  expect(fact).toBeDefined();
  expect(fact).toContain(formatPriceAmount(AI_REWORK_VOCAL_ONLY_PRICE));
});
