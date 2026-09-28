import React from 'react';
import SectionHeading from '../ui/SectionHeading';
import { Section, type SectionVariant } from '../ui/Section';

interface ServiceComparisonProps {
  title: string;
  subtitle?: string;
  /** 첫 칸은 행 이름 자리라 비워 둔다. 마지막 열이 스튜디오 놀(강조). */
  columns: string[];
  /** 각 행: [항목 이름, ...열별 값]. 길이는 columns와 같다. */
  rows: string[][];
  /** 첫 열 머리의 스크린리더용 이름. */
  rowHeaderLabel: string;
  note?: string;
  variant?: SectionVariant;
}

// 서비스 LP의 "다른 선택지와 비교" 표. 마크업은 music-promotion 비교 표와 같은 원칙을 따른다 —
// 모바일은 가로 스크롤 표 대신 항목별 카드로 쌓는다(390px에서 우리 열이 잘려 나가던 문제).
//
// 목적은 AI와 방문자가 "왜 여기에 맡기나/언제 다른 곳이 낫나"를 한 번에 읽는 것이다
// (docs/proposals/aeo-geo-strategy-2026-09-26.md 서비스 LP 감사). 그래서 우리 쪽 값은 정본 수치만,
// 상대 쪽은 경쟁사 이름·시세 숫자 없이 정성적으로 적고, "이런 분께 맞다" 행에서 상대가 나은 경우도 적는다.
const ServiceComparison = ({ title, subtitle, columns, rows, rowHeaderLabel, note, variant = 'default' }: ServiceComparisonProps) => (
  <Section variant={variant}>
    <SectionHeading title={title} subtitle={subtitle} />

    <div className="mt-8 space-y-4 md:hidden">
      {rows.map((row) => (
        <div key={`card-${row[0]}`} className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{row[0]}</p>
          <dl className="mt-3 space-y-2">
            {row.slice(1).map((cell, i) => {
              const isUs = i === row.length - 2;
              return (
                <div
                  key={`card-${row[0]}-${i}`}
                  className={`flex flex-col gap-0.5 rounded-lg px-3 py-2 ${isUs ? 'bg-primary/10 dark:bg-primary/20' : ''}`}
                >
                  <dt
                    className={`text-xs ${
                      isUs ? 'font-semibold text-primary dark:text-primary-lighter' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {columns[i + 1]}
                  </dt>
                  <dd className={`text-sm ${isUs ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                    {cell}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      ))}
    </div>

    <div className="mt-8 hidden overflow-x-auto md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {columns.map((col, i) => {
              const isUs = i === columns.length - 1;
              return (
                <th
                  key={col || `col-${i}`}
                  scope="col"
                  className={`px-4 py-3 font-semibold ${
                    isUs
                      ? 'rounded-t-xl bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-lighter'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {i === 0 ? <span className="sr-only">{rowHeaderLabel}</span> : col}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-b border-gray-100 dark:border-gray-800">
              {row.map((cell, i) => {
                const isUs = i === row.length - 1;
                if (i === 0) {
                  return (
                    <th key={`${row[0]}-${i}`} scope="row" className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                      {cell}
                    </th>
                  );
                }
                return (
                  <td
                    key={`${row[0]}-${i}`}
                    className={`px-4 py-3 ${
                      isUs
                        ? 'bg-primary/10 font-semibold text-gray-900 dark:bg-primary/20 dark:text-white'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {note && <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">{note}</p>}
  </Section>
);

export default ServiceComparison;
