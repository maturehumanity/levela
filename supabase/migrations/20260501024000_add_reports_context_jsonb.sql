-- Add structured report context for message-level moderation payloads.

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS report_context jsonb;

ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_report_context_object_check;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_report_context_object_check CHECK (
    report_context IS NULL OR jsonb_typeof(report_context) = 'object'
  );

COMMENT ON COLUMN public.reports.report_context IS
  'Structured metadata for moderation review (e.g., source=private_message, message_id, conversation_id, excerpt).';
