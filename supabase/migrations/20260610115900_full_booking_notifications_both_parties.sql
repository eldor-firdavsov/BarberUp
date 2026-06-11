-- =============================================================================
-- NAVBATGO — FULL BOOKING NOTIFICATIONS (BOTH PARTIES)
-- Every booking status change → Telegram message to BOTH barber AND client.
--
-- Notification matrix:
--   pending   INSERT  → CLIENT: "booking sent"              + BARBER: "new booking" (Accept/Reject btns)
--   accepted  UPDATE  → CLIENT: "confirmed ✅"              + BARBER: "you accepted {client}"
--   rejected  UPDATE  → CLIENT: "rejected ❌"              + BARBER: "you rejected {client}"
--   cancelled UPDATE  → CLIENT: "cancelled (who did it)"   + BARBER: "booking cancelled (who did it)"
--   completed UPDATE  → CLIENT: "done, leave a review 🎉"  + BARBER: "session complete for {client}"
--
-- Safe to re-run. Paste the entire file into the Supabase SQL Editor.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

-- =============================================================================
-- 1. notify_telegram — unchanged helper (fire-and-forget HTTP POST)
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
    body := p_payload
  ) INTO v_request_id;
  RAISE LOG '[notify_telegram] dispatched request_id=%', v_request_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_telegram] failed: %', SQLERRM;
END;
$$;

-- =============================================================================
-- 2. set_booking_status — called by the Telegram webhook (Accept / Reject btns)
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
-- 3. handle_booking_status_change — FULL REWRITE
--    Sends to BOTH barber AND client for every status transition.
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
  v_status          text;
  v_client_text     text;
  v_barber_text     text;
  v_cancelled_by    text;
  v_latitude        numeric;
  v_longitude       numeric;
BEGIN
  -- Skip no-op UPDATEs
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_status      := NEW.status;
  v_cancelled_by := COALESCE(NEW.cancelled_by, 'system');

  -- ── Resolve client identity ───────────────────────────────────────────────
  v_client_phone := NEW.guest_phone;
  v_client_name  := NEW.guest_name;

  IF v_client_phone IS NULL AND NEW.client_id IS NOT NULL THEN
    SELECT phone INTO v_client_phone
    FROM public.clients WHERE id = NEW.client_id LIMIT 1;
  END IF;

  IF v_client_name IS NULL OR v_client_name = '' THEN
    IF NEW.client_id IS NOT NULL THEN
      SELECT COALESCE(fullname, phone, 'Mijoz') INTO v_client_name
      FROM public.clients WHERE id = NEW.client_id LIMIT 1;
    END IF;
    IF v_client_name IS NULL OR v_client_name = '' THEN
      v_client_name := 'Mijoz';
    END IF;
  END IF;

  -- ── Resolve barber identity ───────────────────────────────────────────────
  SELECT
    COALESCE(b.office_name, ''),
    COALESCE(b.fullname, ''),
    COALESCE(b.phone, ''),
    COALESCE(b.address, ''),
    (b.location->'coordinates'->>1)::numeric,
    (b.location->'coordinates'->>0)::numeric
  INTO v_barber_office, v_barber_fullname, v_barber_phone, v_barber_address, v_latitude, v_longitude
  FROM public.barbers b WHERE b.id = NEW.barber_id LIMIT 1;

  -- Helper: barber display name
  -- (use office_name if set, otherwise fullname)
  -- Helper: booking time label
  -- "2026-06-15 — 14:00"

  -- =========================================================================
  -- STATUS: pending  (always INSERT, but also guard for edge UPDATE)
  -- CLIENT  → booking sent, awaiting confirmation
  -- BARBER  → new booking alert with Accept / Reject inline keyboard
  -- =========================================================================
  IF v_status = 'pending' THEN

    -- ── CLIENT ──
    v_client_text := format(
      E'🕒 <b>Broningiz yuborildi!</b>\n\n'
      'Sartaroshxona: <b>%s</b>\n'
      '✂️ %s\n'
      '🕐 %s — %s\n\n'
      'Sartarosh tasdiqlashini kuting. Javob Telegramga keladi.',
      COALESCE(v_barber_office, v_barber_fullname, '—'),
      COALESCE(NEW.service_name, 'Xizmat'),
      COALESCE(NEW.booking_date::text, ''),
      COALESCE(NEW.booking_hours, '')
    );

    IF v_client_phone IS NOT NULL THEN
      PERFORM public.notify_telegram(
        jsonb_strip_nulls(
          jsonb_build_object(
            'target', 'client',
            'phone',  v_client_phone,
            'text',   v_client_text,
            'latitude', v_latitude,
            'longitude', v_longitude,
            'venue_title', COALESCE(NULLIF(v_barber_office, ''), v_barber_fullname),
            'venue_address', COALESCE(NULLIF(v_barber_address, ''), 'Joylashuv xaritada ko''rsatilgan')
          )
        )
      );
    END IF;

    -- ── BARBER ──
    v_barber_text := format(
      E'📅 <b>Yangi navbat!</b>\n\n'
      '👤 %s\n'
      '%s'
      '✂️ %s\n'
      '🕐 %s — %s\n\n'
      'Qabul yoki rad etish uchun tugmani bosing:',
      v_client_name,
      CASE WHEN v_client_phone IS NOT NULL
           THEN format(E'📞 %s\n', v_client_phone)
           ELSE ''
      END,
      COALESCE(NEW.service_name, 'Xizmat'),
      COALESCE(NEW.booking_date::text, ''),
      COALESCE(NEW.booking_hours, '')
    );

    PERFORM public.notify_telegram(jsonb_build_object(
      'target',       'barber',
      'barber_id',    NEW.barber_id,
      'phone',        v_barber_phone,
      'text',         v_barber_text,
      'booking_id',   NEW.id::text,
      'reply_markup', jsonb_build_object(
        'inline_keyboard', jsonb_build_array(jsonb_build_array(
          jsonb_build_object('text', '✅ Qabul qilish', 'callback_data', format('accept:%s', NEW.id::text)),
          jsonb_build_object('text', '❌ Rad etish',    'callback_data', format('reject:%s', NEW.id::text))
        ))
      )
    ));

  -- =========================================================================
  -- STATUS: accepted
  -- CLIENT  → booking confirmed ✅
  -- BARBER  → you accepted {client}'s booking
  -- =========================================================================
  ELSIF v_status = 'accepted' THEN

    -- ── CLIENT ──
    v_client_text := format(
      E'✅ <b>Broningiz tasdiqlandi!</b>\n\n'
      'Sartaroshxona: <b>%s</b>\n'
      '✂️ %s\n'
      '🕐 %s — %s\n'
      '%s'
      'Ko''rishguncha! 👋',
      COALESCE(v_barber_office, v_barber_fullname, '—'),
      COALESCE(NEW.service_name, 'Xizmat'),
      COALESCE(NEW.booking_date::text, ''),
      COALESCE(NEW.booking_hours, ''),
      CASE WHEN v_barber_address <> ''
           THEN format(E'📍 Manzil: %s\n', v_barber_address)
           ELSE ''
      END
    );

    IF v_client_phone IS NOT NULL THEN
      PERFORM public.notify_telegram(jsonb_build_object(
        'target', 'client',
        'phone',  v_client_phone,
        'text',   v_client_text
      ));
    END IF;

    -- ── BARBER ──
    v_barber_text := format(
      E'✅ <b>Siz navbatni qabul qildingiz</b>\n\n'
      '👤 %s\n'
      '%s'
      '✂️ %s\n'
      '🕐 %s — %s\n\n'
      'Mijoz xabardor qilindi.',
      v_client_name,
      CASE WHEN v_client_phone IS NOT NULL
           THEN format(E'📞 %s\n', v_client_phone)
           ELSE ''
      END,
      COALESCE(NEW.service_name, 'Xizmat'),
      COALESCE(NEW.booking_date::text, ''),
      COALESCE(NEW.booking_hours, '')
    );

    PERFORM public.notify_telegram(jsonb_build_object(
      'target',    'barber',
      'barber_id', NEW.barber_id,
      'phone',     v_barber_phone,
      'text',      v_barber_text
    ));

  -- =========================================================================
  -- STATUS: rejected
  -- CLIENT  → booking rejected ❌, try another time
  -- BARBER  → you rejected {client}'s booking
  -- =========================================================================
  ELSIF v_status = 'rejected' THEN

    -- ── CLIENT ──
    v_client_text := format(
      E'❌ <b>Broningiz rad etildi.</b>\n\n'
      'Sartaroshxona: <b>%s</b>\n'
      '✂️ %s\n'
      '🕐 %s — %s\n\n'
      'Boshqa vaqtni tanlab qayta urinib ko''ring.',
      COALESCE(v_barber_office, v_barber_fullname, '—'),
      COALESCE(NEW.service_name, 'Xizmat'),
      COALESCE(NEW.booking_date::text, ''),
      COALESCE(NEW.booking_hours, '')
    );

    IF v_client_phone IS NOT NULL THEN
      PERFORM public.notify_telegram(jsonb_build_object(
        'target', 'client',
        'phone',  v_client_phone,
        'text',   v_client_text
      ));
    END IF;

    -- ── BARBER ──
    v_barber_text := format(
      E'❌ <b>Siz navbatni rad etdingiz</b>\n\n'
      '👤 %s\n'
      '✂️ %s\n'
      '🕐 %s — %s\n\n'
      'Mijoz xabardor qilindi.',
      v_client_name,
      COALESCE(NEW.service_name, 'Xizmat'),
      COALESCE(NEW.booking_date::text, ''),
      COALESCE(NEW.booking_hours, '')
    );

    PERFORM public.notify_telegram(jsonb_build_object(
      'target',    'barber',
      'barber_id', NEW.barber_id,
      'phone',     v_barber_phone,
      'text',      v_barber_text
    ));

  -- =========================================================================
  -- STATUS: cancelled
  -- CLIENT  → booking cancelled (note who cancelled)
  -- BARBER  → booking cancelled (note who cancelled)
  -- =========================================================================
  ELSIF v_status = 'cancelled' THEN

    -- ── CLIENT ──
    v_client_text := format(
      E'🚫 <b>Bron bekor qilindi.</b>\n\n'
      'Sartaroshxona: <b>%s</b>\n'
      '✂️ %s\n'
      '🕐 %s — %s\n\n'
      'Bekor qildi: <b>%s</b>',
      COALESCE(v_barber_office, v_barber_fullname, '—'),
      COALESCE(NEW.service_name, 'Xizmat'),
      COALESCE(NEW.booking_date::text, ''),
      COALESCE(NEW.booking_hours, ''),
      CASE v_cancelled_by
        WHEN 'barber' THEN 'Sartarosh'
        WHEN 'client' THEN 'Siz (mijoz)'
        ELSE 'Tizim'
      END
    );

    IF v_client_phone IS NOT NULL THEN
      PERFORM public.notify_telegram(jsonb_build_object(
        'target', 'client',
        'phone',  v_client_phone,
        'text',   v_client_text
      ));
    END IF;

    -- ── BARBER ──
    v_barber_text := format(
      E'🚫 <b>Bron bekor qilindi</b>\n\n'
      '👤 %s\n'
      '%s'
      '✂️ %s\n'
      '🕐 %s — %s\n\n'
      'Bekor qildi: <b>%s</b>',
      v_client_name,
      CASE WHEN v_client_phone IS NOT NULL
           THEN format(E'📞 %s\n', v_client_phone)
           ELSE ''
      END,
      COALESCE(NEW.service_name, 'Xizmat'),
      COALESCE(NEW.booking_date::text, ''),
      COALESCE(NEW.booking_hours, ''),
      CASE v_cancelled_by
        WHEN 'client' THEN 'Mijoz'
        WHEN 'barber' THEN 'Siz (sartarosh)'
        ELSE 'Tizim'
      END
    );

    PERFORM public.notify_telegram(jsonb_build_object(
      'target',    'barber',
      'barber_id', NEW.barber_id,
      'phone',     v_barber_phone,
      'text',      v_barber_text
    ));

  -- =========================================================================
  -- STATUS: completed
  -- CLIENT  → service done, please leave a review 🎉
  -- BARBER  → session complete for {client}
  -- =========================================================================
  ELSIF v_status = 'completed' THEN

    -- ── CLIENT ──
    v_client_text := format(
      E'🎉 <b>Xizmat yakunlandi!</b>\n\n'
      'Sartaroshxona: <b>%s</b>\n'
      '✂️ %s\n'
      '🕐 %s — %s\n\n'
      'Yana kutamiz! Iltimos, baho va izoh qoldirishni unutmang. ⭐',
      COALESCE(v_barber_office, v_barber_fullname, '—'),
      COALESCE(NEW.service_name, 'Xizmat'),
      COALESCE(NEW.booking_date::text, ''),
      COALESCE(NEW.booking_hours, '')
    );

    IF v_client_phone IS NOT NULL THEN
      PERFORM public.notify_telegram(jsonb_build_object(
        'target', 'client',
        'phone',  v_client_phone,
        'text',   v_client_text
      ));
    END IF;

    -- ── BARBER ──
    v_barber_text := format(
      E'🎉 <b>Xizmat yakunlandi</b>\n\n'
      '👤 %s\n'
      '✂️ %s\n'
      '🕐 %s — %s\n\n'
      'Mijoz reyting qoldirishga taklif qilindi.',
      v_client_name,
      COALESCE(NEW.service_name, 'Xizmat'),
      COALESCE(NEW.booking_date::text, ''),
      COALESCE(NEW.booking_hours, '')
    );

    PERFORM public.notify_telegram(jsonb_build_object(
      'target',    'barber',
      'barber_id', NEW.barber_id,
      'phone',     v_barber_phone,
      'text',      v_barber_text
    ));

  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 4. Re-attach trigger (idempotent)
-- =============================================================================
DROP TRIGGER IF EXISTS trg_booking_status_change ON public.bookings;
CREATE TRIGGER trg_booking_status_change
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_booking_status_change();
