import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('Dataset dashboard pages', () => {
  it('keeps the editor persistent composition to Header plus DatasetTable', () => {
    const editor = source('./Editor.vue');
    expect(editor).toContain('<PanelDatasetEditorHeader');
    expect(editor).toContain('<DatasetTable');
    expect(editor).not.toContain('<UCard');
    expect(editor.indexOf('<PanelDatasetEditorHeader')).toBeLessThan(editor.indexOf('<DatasetTable'));
  });

  it('removes Form source/publish semantics and keeps mobile actions labeled', () => {
    const header = source('./EditorHeader.vue');
    expect(header).toContain('编辑信息');
    expect(header).toContain('归档数据表');
    expect(header).toContain('更多数据表操作');
    expect(header).not.toContain('源码');
    expect(header).not.toContain('发布');
  });

  it('represents list loading, retry, empty, creation error and archive conflict states', () => {
    const list = source('./List.vue');
    expect(list).toContain("state === 'loading'");
    expect(list).toContain("state === 'error'");
    expect(list).toContain('data.items.length === 0');
    expect(list).toContain('createError');
    expect(list).toContain('apiError.httpStatus === 409');
    expect(list).toContain('getDatasetEditorPath(dataset.id)');
  });

  it('keeps row and field dialogs accessible and revision submission in the adapter', () => {
    const rowDialog = source('./RowDialog.vue');
    const fieldDialog = source('./FieldDialog.vue');
    const adapter = source('../../../composables/useDatasetEditor.ts');
    expect(rowDialog).toContain('id="dataset-row-form"');
    expect(fieldDialog).toContain('id="dataset-field-form"');
    expect(fieldDialog).toContain(':disabled="editing"');
    expect(adapter).toContain('expectedDatasetRevision');
    expect(adapter).toContain('expectedFieldRevision');
  });
});
