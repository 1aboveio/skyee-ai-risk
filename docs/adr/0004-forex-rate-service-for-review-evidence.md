# Forex Rate Service For Review Evidence

Accepted.

The Customer Risk Review Workbench will use a server-side Forex Rate Service to normalize transaction amounts into USD for review evidence. The service caches daily FX rates in the Review Store, using the same direction as `dim_forex`: `base_currency = USD`, `quote_currency = transaction currency`, and `rate` meaning `1 USD = rate quote currency`.

The service refreshes rates on a daily schedule and performs lazy backfill from `dim_forex` when a required currency/date is missing. Conversion uses the latest prior rate at or before the transaction date; if no prior rate exists, the evidence package surfaces a data-quality warning instead of silently inventing a rate. Review Evidence Snapshots persist the resolved `usd_amount`, FX rate, FX rate date, and FX source used for the reviewer's decision.
