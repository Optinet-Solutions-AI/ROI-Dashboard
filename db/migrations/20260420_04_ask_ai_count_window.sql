CREATE OR REPLACE FUNCTION public.ask_ai_count_window(
  p_session_id     text,
  p_window_minutes integer
) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'session_count',    count(*) FILTER (WHERE session_id = p_session_id),
    'global_count',     count(*),
    'oldest_in_window', min(created_at)
  )
  FROM public.ask_ai_logs
  WHERE created_at > now() - make_interval(mins => p_window_minutes);
$$;

REVOKE ALL ON FUNCTION public.ask_ai_count_window(text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ask_ai_count_window(text,integer) TO service_role;
