-- --------------------------------------------------------------------------
-- 005a_schema_only.sql — Ersatz fuer 005_mikra_config.sql auf der neos24-Instanz
--
-- WARUM DIESE DATEI EXISTIERT
-- 005_mikra_config.sql mischt zwei Dinge: Schema-Aenderungen, die JEDE Instanz
-- braucht (Spalte writer_guidance, 'ftp' im Protokoll-Enum), und Mikra-Webtec-
-- Mandantendaten (Projekt-Konfiguration, SleepCodex archivieren, Mikra-Pillars).
-- Auf einer frischen neos24-DB laufen die Datenteile ins Leere (alle greifen per
-- WHERE slug = 'mikra-webtec' bzw. 'sleepcodex'), sie sind also harmlos — aber
-- sie gehoeren nicht in eine fremde Instanz. Diese Datei zieht nur die DDL.
--
-- 006_mikra_domains.sql wird auf neos24 KOMPLETT uebersprungen. Es ist reine
-- Mandantendaten-Migration und legt drei aktive Mikra-Projekte an (.at/.ch/.com);
-- das WHERE NOT EXISTS schuetzt nur gegen Doppel-Anlage, nicht gegen die falsche
-- Instanz. Details siehe ../HANDOVER-REVIEW.md, Befund F2.
--
-- Idempotent: mehrfaches Einspielen ist unschaedlich.
-- --------------------------------------------------------------------------

-- 1. Spalte projects.writer_guidance (wird von worker/core/writer.py gelesen).
SET @col_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = 'projects'
       AND COLUMN_NAME  = 'writer_guidance'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE projects ADD COLUMN writer_guidance TEXT NULL AFTER schema_types',
    'SELECT "writer_guidance existiert bereits — uebersprungen" AS hinweis'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. 'ftp' als Deploy-Protokoll erlauben (reines Shared-Hosting ohne SSH).
--    MODIFY COLUMN ist von sich aus idempotent.
ALTER TABLE projects
    MODIFY COLUMN target_server_protocol
    ENUM('sftp','ftp','wp_rest','git','api') NULL DEFAULT 'sftp';

-- 3. Migrations-Ledger ehrlich halten: 005 als schema-only vermerken, 006 als
--    bewusst uebersprungen. Sonst versucht ein spaeterer Lauf, beide nachzuziehen.
INSERT INTO schema_migrations (version, note)
VALUES ('005', 'neos24: NUR Schema aus 005 (writer_guidance, ftp-Protokoll) — Mikra-Mandantendaten bewusst ausgelassen')
ON DUPLICATE KEY UPDATE applied_at = CURRENT_TIMESTAMP;

INSERT INTO schema_migrations (version, note)
VALUES ('006', 'neos24: BEWUSST UEBERSPRUNGEN — 006 legt Mikra-Webtec-Projekte (.at/.ch/.com) an, gehoert nicht in diese Instanz')
ON DUPLICATE KEY UPDATE applied_at = CURRENT_TIMESTAMP;

-- Ende von 005a_schema_only.sql
