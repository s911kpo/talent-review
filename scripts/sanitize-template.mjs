// Builds public/templates/template.xlsx from the private original. Files under public/ are
// downloadable by anyone with the URL, so author names and the embedded Power Query are removed.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import JSZip from 'jszip';

const SOURCE = 'docs/template/DSS_Talent_Assessment_Succession_tool_template.xlsx';
const TARGET = 'public/templates/template.xlsx';

const zip = await JSZip.loadAsync(readFileSync(SOURCE));

let core = await zip.file('docProps/core.xml').async('string');
core = core
  .replace(/<dc:creator>.*?<\/dc:creator>/s, '<dc:creator></dc:creator>')
  .replace(/<cp:lastModifiedBy>.*?<\/cp:lastModifiedBy>/s, '<cp:lastModifiedBy></cp:lastModifiedBy>');
zip.file('docProps/core.xml', core);

for (const name of Object.keys(zip.files)) {
  if (name.startsWith('customXml/') || name.startsWith('docMetadata/') || name.startsWith('xl/printerSettings/') || name.startsWith('xl/persons/')) {
    zip.remove(name);
  }
}

const strip = async (path, pattern) => {
  const file = zip.file(path);
  if (file) zip.file(path, (await file.async('string')).replace(pattern, ''));
};

const removedTarget = /<Relationship\b[^>]*Target="[^"]*(customXml|docMetadata|printerSettings|persons)[^"]*"[^>]*\/>/g;
for (const name of Object.keys(zip.files)) {
  if (name.endsWith('.rels')) await strip(name, removedTarget);
}
await strip('[Content_Types].xml', /<Override\b[^>]*PartName="\/(customXml|docMetadata|xl\/persons)[^"]*"[^>]*\/>/g);

// Worksheets point at printer settings by relationship id; drop the now-dangling references.
for (const name of Object.keys(zip.files)) {
  if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) await strip(name, /(?<=<pageSetup\b[^>]*?)\s+r:id="[^"]*"/g);
}

mkdirSync('public/templates', { recursive: true });
writeFileSync(TARGET, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log(`Wrote ${TARGET}`);
