---
title: "Tukar dari HQ Rental Software ke RoveHQ"
description: "Eksport reservasi, kenderaan dan pelanggan HQ Rental Software anda ke Excel dan bawa masuk ke RoveHQ. Kami import secara percuma."
updated: 2026-11-03
exports:
  - "Mana-mana jadual (reservasi, kenderaan, pelanggan) ke Excel, dengan lajur yang anda pilih"
  - "Laporan ke Excel atau PDF"
  - "API untuk pembangun"
steps:
  - "Dalam HQ Rental Software, buka Car Rental, kemudian Reservations, tapis jika perlu, dan tambah lajur yang anda mahu."
  - "Klik menu di bahagian atas kanan jadual, kemudian Actions, kemudian Export."
  - "Buat perkara yang sama untuk Vehicles dan Customers."
  - "Dalam RoveHQ, buka Kenderaan, kemudian Import, pilih HQ Rental Software dan muat naik semua fail sekali gus."
faq:
  - q: "Adakah saya perlukan API HQ?"
    a: "Tidak. Eksport Excel sudah memadai. API ada jika pembangun lebih suka menggunakannya."
---
Pangkalan pengetahuan HQ menyatakan anda boleh mengeksport setiap jadual dan laporan dalam sistem ke Excel. RoveHQ mengenali eksport reservasi dan kenderaan HQ melalui tajuk lajurnya (tarikh dan lokasi ambil serta pulang, kelas kenderaan, plat, odometer).

## Bagaimana status dipindahkan

- Reservasi **Open** dan **Pending** menjadi tempahan akan datang.
- Reservasi **Rental** menjadi sewaan yang sedang berjalan.
- Reservasi **Completed** menjadi sewaan lepas.
- **Quote**, **Cancelled** dan **No Show** disenaraikan tetapi tidak dimasukkan melainkan anda menandanya.

Jumlah dibayar dan deposit keselamatan dipindahkan secara berasingan, jadi deposit yang anda pegang tidak akan dikira sebagai pendapatan.

Masih berfikir? Baca [perbandingan HQ Rental Software vs RoveHQ](/guides/hq-rental-software-vs-rovehq).

## Import percuma

Import adalah percuma dalam setiap pelan. RoveHQ mengenali eksport HQ Rental Software dan terus membacanya. Anda nampak setiap kenderaan, tempahan dan bayaran sebelum apa-apa disimpan, dan anda boleh membatalkan keseluruhan import dalam masa 30 hari. Jika anda tidak mahu buat sendiri, [hantarkan fail kepada kami](/contact) dan kami akan bawa masuk untuk anda.
