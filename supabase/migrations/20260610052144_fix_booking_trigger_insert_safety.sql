-- =============================================================================
-- NAVBATGO — BOOKING TRIGGER + TELEGRAM NOTIFICATION FIX
-- Safe to re-run. Paste the entire file into the Supabase SQL Editor.
-- =============================================================================

-- 1. Ensure pg_net is available for async HTTP calls from the DB trigger
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =============================================================================
-- 2. notify_telegram — fire-and-forget HTTP POST to the telegram-notify edge fn
-- =============================================================================
CREATE OR REPLACE FUNCTION public.notify_telegram(p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_url        text := 'https://brvlvempavfiqyjbomjz.supabase.co/functions/v1/telegram-notify';
  v_anon_key   text := 'sb_publishable_Htd1CQw0mzwW6eWFR8yBUg_RlphBIXG';
  v_request_id bigint;
BEGIN
  SELECT net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key,
      'apikey', v_anon_key
    ),
    body := p_payload::text
  ) INTO v_request_id;
  RAISE LOG '[notify_telegram] dispatched request_id=%', v_request_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_telegram] failed: %', SQLERRM;
END;
$$;

-- =============================================================================
-- 3. set_booking_status — called by the Telegram webhook when the barber
--    taps ✅ Accept or ❌ Reject on the inline keyboard.
--    Returns booking details so the webhook can update the Telegram message.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_booking_status(
  p_booking_id uuid,
  p_new_status text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row     bookings%ROWTYPE;
  v_client  text;
  v_service text;
  v_at      text;
BEGIN
  -- Validate status
  IF p_new_status NOT IN ('accepted', 'rejected', 'cancelled', 'completed') THEN
    RAISE EXCEPTION 'Invalid status: %', p_new_status;
  END IF;

  UPDATE public.bookings
    SET status = p_new_status
  WHERE id = p_booking_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id;
  END IF;

  -- Resolve client display name
  IF v_row.guest_name IS NOT NULL AND v_row.guest_name <> '' THEN
    v_client := v_row.guest_name;
  ELSIF v_row.client_id IS NOT NULL THEN
    SELECT COALESCE(fullname, phone, 'Mijoz') INTO v_client
    FROM public.clients WHERE id = v_row.client_id LIMIT 1;
  ELSE
    v_client := 'Mijoz';
  END IF;

  v_service := COALESCE(v_row.service_name, 'Xizmat');
  v_at      := COALESCE(v_row.booking_date::text, '') || ' ' || COALESCE(v_row.booking_hours, '');

  RETURN jsonb_build_object(
    'new_status',   p_new_status,
    'client_name',  v_client,
    'service',      v_service,
    'booking_at',   v_at
  );
END;
$$;

-- =============================================================================
-- 4. handle_booking_status_change — DB trigger function
--    Sends Telegram messages on booking INSERT and status UPDATE.
--    FIXED: no longer references OLD.telegram_messages (column doesn't exist).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_booking_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client_phone    text;
  v_client_name     text;
  v_barber_office   text;
  v_barber_fullname text;
  v_barber_phone    text;
  v_barber_address  text;
  v_text            text;
  v_status          text;
BEGIN
  -- Skip no-op UPDATE rows (status didn't change)
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_status := NEW.status;

  -- Resolve client info
  v_client_phone := NEW.guest_phone;
  v_client_name  := NEW.guest_name;
  IF v_client_phone IS NULL AND NEW.client_id IS NOT NULL THEN
    SELECT phone INTO v_client_phone
    FROM public.clients WHERE id = NEW.client_id LIMIT 1;
  END IF;
  IF v_client_name IS NULL OR v_client_name = '' THEN
    IF NEW.client_id IS NOT NULL THEN
      SELECT COALESCE(fullname, '') INTO v_client_name
      FROM public.clients WHERE id = NEW.client_id LIMIT 1;
    END IF;
    IF v_client_name IS NULL OR v_client_name = '' THEN
      v_client_name := 'Mijoz';
    END IF;
  END IF;

  -- Resolve barber info
  SELECT
    COALESCE(b.office_name, ''),
    COALESCE(b.fullname, ''),
    COALESCE(b.phone, ''),
    COALESCE(b.address, '')
  INTO v_barber_office, v_barber_fullname, v_barber_phone, v_barber_address
  FROM public.barbers b WHERE b.id = NEW.barber_id LIMIT 1;

  -- ── CLIENT NOTIFICATIONS ─────────────────────────────────────────────────

  IF v_status = 'pending' AND (
    TG_OP = 'INSERT'
    OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'pending')
  ) THEN
    v_text := format(
      E'🕒 <b>Broningiz yuborildi!</b>\n\nSartaroshxona: <b>%s</b>\n✂️ %s\n🕐 %s — %s\n\nTasdiqlash javobini Telegramga yuboramiz.',
      COALESCE(v_barber_office, v_barber_fullname, '—'),
      COALESCE(NEW.service_name, 'Xizmat'),
      COALESCE(NEW.booking_date::text, ''),
      COALESCE(NEW.booking_hours, '')
    );
    PERFORM public.notify_telegram(jsonb_build_object(
      'target', 'client', 'phone', v_client_phone, 'text', v_text
    ));

  ELSIF v_status = 'accepted' THEN
    v_text := format(
      E'✅ <b>Broningiz tasdiqlandi!</b>\n\nSartaroshxona: <b>%s</b>\n✂️ %s\n🕐 %s — %s\n%s\nKo''rishguncha! 👋',
      COALESCE(v_barber_office, v_barber_fullname, '—'),
      COALESCE(NEW.service_name, 'Xizmat'),
      COALESCE(NEW.booking_date::text, ''),
      COALESCE(NEW.booking_hours, ''),
      CASE WHEN v_barber_address <> '' THEN format(E'📍 Manzil: %s\n', v_barber_address) ELSE '' END
    );
    PERFORM public.notify_telegram(jsonb_build_object(
      'target', 'client', 'phone', v_client_phone, 'text', v_text
    ));

  ELSIF v_status = 'rejected' THEN
    v_text := format(
      E'❌ <b>Broningiz rad etildi.</b>\n\nSartaroshxona: <b>%s</b>\n✂️ %s\n🕐 %s — %s\n\nBoshqa vaqtga urinib ko''ring.',
      COALESCE(v_barber_office, v_barber_fullname, '—'),
      COALESCE(NEW.service_name, 'Xizmat'),
      COALESCE(NEW.booking_date::text, ''),
      COALESCE(NEW.booking_hours, '')
    );
    PERFORM public.notify_telegram(jsonb_build_object(
      'target', 'client', 'phone', v_client_phone, 'text', v_text
    ));

  ELSIF v_status = 'cancelled' THEN
    v_text := format(
      E'🚫 <b>Bron bekor qilindi.</b>\n\nSartaroshxona: <b>%s</b>\n✂️ %s\n🕐 %s — %s\n\nKim bekor qildi: %s',
      COALESCE(v_barber_office, v_barber_fullname, '—'),
      COALESCE(NEW.service_name, 'Xizmat'),
      COALESCE(NEW.booking_date::text, ''),
      COALESCE(NEW.booking_hours, ''),
      CASE WHEN NEW.cancelled_by = 'barber' THEN 'Sartarosh' ELSE 'Mijoz' END
    );
    PERFORM public.notify_telegram(jsonb_build_object(
      'target', 'client', 'phone', v_client_phone, 'text', v_text
    ));
  END IF;

  -- ── BARBER NOTIFICATION (new booking only) ────────────────────────────────

  IF TG_OP = 'INSERT' AND v_status = 'pending' THEN
    v_text := format(
      E'📅 <b>Yangi navbat!</b>\n\n👤 %s\n%s✂️ %s\n🕐 %s — %s\n\nQabul yoki rad etish uchun tugmani bosing:',
      v_client_name,
      CASE WHEN v_client_phone IS NOT NULL THEN format(E'📞 %s\n', v_client_phone) ELSE '' END,
      COALESCE(NEW.service_name, 'Xizmat'),
      COALESCE(NEW.booking_date::text, ''),
      COALESCE(NEW.booking_hours, '')
    );
    PERFORM public.notify_telegram(jsonb_build_object(
      'target',     'barber',
      'barber_id',  NEW.barber_id,
      'phone',      v_barber_phone,
      'text',       v_text,
      'booking_id', NEW.id::text,
      'reply_markup', jsonb_build_object(
        'inline_keyboard', jsonb_build_array(jsonb_build_array(
          jsonb_build_object('text', '✅ Qabul qilish', 'callback_data', format('accept:%s', NEW.id::text)),
          jsonb_build_object('text', '❌ Rad etish',    'callback_data', format('reject:%s', NEW.id::text))
        ))
      )
    ));
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 5. Re-attach trigger (idempotent)
-- =============================================================================
DROP TRIGGER IF EXISTS trg_booking_status_change ON public.bookings;
CREATE TRIGGER trg_booking_status_change
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_booking_status_change();
