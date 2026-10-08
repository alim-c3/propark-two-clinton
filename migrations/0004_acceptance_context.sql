-- Extra context captured with every terms acceptance (append-only table;
-- existing rows keep nulls). Never updated or deleted by application code.
alter table legal_acceptances add column if not exists accept_language text;
alter table legal_acceptances add column if not exists referrer text;
alter table legal_acceptances add column if not exists time_zone text;
alter table legal_acceptances add column if not exists screen text;
