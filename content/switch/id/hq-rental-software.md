---
title: "Pindah dari HQ Rental Software ke RoveHQ"
description: "Ekspor reservasi, kendaraan, dan pelanggan HQ Rental Software Anda ke Excel dan masukkan ke RoveHQ. Kami impor gratis."
updated: 2026-11-03
exports:
  - "Tabel apa pun (reservasi, kendaraan, pelanggan) ke Excel, dengan kolom pilihan Anda"
  - "Laporan ke Excel atau PDF"
  - "API untuk developer"
steps:
  - "Di HQ Rental Software, buka Car Rental, lalu Reservations, filter jika perlu, dan tambahkan kolom yang Anda inginkan."
  - "Klik menu di kanan atas tabel, lalu Actions, lalu Export."
  - "Lakukan hal yang sama untuk Vehicles dan Customers."
  - "Di RoveHQ, buka Armada, lalu Impor, pilih HQ Rental Software, lalu unggah semua file sekaligus."
faq:
  - q: "Apakah saya perlu API HQ?"
    a: "Tidak. Ekspor Excel sudah cukup. API tersedia jika developer lebih suka memakainya."
---
Basis pengetahuan HQ menyebut Anda bisa mengekspor setiap tabel dan laporan di sistem ke Excel. RoveHQ mengenali ekspor reservasi dan kendaraan HQ dari judul kolomnya (tanggal dan lokasi ambil serta kembali, kelas kendaraan, pelat, odometer).

## Bagaimana status dipindahkan

- Reservasi **Open** dan **Pending** menjadi pemesanan mendatang.
- Reservasi **Rental** menjadi sewa yang sedang berjalan.
- Reservasi **Completed** menjadi sewa yang sudah selesai.
- **Quote**, **Cancelled**, dan **No Show** ditampilkan, tetapi tidak dimasukkan kecuali Anda mencentangnya.

Total yang dibayar dan deposit jaminan dipindahkan terpisah, jadi deposit yang Anda tahan tidak pernah dihitung sebagai pendapatan.

Masih menimbang? Baca [perbandingan HQ Rental Software vs RoveHQ](/guides/hq-rental-software-vs-rovehq).

## Impor gratis

Impor gratis di semua paket. RoveHQ mengenali file ekspor HQ Rental Software dan langsung membacanya. Anda melihat setiap kendaraan, pemesanan, dan pembayaran sebelum apa pun disimpan, dan Anda bisa membatalkan seluruh impor dalam 30 hari. Kalau tidak ingin repot, [kirimkan file-nya](/contact) dan kami yang memasukkannya untuk Anda.
