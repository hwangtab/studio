import fs from 'fs';
import path from 'path';

let cachedPortfolioData = null;

const portfolioJsonPath = path.join(process.cwd(), 'public', 'data', 'portfolio.json');

export const readPortfolioData = () => {
  if (cachedPortfolioData) {
    return cachedPortfolioData;
  }

  const fileContents = fs.readFileSync(portfolioJsonPath, 'utf-8');
  cachedPortfolioData = JSON.parse(fileContents);
  return cachedPortfolioData;
};
