import React from 'react';
import { formatPriceLabel } from '../../data/pricing';
import {
  MARKET_COMPARISON_BUNDLE_PRICE,
  MARKET_PRODUCTION_MEDIAN_SUM,
  MARKET_ROWS,
  MARKET_SURVEY_CHECKED_ON,
} from '../../data/marketPriceSurvey';
import { VAT_RATE } from '../../lib/booking/amounts';

const won = (v: number) => formatPriceLabel(v, 'ko');
const range = ([min, max]: [number, number]) => (min === max ? won(min) : `${won(min)}~${won(max)}`);

/**
 * "따로 맡기면 vs 스튜디오 놀 번들" — ko 전용(전략 축 A "가격 비교 안심").
 *
 * 비교 광고라 세 가지를 지킨다. 시장 숫자는 docs/market-price-survey-2026-09.md의 공개 요금에서만
 * 온다. 공개 가격이 없는 항목은 숫자를 만들지 않는다. 부가세 기준이 다르다는 것(시장 쪽은 대부분
 * 미표기, 우리는 별도)을 숨기지 않고 우리 번들의 부가세 포함가를 같이 적는다.
 */
const MarketPriceComparison = () => {
  const bundleWithVat = Math.round(MARKET_COMPARISON_BUNDLE_PRICE * (1 + VAT_RATE));
  return (
    <div className="max-w-5xl mx-auto mt-12">
      <h3 className="typo-card-title text-center text-gray-900 dark:text-white mb-2">따로 맡기면 얼마가 드나요?</h3>
      <p className="typo-card-body text-center text-gray-700 dark:text-gray-300 mb-6">
        서울 독립 스튜디오들이 공개한 요금표와 스튜디오 놀 가격을 나란히 놓았습니다.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left border-collapse text-sm">
          <caption className="sr-only">항목별 시장 공개 요금과 스튜디오 놀 가격 비교</caption>
          <thead>
            <tr className="border-b-2 border-gray-200 dark:border-gray-700">
              <th scope="col" className="py-3 pr-4 font-semibold text-gray-900 dark:text-white">항목</th>
              <th scope="col" className="py-3 px-4 font-semibold text-gray-900 dark:text-white">따로 맡길 때 (공개 요금)</th>
              <th scope="col" className="py-3 px-4 font-semibold text-gray-900 dark:text-white">스튜디오 놀 단품</th>
              <th scope="col" className="py-3 pl-4 font-semibold text-gray-900 dark:text-white">싱글 번들</th>
            </tr>
          </thead>
          <tbody>
            {MARKET_ROWS.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800 align-top">
                <th scope="row" className="py-3 pr-4 font-medium text-gray-900 dark:text-gray-100">{row.item}</th>
                <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                  {row.market.range ? (
                    <>
                      <span className="tabular-nums">{range(row.market.range)}</span>
                      {row.market.median ? (
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          중앙값 {won(row.market.median)} · {row.market.sample}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">{row.market.note}</span>
                  )}
                </td>
                <td className="py-3 px-4 text-gray-700 dark:text-gray-300 tabular-nums">{row.ours ? range(row.ours) : '—'}</td>
                <td className="py-3 pl-4 font-semibold text-primary dark:text-primary-lighter">{row.inBundle ? '포함' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-5 typo-card-body text-gray-800 dark:text-gray-200">
        녹음·믹싱·마스터링만 따로 맡겨도 공개 요금 중앙값을 더하면 {won(MARKET_PRODUCTION_MEDIAN_SUM)}입니다. 스튜디오 놀
        싱글 번들은 {won(MARKET_COMPARISON_BUNDLE_PRICE)}, 부가세를 더해 {bundleWithVat.toLocaleString('en-US')}원이고
        기획·유통 등록·국내외 홍보까지 들어 있습니다. 번들의 믹싱은 트랙 10개 이하 기준입니다.
      </p>
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        시장 가격은 {MARKET_SURVEY_CHECKED_ON}에 각 업체의 공개 요금표에서 확인한 값입니다. 업체마다 포함 범위가 다르고
        대부분 부가세 포함 여부를 적지 않아 대략의 범위로 봐 주세요. 스튜디오 놀 가격은 부가세 별도입니다.
      </p>
    </div>
  );
};

export default MarketPriceComparison;
