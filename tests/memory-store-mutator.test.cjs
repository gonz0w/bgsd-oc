const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { createTempProject, cleanup } = require('./helpers.cjs');
const { mutateJsonStore } = require('../src/lib/json-store-mutator');

describe('json-store mutator', () => {
  test('appends repeated entries without dropping earlier writes', () => {
    const tmpDir = createTempProject();
    try {
      const filePath = path.join(tmpDir, '.planning', 'memory', 'lessons.json');

      mutateJsonStore(tmpDir, {
        filePath,
        defaultValue: [],
        transform(entries) {
          entries.push({ id: 'one' });
          return { nextData: entries, result: { entryCount: entries.length } };
        },
      });

      const second = mutateJsonStore(tmpDir, {
        filePath,
        defaultValue: [],
        transform(entries) {
          entries.push({ id: 'two' });
          return { nextData: entries, result: { entryCount: entries.length } };
        },
      });

      assert.strictEqual(second.entryCount, 2);
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(filePath, 'utf-8')), [{ id: 'one' }, { id: 'two' }]);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('publishes updated JSON before running sqlite mirror work', () => {
    const tmpDir = createTempProject();
    try {
      const filePath = path.join(tmpDir, '.planning', 'memory', 'bookmarks.json');
      const seen = [];

      mutateJsonStore(tmpDir, {
        filePath,
        defaultValue: [],
        transform(entries) {
          entries.unshift({ id: 'bookmark-1' });
          return { nextData: entries };
        },
        sqliteMirror() {
          seen.push(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
        },
      });

      assert.deepStrictEqual(seen, [[{ id: 'bookmark-1' }]]);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('rolls back published JSON when sqlite mirror work fails', () => {
    const tmpDir = createTempProject();
    try {
      const filePath = path.join(tmpDir, '.planning', 'memory', 'trajectory.json');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify([{ id: 'baseline' }], null, 2));

      assert.throws(() => {
        mutateJsonStore(tmpDir, {
          filePath,
          defaultValue: [],
          transform(entries) {
            entries.push({ id: 'new-entry' });
            return { nextData: entries };
          },
          sqliteMirror() {
            throw new Error('sqlite unavailable');
          },
        });
      }, /sqlite unavailable/);

      assert.deepStrictEqual(JSON.parse(fs.readFileSync(filePath, 'utf-8')), [{ id: 'baseline' }]);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('supports object-backed stores through the same locked contract', () => {
    const tmpDir = createTempProject();
    try {
      const filePath = path.join(tmpDir, '.planning', 'phase-handoffs', '163', 'execute.json');

      const result = mutateJsonStore(tmpDir, {
        filePath,
        defaultValue: {},
        transform(current) {
          return {
            nextData: {
              ...current,
              phase: '163',
              step: 'execute',
              summary: 'plan complete',
            },
            result: { written: true },
          };
        },
      });

      assert.strictEqual(result.written, true);
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(filePath, 'utf-8')), {
        phase: '163',
        step: 'execute',
        summary: 'plan complete',
      });
    } finally {
      cleanup(tmpDir);
    }
  });
});
