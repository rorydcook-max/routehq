---
title: "Cambie de HQ Rental Software a RoveHQ"
description: "Exporte sus reservas, vehículos y clientes de HQ Rental Software a Excel y páselos a RoveHQ. Lo importamos gratis."
updated: 2026-11-03
exports:
  - "Cualquier tabla (reservas, vehículos, clientes) a Excel, con las columnas que elija"
  - "Informes a Excel o PDF"
  - "Una API para desarrolladores"
steps:
  - "En HQ Rental Software, abra Car Rental, luego Reservations, filtre si hace falta y añada las columnas que quiera."
  - "Haga clic en el menú de arriba a la derecha de la tabla, luego en Actions y después en Export."
  - "Haga lo mismo con Vehicles y Customers."
  - "En RoveHQ, abra Flota, luego Importar, elija HQ Rental Software y suba los archivos juntos."
faq:
  - q: "¿Necesito la API de HQ?"
    a: "No. Las exportaciones a Excel bastan. La API está ahí si un desarrollador la prefiere."
---
La base de conocimiento de HQ dice que puede exportar a Excel todas las tablas e informes del sistema. RoveHQ reconoce las exportaciones de reservas y vehículos de HQ por sus encabezados (fechas y lugares de recogida y devolución, categoría del vehículo, matrícula, cuentakilómetros).

## Cómo pasan los estados

- Las reservas **Open** y **Pending** pasan a ser reservas próximas.
- Las reservas **Rental** pasan a ser alquileres en curso.
- Las reservas **Completed** pasan a ser alquileres pasados.
- **Quote**, **Cancelled** y **No Show** aparecen en la lista, pero no se importan salvo que los marque.

El total pagado y la fianza se importan por separado, así que una fianza que usted retiene nunca cuenta como ingreso.

¿Aún lo está pensando? Lea nuestra [comparativa HQ Rental Software vs RoveHQ](/guides/hq-rental-software-vs-rovehq).

## Importación gratis

Importar es gratis en todos los planes. RoveHQ reconoce las exportaciones de HQ Rental Software y las lee al instante. Usted ve cada vehículo, reserva y pago antes de que se guarde nada, y puede deshacer toda la importación durante 30 días. Si prefiere no hacerlo usted mismo, [envíenos los archivos](/contact) y los importamos por usted.
