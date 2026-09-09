-- is_test_account -- oznacava naloge koje je ADMIN sam napravio isključivo
-- za interno testiranje (npr. test1@gmail.com, test2@gmail.com...).
-- Jedina svrha ove kolone: bezbednosna ograda za "Piši u ime korisnika" u
-- /admin/poruke -- ta funkcija sme da upisuje poruke u ime nekog naloga
-- SAMO kad su OBE strane razgovora oznacene kao test nalozi. Nikad ne sme
-- da radi kad je bilo koja strana stvaran, samostalno registrovan korisnik
-- -- to bi bilo laziranje pred pravim ljudima. Podrazumevano false za sve,
-- admin ga rucno postavlja po nalogu na /admin/users/novi ili /admin/users/[id].
alter table profiles add column if not exists is_test_account boolean not null default false;
