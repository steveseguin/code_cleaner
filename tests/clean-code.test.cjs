const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// Override the page path to run the same checks against an earlier version.
const page = process.env.CODE_CLEANER_PAGE || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(page, 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];

function loadPage(input = '') {
  const elements = {
    codeInput: { value: input },
    cleanedCode: { value: '', style: {}, scrollHeight: 200 },
  };
  const context = vm.createContext({
    document: { getElementById: id => elements[id] },
  });
  for (const [, source] of scripts) new vm.Script(source).runInContext(context);
  return { context, elements };
}

test('the page script parses and exposes the button handler', () => {
  assert.ok(scripts.length > 0, 'the page must contain its inline script');
  assert.match(html, /onclick="removeComments\(\)"/);
  const { context } = loadPage();
  assert.equal(typeof context.removeComments, 'function');
});

test('the button handler removes single-line comments and blank lines', () => {
  const { context, elements } = loadPage('// heading\n\nlet value = 1; // explanation\n\n\nvalue += 2;\t\n');
  context.removeComments();
  assert.equal(elements.cleanedCode.value, 'let value = 1;\nvalue += 2;');
  assert.equal(elements.cleanedCode.style.height, '205px');
});

test('the button handler removes multiple multiline block comments', () => {
  const { context, elements } = loadPage('/* header\ncomment */\nconst value = 1; /* inline */\n/* footer\ncomment */');
  context.removeComments();
  assert.equal(elements.cleanedCode.value, 'const value = 1;');
});

test('quoted URLs and line-comment markers are retained', () => {
  const input = 'const url = "https://example.com/path"; // comment\nconst marker = \'// not a comment\';';
  const { context, elements } = loadPage(input);
  context.removeComments();
  assert.equal(elements.cleanedCode.value, 'const url = "https://example.com/path";\nconst marker = \'// not a comment\';');
});

test('repeated cleaning replaces the previous result, including empty input', () => {
  const { context, elements } = loadPage('let first = 1;');
  context.removeComments();
  assert.equal(elements.cleanedCode.value, 'let first = 1;');
  elements.codeInput.value = 'let second = 2; // latest';
  context.removeComments();
  assert.equal(elements.cleanedCode.value, 'let second = 2;');
  elements.codeInput.value = '';
  context.removeComments();
  assert.equal(elements.cleanedCode.value, '');
});
