# Setting Up the Emergency Alert Trigger

To automatically trigger the `emergency-alert-dispatch` Supabase Edge Function when a new emergency check-in occurs, we recommend using a Supabase Database Webhook. This is generally simpler to configure than a PL/pgSQL trigger that directly calls an Edge Function.

## Using Supabase Database Webhooks

1.  **Navigate to Webhooks in Supabase Dashboard**:
    *   Go to your Supabase project.
    *   In the left sidebar, click on "Database".
    *   Then, select "Webhooks".

2.  **Create a New Webhook**:
    *   Click on the "Create a new webhook" button.

3.  **Configure the Webhook**:
    *   **Name**: Give your webhook a descriptive name, e.g., `Emergency Check-in Alert Dispatch`.
    *   **Table**: Select the `checkins` table from the dropdown.
    *   **Events**: Check the `Insert` box. You only want this to trigger on new records.
    *   **HTTP Request**:
        *   **URL**: Set this to the URL of your `emergency-alert-dispatch` Edge Function. It will look something like:
            `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/emergency-alert-dispatch`
            Replace `<YOUR_PROJECT_REF>` with your actual Supabase project reference.
        *   **Method**: `POST` (this is what the `emergency-alert-dispatch` function expects).
        *   **Headers**:
            *   You **must** include the `Authorization` header with your Supabase `service_role` key if your function is protected (which it should be by default).
                *   `Authorization`: `Bearer <YOUR_SUPABASE_SERVICE_ROLE_KEY>`
            *   You should also include `Content-Type`: `application/json`.
            *   Supabase will automatically add an `apikey` header using the anon key if you don't specify an Authorization header with the service role key. For security and to ensure the function has the right permissions (like inserting into the `alerts` table or invoking other functions), using the `service_role` key is recommended.
    *   **Trigger Conditions (Optional but Recommended for Precision)**:
        *   While the Edge Function itself checks `is_emergency`, you can make the webhook more precise by adding a condition so it only fires when `is_emergency` is `true`.
        *   Supabase webhooks allow you to specify conditions for when the webhook should fire. You can use SQL expressions here.
        *   In the "Advanced settings" or a similar section for conditions, you might be able to set a filter on the new record. For example, if Supabase allows filtering on the `NEW` record data directly in the webhook UI (this feature might vary or be part of "Supabase Realtime" settings for triggers):
            *   Filter condition: `NEW.is_emergency = true`
        *   If direct filtering on the `NEW` record isn't straightforward in the webhook UI, the check within the Edge Function (`if (!newCheckin.is_emergency)`) will serve as the primary guard. The webhook will fire for all new check-ins, but the function will only proceed for emergency ones.

4.  **Save the Webhook**:
    *   Click "Confirm" or "Save" to create the webhook.

## How it Works

*   When a new row is inserted into the `checkins` table, Supabase will check if it matches the webhook's criteria (specifically, the `Insert` event on the `checkins` table).
*   If it matches, Supabase will automatically send a `POST` request to your `emergency-alert-dispatch` function's URL.
*   The body of this `POST` request will contain a JSON payload with information about the event, including the `new record` (the newly inserted check-in row). The Edge Function is designed to parse this `record` object from the payload.

## Alternative: PL/pgSQL Trigger (More Complex for this Use Case)

While webhooks are recommended, a database trigger could also be used. However, directly calling an Edge Function (especially one requiring an HTTP request) from PL/pgSQL is more complex and might require extensions like `pg_net`.

Here's a conceptual example of what such a trigger might look like, but **using a Database Webhook is preferred**:

```sql
-- This function would be part of your database migrations.
-- NOTE: Direct HTTP calls from PL/pgSQL are complex.
-- Supabase might have specific helper functions or extensions (like pg_net)
-- to make this feasible. The example below is simplified.

-- Create a function that will be executed by the trigger
CREATE OR REPLACE FUNCTION public.handle_new_emergency_checkin()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  payload TEXT;
  request_id BIGINT; -- For pg_net or similar
  SUPABASE_URL TEXT := 'https://<YOUR_PROJECT_REF>.supabase.co'; -- Replace with your project ref
  EDGE_FUNCTION_URL TEXT := SUPABASE_URL || '/functions/v1/emergency-alert-dispatch';
  SERVICE_ROLE_KEY TEXT := '<YOUR_SUPABASE_SERVICE_ROLE_KEY>'; -- Store securely, ideally not hardcoded here
BEGIN
  -- Construct the payload from the NEW record
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW)
  )::TEXT;

  -- This part is highly dependent on the available HTTP client extensions in Supabase Postgres
  -- Example using pg_net (if installed and configured):
  /*
  SELECT net.http_post(
      url:=EDGE_FUNCTION_URL,
      body:=payload::JSONB,
      headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || SERVICE_ROLE_KEY
      )
  ) INTO request_id;
  */

  -- If not using an extension, this trigger would likely need to insert into a queue table,
  -- and a separate worker process (like another Edge Function on a schedule) would process the queue.

  -- For simplicity, the webhook approach is better as Supabase manages the HTTP call.

  RAISE NOTICE 'New emergency check-in detected for user_id: %. Payload: %', NEW.user_id, payload;
  -- The actual call to the Edge Function is omitted here due to complexity.
  -- The webhook handles this part.

  RETURN NEW; -- Result is ignored since this is an AFTER trigger
END;
$$;

-- Create the trigger
CREATE TRIGGER on_new_emergency_checkin_trigger
AFTER INSERT ON public.checkins
FOR EACH ROW
WHEN (NEW.is_emergency = TRUE)
EXECUTE FUNCTION public.handle_new_emergency_checkin();

-- Don't forget to enable the trigger if it's created disabled
-- ALTER TABLE public.checkins ENABLE TRIGGER on_new_emergency_checkin_trigger;
```

**Conclusion**: Use the Database Webhook method through the Supabase Dashboard for simplicity and reliability in invoking your Edge Function. Ensure your Edge Function URL is correct and necessary headers (especially `Authorization` with a service role key) are configured in the webhook settings.
```
