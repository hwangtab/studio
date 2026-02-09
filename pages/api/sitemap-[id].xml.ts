import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;
    const filePath = path.join(process.cwd(), 'public', `sitemap-${id}.xml`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Sitemap not found');
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=43200');
    res.status(200).send(content);
  } catch {
    res.status(500).send('Internal server error');
  }
}
