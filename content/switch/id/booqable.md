---
title: "Pindah dari Booqable ke RoveHQ"
description: "Ekspor pesanan, pelanggan, dan inventaris Booqable Anda sebagai CSV dan masukkan ke RoveHQ dalam beberapa menit. Kami impor gratis."
updated: 2026-11-03
exports:
  - "Pesanan (pemesanan) sebagai CSV, dari daftar Orders"
  - "Pelanggan sebagai CSV"
  - "Inventaris sebagai CSV, satu baris per unit stok jika produk dilacak"
  - "Laporan (kinerja produk, pelanggan) sebagai CSV"
steps:
  - "Di Booqable, buka Orders, gulir ke bawah daftar, lalu klik Export."
  - "Lakukan hal yang sama di Customers dan Inventory."
  - "Di RoveHQ, buka Armada, lalu Impor, pilih Booqable, lalu unggah semua file CSV sekaligus."
  - "Periksa apa yang ditemukan, lalu masukkan."
faq:
  - q: "Apakah RoveHQ mencatat deposit dari Booqable sebagai pendapatan?"
    a: "Tidak. Deposit jaminan pada pesanan dicatat sebagai deposit yang ditahan, bukan pendapatan."
  - q: "Bisakah saya mengimpor beberapa file Booqable sekaligus?"
    a: "Bisa. Unggah pesanan, pelanggan, dan inventaris sekaligus, dan RoveHQ menghubungkannya."
---
Ekspor Booqable berupa file CSV dengan satu kolom untuk setiap kolom isian di halaman, dan Anda bisa menambah atau menghapus kolom sebelum mengekspor. RoveHQ mengenali file pesanan, pelanggan, dan inventaris Booqable dari judul kolomnya dan membacanya tanpa menebak.

## Bagaimana status dipindahkan

- Pesanan **Reserved** menjadi pemesanan mendatang.
- Pesanan **Started** (sudah diambil) menjadi sewa yang sedang berjalan.
- Pesanan **Stopped** (sudah dikembalikan) dan **archived** menjadi sewa yang sudah selesai.
- Pesanan **Draft** dan **cancelled** ditampilkan, tetapi tidak dimasukkan kecuali Anda mencentangnya.

Kode unit stok (sering berupa pelat nomor atau nomor armada) menjadi pelat kendaraan. Pesanan dihubungkan ke pelanggan berdasarkan nama, dan ke kendaraan jika kodenya ada di file ekspor.

Masih menimbang? Baca [perbandingan Booqable vs RoveHQ](/guides/booqable-vs-rovehq) atau daftar [alternatif Booqable untuk rental kendaraan](/guides/booqable-alternatives).

## Impor gratis

Impor gratis di semua paket. RoveHQ mengenali file ekspor Booqable dan langsung membacanya. Anda melihat setiap kendaraan, pemesanan, dan pembayaran sebelum apa pun disimpan, dan Anda bisa membatalkan seluruh impor dalam 30 hari. Kalau tidak ingin repot, [kirimkan file-nya](/contact) dan kami yang memasukkannya untuk Anda.
