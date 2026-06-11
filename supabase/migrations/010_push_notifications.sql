-- ── Push Notifications: pg_net + Vault config + trigger ──────────────────
--
-- NOTE: The actual VAPID keys and webhook secret are seeded into
-- Supabase Vault separately (not in this file) to avoid committing
-- credentials to the repo. They are stored under the names:
--   vapid_public_key, vapid_private_key, vapid_subject, push_webhook_secret

create extension if not exists pg_net;

-- RPC used by the send-push edge function (service_role only) to read the
-- vault secrets above without exposing the vault schema over PostgREST.
create or replace function public.get_push_config()
returns table (
  vapid_public_key  text,
  vapid_private_key text,
  vapid_subject     text,
  webhook_secret    text
)
language sql
security definer
set search_path = public, vault
as $$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public_key'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private_key'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_subject'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'push_webhook_secret')
$$;

revoke execute on function public.get_push_config() from public;
grant execute on function public.get_push_config() to service_role;

-- Trigger: fire-and-forget HTTP call to the send-push edge function whenever
-- a notification row is inserted, so subscribed devices get a Web Push.
create or replace function notify_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret';

  perform net.http_post(
    url     := 'https://wklzocvqbwxdgbjwgvkv.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body    := jsonb_build_object(
      'user_id', new.user_id,
      'type',    new.type,
      'title',   new.title,
      'body',    new.body,
      'data',    new.data
    )
  );
  return new;
end;
$$;

create trigger notifications_send_push
  after insert on notifications
  for each row execute function notify_push();
