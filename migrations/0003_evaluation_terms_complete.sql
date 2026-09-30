-- Drop the truncated 2026-09-30-v1 snapshot so the complete controlled
-- legal text is seeded from legal/versions/2026-09-30-v1.md.
-- Only removes the row that still carries the truncated document hash.
-- Never touches legal_acceptances.

delete from evaluation_agreements
where version = '2026-09-30-v1'
  and sha256 = '0236157a2b1b70a6e6392c72148353b49af43e202e0387900e6cdf6e6e0e7a92';
