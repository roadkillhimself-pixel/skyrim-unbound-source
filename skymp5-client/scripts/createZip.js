const fs = require('fs');
const path = require('path');
const yazl = require('yazl');

const [, , outputPath, ...inputs] = process.argv;

if (!outputPath || inputs.length === 0) {
  console.error('Usage: node scripts/createZip.js <output.zip> <input...>');
  process.exit(1);
}

const zipfile = new yazl.ZipFile();
let matchedFiles = 0;

const toZipPath = (value) => value.split(path.sep).join('/');

const addFile = (relativePath) => {
  const absolutePath = path.resolve(relativePath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    return;
  }

  matchedFiles += 1;
  zipfile.addFile(absolutePath, toZipPath(relativePath));
};

const addPattern = (pattern) => {
  if (!pattern.includes('*')) {
    addFile(pattern);
    return;
  }

  const baseDir = path.dirname(pattern);
  const absoluteBaseDir = path.resolve(baseDir);

  if (!fs.existsSync(absoluteBaseDir) || !fs.statSync(absoluteBaseDir).isDirectory()) {
    return;
  }

  const wildcard = path.basename(pattern);
  const matcher = new RegExp(
    `^${wildcard.replace(/[|\\{}()[\]^$+?.]/g, '\\$&').replace(/\*/g, '.*')}$`,
  );

  for (const entry of fs.readdirSync(absoluteBaseDir, { withFileTypes: true })) {
    if (entry.isFile() && matcher.test(entry.name)) {
      addFile(path.join(baseDir, entry.name));
    }
  }
};

for (const input of inputs) {
  addPattern(input);
}

if (matchedFiles === 0) {
  console.error('No input files matched for zip creation');
  process.exit(1);
}

const outputAbsolutePath = path.resolve(outputPath);
fs.mkdirSync(path.dirname(outputAbsolutePath), { recursive: true });

zipfile.end();
zipfile.outputStream
  .pipe(fs.createWriteStream(outputAbsolutePath))
  .on('close', () => {
    console.log(`Created ${outputPath}`);
  });
