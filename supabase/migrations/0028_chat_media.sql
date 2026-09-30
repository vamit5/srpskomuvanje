-- Obicne fotografije/video snimci u chatu (ne Nocno muvanje -- to ostaje
-- odvojeno, sa zamucenim/placenim otkljucavanjem). Ovo je obican prilog uz
-- poruku, kao u svakoj drugoj chat aplikaciji -- prolazi kroz ISTU NSFW
-- proveru (Sightengine) kao profilne slike PRE nego sto postane vidljivo
-- drugoj strani (vidi sendMediaMessage u poruke/actions.ts).
alter table messages
  add column media_kind text check (media_kind in ('photo', 'video')),
  add column moderation_status text not null default 'approved'
    check (moderation_status in ('approved', 'pending', 'rejected'));

-- Admin mora da moze da odobri/odbije "pending" chat-media poruke iz
-- /admin/sadrzaj (isti obrazac kao profile_photos/profile_videos) --
-- postojeca UPDATE politika na messages pokriva samo ucesnike u matchu.
create policy "admin menja moderaciju poruka"
  on messages for update
  using (is_admin());
