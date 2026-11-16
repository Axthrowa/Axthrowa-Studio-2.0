import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { eskiVeritabaniniTasi } from './eski-dosya-adi.js';

describe('eski veritabanı dosya adı', () => {
  it('ana dosya ve WAL birlikte taşınır; yeni dosya varsa dokunulmaz', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-ad-'));
    fs.writeFileSync(path.join(d, 'streamaxt.sqlite'), 'ana');
    fs.writeFileSync(path.join(d, 'streamaxt.sqlite-wal'), 'wal');
    expect(eskiVeritabaniniTasi(d)).toBe(true);
    expect(fs.readFileSync(path.join(d, 'axbot.sqlite'), 'utf8')).toBe('ana');
    expect(fs.readFileSync(path.join(d, 'axbot.sqlite-wal'), 'utf8')).toBe('wal');
    expect(fs.existsSync(path.join(d, 'streamaxt.sqlite'))).toBe(false);
    fs.writeFileSync(path.join(d, 'streamaxt.sqlite'), 'baska');
    expect(eskiVeritabaniniTasi(d)).toBe(false);
    expect(fs.readFileSync(path.join(d, 'axbot.sqlite'), 'utf8')).toBe('ana');
    fs.rmSync(d, { recursive: true, force: true });
  });
});
