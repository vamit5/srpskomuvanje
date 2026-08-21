-- FAZA 2: dodaje kolone za storage putanje (potrebne da bismo mogli da
-- pobrišemo fajlove iz Storage-a kad korisnik obriše fotografiju/video,
-- a ne samo red u bazi).
--
-- Pokreni u Supabase SQL Editoru (jednom, na projektu koji već ima schema.sql).
-- Ako tek sad praviš projekat od nule, ovo je već uključeno u schema.sql
-- i ovaj fajl ti ne treba.

alter table profile_photos add column if not exists storage_path text;
alter table profile_photos add column if not exists thumbnail_path text;

alter table profile_videos add column if not exists storage_path text;
alter table profile_videos add column if not exists thumbnail_path text;
