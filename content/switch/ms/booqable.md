---
title: "Tukar dari Booqable ke RoveHQ"
description: "Eksport pesanan, pelanggan dan inventori Booqable anda sebagai CSV dan bawa masuk ke RoveHQ dalam beberapa minit. Kami import secara percuma."
updated: 2026-11-03
exports:
  - "Pesanan (tempahan) sebagai CSV, dari senarai Orders"
  - "Pelanggan sebagai CSV"
  - "Inventori sebagai CSV, satu baris bagi setiap item stok jika produk dijejak"
  - "Laporan (prestasi produk, pelanggan) sebagai CSV"
steps:
  - "Dalam Booqable, buka Orders, tatal ke bawah senarai dan klik Export."
  - "Buat perkara yang sama dalam Customers dan Inventory."
  - "Dalam RoveHQ, buka Kenderaan, kemudian Import, pilih Booqable dan muat naik semua fail CSV sekali gus."
  - "Semak apa yang ditemui, kemudian bawa masuk."
faq:
  - q: "Adakah RoveHQ menyalin deposit Booqable sebagai pendapatan?"
    a: "Tidak. Deposit keselamatan pada pesanan direkodkan sebagai deposit yang dipegang, bukan pendapatan."
  - q: "Bolehkah saya import beberapa fail Booqable sekali gus?"
    a: "Boleh. Muat naik pesanan, pelanggan dan inventori bersama-sama dan RoveHQ akan memautkannya."
---
Eksport Booqable ialah fail CSV dengan satu lajur bagi setiap medan pada halaman, dan anda boleh menambah atau membuang lajur sebelum mengeksport. RoveHQ mengenali fail pesanan, pelanggan dan inventori Booqable melalui tajuk lajurnya dan membacanya tanpa meneka.

## Bagaimana status dipindahkan

- Pesanan **Reserved** menjadi tempahan akan datang.
- Pesanan **Started** (sudah diambil) menjadi sewaan yang sedang berjalan.
- Pesanan **Stopped** (sudah dipulangkan) dan **archived** menjadi sewaan lepas.
- Pesanan **Draft** dan **cancelled** disenaraikan tetapi tidak dimasukkan melainkan anda menandanya.

Pengecam item stok (selalunya nombor plat atau nombor armada) menjadi plat kenderaan. Pesanan dipautkan kepada pelanggan mengikut nama, dan kepada kenderaan jika pengecam ada dalam eksport.

Masih berfikir? Baca [perbandingan Booqable vs RoveHQ](/guides/booqable-vs-rovehq) atau senarai [alternatif Booqable untuk sewaan kenderaan](/guides/booqable-alternatives).

## Import percuma

Import adalah percuma dalam setiap pelan. RoveHQ mengenali eksport Booqable dan terus membacanya. Anda nampak setiap kenderaan, tempahan dan bayaran sebelum apa-apa disimpan, dan anda boleh membatalkan keseluruhan import dalam masa 30 hari. Jika anda tidak mahu buat sendiri, [hantarkan fail kepada kami](/contact) dan kami akan bawa masuk untuk anda.
