# Yang Masih Kurang di Pulse Signal

Berdasarkan pemeriksaan kode dan database saat ini, aplikasi sudah kuat di sisi pengambilan data live dan tampilan. Yang belum ada adalah **memori jangka panjang, kecerdasan AI, dan otomatisasi**.

## Temuan kondisi saat ini

- Database hanya berisi: `profiles`, `user_roles`, `saved_articles`, `alerts`, `alert_events`, `search_history`, `data_sources`, `system_logs`. **Tidak ada tabel penyimpanan artikel/postingan** — setiap pencarian mengambil ulang dari internet dan hasilnya hilang saat halaman ditutup.
- Alert dievaluasi di browser, hanya untuk satu alert aktif, dan hanya saat halaman Alerts terbuka. Tidak ada proses latar belakang.
- Analisis sentimen memakai kamus kata (lexicon) buatan sendiri. Tidak ada model AI yang dipakai di mana pun dalam proyek.
- Tidak ada endpoint API publik/cron dan tidak ada cache — setiap pencarian memanggil ~10 sumber dari awal.

## Usulan penyempurnaan (berurutan)

### 1. Memori data — arsip artikel & postingan
Tabel baru untuk menyimpan setiap item yang berhasil diambil beserta sentimen, entitas, dan metrik engagement, plus snapshot metrik harian per kata kunci.

Manfaat: grafik tren yang benar-benar historis (bukan hanya 7 hari terakhir dari sumber), deteksi lonjakan yang akurat, dan pencarian instan dari arsip sebelum menembak internet.

### 2. AI untuk sentimen & ringkasan
Pakai Lovable AI (tanpa API key tambahan) untuk:
- Sentimen berbahasa Indonesia yang paham sarkasme, konteks politik, dan bahasa gaul — jauh lebih akurat daripada kamus kata.
- Ringkasan harian: "5 isu terbesar hari ini" dalam bahasa Indonesia.
- Pengelompokan berita ke dalam topik/isu, bukan sekadar daftar artikel.
Sentimen kamus tetap dipakai sebagai cadangan cepat dan saat AI gagal.

### 3. Alert otomatis di latar belakang
Endpoint cron yang berjalan terjadwal, mengevaluasi **semua** alert aktif milik semua pengguna, menyimpan kejadian, dan mengirim email notifikasi. Alert tetap berjalan walau pengguna tidak membuka aplikasi.

### 4. Cache & kecepatan
Cache hasil per kombinasi kueri+filter dengan masa berlaku singkat, sehingga pencarian berulang langsung tampil dan beban ke sumber eksternal berkurang.

### 5. Laporan & digest
Ringkasan email harian/mingguan berisi volume, sentimen, isu teratas, dan influencer teratas — plus ekspor PDF laporan yang sudah ada.

## Catatan teknis

- Tabel baru: `monitored_items` (arsip item, unik per URL), `item_metrics_daily` (agregat harian per kata kunci), `keyword_watchlist`. Semua dengan RLS + GRANT sesuai pola yang sudah dipakai.
- Penyimpanan arsip dilakukan di dalam `collectFeed` melalui server function dengan `upsert` (tanpa memperlambat respons).
- AI dipanggil dari server function via Lovable AI Gateway (model `google/gemini-3-flash` untuk klasifikasi massal), batch beberapa item sekaligus agar hemat.
- Cron memakai route publik `src/routes/api/public/run-alerts.ts` dengan verifikasi token rahasia, dijadwalkan lewat pg_cron.
- Cache disimpan di tabel `feed_cache` berbasis hash filter, TTL 5 menit.

## Saran urutan pengerjaan

Mulai dari **nomor 1 dan 2** — keduanya memberi lompatan kualitas terbesar (tren historis nyata + sentimen Indonesia yang akurat). Nomor 3–5 menyusul setelahnya.