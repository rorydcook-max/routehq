---
title: "Cambie de Booqable a RoveHQ"
description: "Exporte sus pedidos, clientes e inventario de Booqable en CSV y páselos a RoveHQ en pocos minutos. Lo importamos gratis."
updated: 2026-11-03
exports:
  - "Orders (reservas) en CSV, desde la lista Orders"
  - "Customers (clientes) en CSV"
  - "Inventory (inventario) en CSV, una fila por unidad cuando los productos se controlan por unidad"
  - "Reports (rendimiento de productos, clientes) en CSV"
steps:
  - "En Booqable, abra Orders, baje hasta el final de la lista y haga clic en Export."
  - "Haga lo mismo en Customers y en Inventory."
  - "En RoveHQ, abra Flota, luego Importar, elija Booqable y suba los archivos CSV juntos."
  - "Revise lo que encontró y luego impórtelo."
faq:
  - q: "¿RoveHQ copia las fianzas de Booqable como ingresos?"
    a: "No. La fianza de un pedido se registra como fianza retenida, no como ingreso."
  - q: "¿Puedo importar varios archivos de Booqable a la vez?"
    a: "Sí. Suba pedidos, clientes e inventario juntos y RoveHQ los enlaza."
---
Las exportaciones de Booqable son archivos CSV con una columna por cada campo de la página, y puede añadir o quitar columnas antes de exportar. RoveHQ reconoce los archivos de pedidos, clientes e inventario de Booqable por sus encabezados y los lee sin adivinar.

## Cómo pasan los estados

- Los pedidos **Reserved** (reservados) pasan a ser reservas próximas.
- Los pedidos **Started** (recogidos) pasan a ser alquileres en curso.
- Los pedidos **Stopped** (devueltos) y **archived** (archivados) pasan a ser alquileres pasados.
- Los pedidos **Draft** (borrador) y **cancelled** (cancelados) aparecen en la lista, pero no se importan salvo que los marque.

El identificador de una unidad (a menudo la matrícula o un número de flota) pasa a ser la matrícula del vehículo. Los pedidos se enlazan con los clientes por el nombre, y con los vehículos cuando el identificador está en la exportación.

¿Aún lo está pensando? Lea nuestra [comparativa Booqable vs RoveHQ](/guides/booqable-vs-rovehq) o nuestra lista de [alternativas a Booqable para alquiler de vehículos](/guides/booqable-alternatives).

## Importación gratis

Importar es gratis en todos los planes. RoveHQ reconoce las exportaciones de Booqable y las lee al instante. Usted ve cada vehículo, reserva y pago antes de que se guarde nada, y puede deshacer toda la importación durante 30 días. Si prefiere no hacerlo usted mismo, [envíenos los archivos](/contact) y los importamos por usted.
