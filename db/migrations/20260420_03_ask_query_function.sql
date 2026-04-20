-- 20260420_03_ask_query_function.sql
-- Layer 3 of the SQL safety stack.
-- run_safe_sql tool calls this function rather than executing arbitrary SQL.
-- The function is owned by ask_ai_readonly and runs with that role's grants.

CREATE OR REPLACE FUNCTION public.ask_query(sql_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_rows jsonb;
  wrapped_sql text;
BEGIN
  -- Wrap the validated SELECT in a hard-capped subquery.
  wrapped_sql := format(
    'SELECT coalesce(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s) t LIMIT 500',
    sql_text
  );
  EXECUTE wrapped_sql INTO result_rows;
  RETURN result_rows;
END;
$$;

ALTER FUNCTION public.ask_query(text) OWNER TO ask_ai_readonly;
REVOKE ALL ON FUNCTION public.ask_query(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ask_query(text) TO ask_ai_readonly;
