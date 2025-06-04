const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const storiesDir = path.join(__dirname, '../content/stories');
const outputFile = path.join(__dirname, '../public/data/stories.json');

const generateStories = () => {
  const files = fs.readdirSync(storiesDir);
  const stories = files
    .filter(file => file.endsWith('.md'))
    .map(file => {
      const content = fs.readFileSync(path.join(storiesDir, file), 'utf8');
      const { data, content: body } = matter(content);
      return {
        id: path.parse(file).name,
        ...data,
        content: body
      };
    });
  fs.writeFileSync(outputFile, JSON.stringify(stories, null, 2));
  console.log(`Generated ${stories.length} stories to ${outputFile}`);
};

generateStories();