---
title: "Lumipat mula sa Booqable papunta sa RoveHQ"
description: "I-export ang mga order, customer at inventory mo sa Booqable bilang CSV at ipasok sa RoveHQ sa loob ng ilang minuto. Libre ang import."
updated: 2026-11-03
exports:
  - "Mga order (booking) bilang CSV, mula sa Orders list"
  - "Mga customer bilang CSV"
  - "Inventory bilang CSV, isang row kada stock item kapag naka-track ang mga produkto"
  - "Mga report (product performance, customer) bilang CSV"
steps:
  - "Sa Booqable, buksan ang Orders, mag-scroll hanggang sa dulo ng listahan at i-click ang Export."
  - "Gawin din ito sa Customers at sa Inventory."
  - "Sa RoveHQ, buksan ang Fleet, tapos Mag-import, piliin ang Booqable at i-upload nang sabay ang mga CSV file."
  - "Suriin ang nakita, tapos ipasok na."
faq:
  - q: "Kinokopya ba ng RoveHQ ang mga deposit sa Booqable bilang kita?"
    a: "Hindi. Ang security deposit sa isang order ay itinatala bilang hawak na deposit, hindi bilang kita."
  - q: "Puwede ba akong mag-import ng ilang Booqable file nang sabay?"
    a: "Oo. I-upload nang sabay ang orders, customers at inventory at pag-uugnayin sila ng RoveHQ."
---
Ang mga export ng Booqable ay CSV file na may column para sa bawat field sa page, at puwede kang magdagdag o mag-alis ng column bago mag-export. Kilala ng RoveHQ ang order, customer at inventory file ng Booqable sa mga heading nito at binabasa ang mga ito nang walang hula.

## Paano lumilipat ang mga status

- Ang mga order na **Reserved** ay nagiging paparating na booking.
- Ang mga order na **Started** (nakuha na) ay nagiging rental na nakalabas ngayon.
- Ang mga order na **Stopped** (naibalik na) at **archived** ay nagiging nakaraang rental.
- Ang mga order na **Draft** at **cancelled** ay nakalista pero hindi isasama maliban kung i-tick mo.

Ang identifier ng stock item (kadalasan ang plaka o fleet number) ang nagiging plaka ng sasakyan. Iniuugnay ang mga order sa customer ayon sa pangalan, at sa sasakyan kapag nasa export ang identifier.

Nagdedesisyon pa? Basahin ang [ang paghahambing namin ng Booqable at RoveHQ](/guides/booqable-vs-rovehq) o ang listahan namin ng [mga alternatibo sa Booqable para sa vehicle rental](/guides/booqable-alternatives).

## Libreng import

Libre ang pag-import sa bawat plan. Kilala ng RoveHQ ang mga export ng Booqable at binabasa agad ang mga ito. Makikita mo ang bawat sasakyan, booking at bayad bago may ma-save, at puwede mong bawiin ang buong import sa loob ng 30 araw. Ayaw mong gawin ito mismo? [Ipadala sa amin ang mga file](/contact) at kami na ang magpapasok nito para sa iyo.
