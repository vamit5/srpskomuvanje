-- FAZA 4: Real-time chat.
-- Pokreni u Supabase SQL Editoru.
--
-- Uključuje "messages" tabelu u Supabase Realtime, da poruke stižu uživo
-- (bez ručnog refresh-ovanja) i obema stranama u razgovoru.

alter publication supabase_realtime add table messages;

-- REPLICA IDENTITY FULL osigurava da UPDATE eventi (npr. kad neko
-- pročita poruku) nose kompletan red, ne samo primarni ključ.
alter table messages replica identity full;
