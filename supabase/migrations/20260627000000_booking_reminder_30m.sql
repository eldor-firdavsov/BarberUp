-- =============================================================================
-- NAVBATGO — 30-minute booking reminder via Telegram
-- Sends reminder to client + barber when accepted booking starts in ~30 minutes.
-- Runs every 5 minutes via pg_cron (enable pg_cron in Supabase Dashboard if needed).
-- =============================================================================

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS reminder_30m_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS bookings_reminder_30m_pending_idx
    ON public.bookings (booking_date, booking_hours)
    WHERE status = 'accepted' AND reminder_30m_sent_at IS NULL;

-- =============================================================================
-- send_booking_reminders_30m
-- =============================================================================
CREATE OR REPLACE FUNCTION public.send_booking_reminders_30m()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r              RECORD;
  v_appt         timestamptz;
  v_mins_until   double precision;
  v_client_text  text;
  v_barber_text  text;
  v_client_name  text;
  v_client_phone text;
  v_sent_count   integer := 0;
BEGIN
  FOR r IN
    SELECT
      b.*,
      bar.office_name,
      bar.fullname  AS barber_fullname,
      bar.phone     AS barber_phone,
      bar.address   AS barber_address
    FROM public.bookings b
    INNER JOIN public.barbers bar ON bar.id = b.barber_id
    WHERE b.status = 'accepted'
      AND b.reminder_30m_sent_at IS NULL
      AND b.booking_date IS NOT NULL
      AND b.booking_hours IS NOT NULL
      AND b.booking_hours ~ '^\d{1,2}:\d{2}'
  LOOP
    -- Interpret booking_date + booking_hours in Asia/Tashkent
    v_appt := (
      (r.booking_date::text || ' ' || trim(r.booking_hours))::timestamp
      AT TIME ZONE 'Asia/Tashkent'
    );

    v_mins_until := EXTRACT(EPOCH FROM (v_appt - now())) / 60.0;

    -- 5-minute cron window: fire when 25–35 minutes remain
    IF v_mins_until < 25 OR v_mins_until > 35 THEN
      CONTINUE;
    END IF;

    IF r.guest_name IS NOT NULL AND r.guest_name <> '' THEN
      v_client_name := r.guest_name;
      v_client_phone := r.guest_phone;
    ELSIF r.client_id IS NOT NULL THEN
      SELECT COALESCE(fullname, phone, 'Mijoz'), phone
        INTO v_client_name, v_client_phone
      FROM public.clients
      WHERE id = r.client_id
      LIMIT 1;
    ELSE
      v_client_name := 'Mijoz';
      v_client_phone := r.guest_phone;
    END IF;

    v_client_text := format(
      E'⏰ <b>30 daqiqa qoldi!</b>\n\n'
      'Sartaroshxona: <b>%s</b>\n'
      '✂️ %s\n'
      '🕐 %s — %s\n'
      '%s'
      'Vaqtida keling! 👋',
      COALESCE(NULLIF(r.office_name, ''), r.barber_fullname, '—'),
      COALESCE(r.service_name, 'Xizmat'),
      COALESCE(r.booking_date::text, ''),
      COALESCE(r.booking_hours, ''),
      CASE WHEN COALESCE(r.barber_address, '') <> ''
           THEN format(E'📍 %s\n', r.barber_address)
           ELSE ''
      END
    );

    v_barber_text := format(
      E'⏰ <b>30 daqiqa qoldi!</b>\n\n'
      '👤 %s\n'
      '%s'
      '✂️ %s\n'
      '🕐 %s — %s\n\n'
      'Mijoz tez orada keladi.',
      COALESCE(v_client_name, 'Mijoz'),
      CASE WHEN v_client_phone IS NOT NULL
           THEN format(E'📞 %s\n', v_client_phone)
           ELSE ''
      END,
      COALESCE(r.service_name, 'Xizmat'),
      COALESCE(r.booking_date::text, ''),
      COALESCE(r.booking_hours, '')
    );

    IF v_client_phone IS NOT NULL AND v_client_phone <> '' THEN
      PERFORM public.notify_telegram(jsonb_build_object(
        'target', 'client',
        'phone',  v_client_phone,
        'text',   v_client_text
      ));
    END IF;

    PERFORM public.notify_telegram(jsonb_build_object(
      'target',    'barber',
      'barber_id', r.barber_id,
      'phone',     r.barber_phone,
      'text',      v_barber_text
    ));

    UPDATE public.bookings
      SET reminder_30m_sent_at = now()
    WHERE id = r.id;

    v_sent_count := v_sent_count + 1;
  END LOOP;

  RETURN v_sent_count;
END;
$$;

-- Schedule cron job (requires pg_cron extension — enable in Supabase Dashboard)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if re-running migration
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'booking-reminder-30m';

    PERFORM cron.schedule(
      'booking-reminder-30m',
      '*/5 * * * *',
      $$SELECT public.send_booking_reminders_30m()$$
    );
  ELSE
    RAISE NOTICE 'pg_cron not enabled — enable it in Supabase Dashboard and run: SELECT cron.schedule(''booking-reminder-30m'', ''*/5 * * * *'', $$SELECT public.send_booking_reminders_30m()$$);';
  END IF;
END;
$$;
