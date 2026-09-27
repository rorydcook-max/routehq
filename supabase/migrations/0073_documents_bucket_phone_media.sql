-- Phones upload straight to storage now (see lib/direct-uploads.ts).
-- iPhones record video as .mov (video/quicktime) and may send HEIC photos;
-- Android and browsers may send WebM. Allow them in the documents bucket.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/webm'
]
where id = 'documents';
