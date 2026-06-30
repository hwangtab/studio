import {
  parsePricingBadges,
  parseResidentBenefits,
  parseTitleDescriptionItems,
} from './contentItems';

describe('parseResidentBenefits', () => {
  it('keeps valid benefit entries and filters non-string points', () => {
    expect(
      parseResidentBenefits([
        {
          title: 'Benefit',
          points: ['One', 2, 'Two'],
          valueBadge: '₩120,000 value',
        },
        { title: 'Invalid points', points: 'not-array' },
        null,
      ])
    ).toEqual([
      {
        title: 'Benefit',
        points: ['One', 'Two'],
        valueBadge: '₩120,000 value',
      },
    ]);
  });
});

describe('parsePricingBadges', () => {
  it('keeps only badges with label and caption strings', () => {
    expect(
      parsePricingBadges([
        { label: 'No deposit', caption: 'Move in lightly' },
        { label: 'Missing caption' },
      ])
    ).toEqual([{ label: 'No deposit', caption: 'Move in lightly' }]);
  });
});

describe('parseTitleDescriptionItems', () => {
  it('keeps only title and description string pairs', () => {
    expect(
      parseTitleDescriptionItems([
        { title: 'Soundproof', description: 'Layered isolation' },
        { title: 'Missing description' },
        'bad',
      ])
    ).toEqual([{ title: 'Soundproof', description: 'Layered isolation' }]);
  });
});
