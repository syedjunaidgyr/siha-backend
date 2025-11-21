-- Check what migrations are recorded as run
SELECT * FROM "SequelizeMeta" ORDER BY name;

-- Check what tables actually exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- To reset migration state (run this if tables don't match migrations):
-- DELETE FROM "SequelizeMeta";

