-- Widget meta: layout / percent / şema sürümü
-- sqlx migrasyonları bir kez çalışır; SQLite ADD COLUMN bu yüzden güvenli.
PRAGMA foreign_keys = ON;

ALTER TABLE goals ADD COLUMN layout TEXT NOT NULL DEFAULT 'bar';
ALTER TABLE goals ADD COLUMN show_percent INTEGER NOT NULL DEFAULT 1;
ALTER TABLE goals ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE widget_instances ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE widget_instances ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
