-- Remove chat persistence artifacts
DROP TABLE IF EXISTS "ChatMessage";
DROP TABLE IF EXISTS "ChatSession";
DROP TYPE IF EXISTS "ChatRole";
