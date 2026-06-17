# AI Trim Catalog Generation

Use this only for server-side catalog maintenance. Never expose `OPENAI_API_KEY` in browser code.

## Environment

Add these to `.env.local`:

```env
OPENAI_API_KEY=your_key
OPENAI_TRIM_CATALOG_MODEL=gpt-4o
```

`OPENAI_VISION_MODEL` is separate and is used by Blue Book OCR. The trim catalog script uses only `OPENAI_TRIM_CATALOG_MODEL`.

## Required Migration

Run:

```text
supabase/migrations/0008_trim_metadata.sql
```

AI-generated trims are stored as draft rows:

- `source = ai_generated`
- `verification_status = pending_review`
- `raw_ai_payload` contains the full OpenAI JSON response

Verified/manual rows are not overwritten.

## Usage

Dry-run first:

```powershell
node scripts/generate-trim-catalog.mjs --make Ford --model Ranger --dry-run
```

Review the output. Good rows should be granular purchasable variants, for example:

```text
WildTrak 2.0L Bi-Turbo 4x4 10AT
XLT 2.2L 4x2 6AT
XL Single Cab 2.2L MT RWD
eDrive40 76.6kWh RWD
```

For EVs and plug-in hybrids, `engine_cc` may be `null`. EV trim names should use battery size or grade and drivetrain, not fake engine names like `0L`.
When `--refresh-existing` is used, old AI-generated EV/PHEV rows with `0L` in the trim name are marked inactive/rejected before new candidates are generated.

Then insert draft rows:

```powershell
node scripts/generate-trim-catalog.mjs --make Ford --model Ranger
```

Useful flags:

```text
--make Ford
--model Ranger
--category car
--market TH
--dry-run
--limit 10
--skip-existing
--refresh-existing
```

Make and model values with spaces should be wrapped in quotes in PowerShell:

```powershell
node scripts/generate-trim-catalog.mjs --make "Mercedes-Benz"
node scripts/generate-trim-catalog.mjs --make "Royal Enfield"
node scripts/generate-trim-catalog.mjs --make Hyundai --model "Ioniq 5"
```

The parser also tolerates unquoted multi-word values by joining words until the next `--flag`, but quoting is still clearer.

Use `--skip-existing` when filling the remaining catalog. It skips any model that already has AI-generated trim rows in Supabase, so the script does not spend OpenAI credits regenerating models you have already populated. Original manual/seed rows do not cause a model to be skipped.

By default, the script only inserts exact new trim matches. If a generated trim already exists for the same model with the same `name` and `year_from`, it is skipped. Use `--refresh-existing` only when you deliberately want to update existing AI-generated pending-review rows.

Recommended full run order: Toyota, Honda, Ford, Isuzu, Mitsubishi, Mazda, Suzuki, MG, Nissan, Hyundai, Kia, then remaining car/van makes alphabetically, then motorcycle brands last.
