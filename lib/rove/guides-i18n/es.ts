import { h, p, ul, type GuideTranslations } from "./blocks";

const es: GuideTranslations = {
  "do-i-need-an-international-driving-permit": {
    title: "¿Necesito un permiso internacional de conducir? País a país",
    description: "Qué países piden a los visitantes un permiso internacional de conducir, qué versión aceptan y qué más llevar en los destinos de alquiler más populares.",
    standfirst: "El permiso internacional (PIC) es una traducción de tu carnet. Algunos países lo exigen y otros no. Así funciona y esto es lo que piden los destinos más populares.",
    body: [
      h("Qué es un PIC y qué no es"),
      p("El permiso internacional de conducir traduce tu carnet a un formato estándar reconocido por los convenios internacionales de circulación. Solo vale junto a tu carnet completo de origen, y solo para las categorías de vehículo que este cubre. Se obtiene antes de viajar, en el país que expidió tu carnet."),
      p("Hay tres versiones, con el nombre de los convenios que las respaldan: 1926, 1949 y 1968. Cada país acepta la versión (o versiones) de los convenios de los que forma parte, así que la correcta depende de adónde vayas."),
      h("Qué piden los destinos más populares"),
      ul([
        "Unión Europea: un carnet de un país de la UE o del EEE es válido en toda la UE. Si vienes de otro sitio, comprueba cada país; el Gobierno británico sitúa a Portugal, Grecia, Italia y Croacia bajo el convenio de 1968, y a España y Malta bajo el de 1949.",
        "Japón: solo se acepta el PIC en papel de la Convención de Ginebra de 1949. Los carnets de Suiza, Alemania, Francia, Bélgica, Mónaco y Taiwán se usan en su lugar con una traducción al japonés autorizada. Puedes conducir hasta un año desde tu llegada.",
        "Estados Unidos: los visitantes suelen poder conducir con su carnet de origen, pero las normas varían según el estado y puede hacer falta un PIC (la versión de 1949). Consulta cada estado por el que vayas a conducir y las normas de la empresa de alquiler.",
        "Nueva Zelanda: puedes conducir con un carnet extranjero vigente durante un tiempo limitado; si no está en inglés, lleva una traducción al inglés aprobada.",
        "Costa Rica: un carnet de origen vigente sirve durante tu estancia como turista, normalmente hasta 90 días.",
        "Emiratos Árabes Unidos: los visitantes de más de 30 países pueden conducir con su carnet de origen con visado de visita; el resto necesita un PIC.",
        "Marruecos: según el Gobierno británico, los conductores británicos necesitan el PIC de 1968, y la versión de 1949 ya no se acepta.",
        "Tailandia e Indonesia: los visitantes necesitan un PIC junto con su carnet y, para scooters, ambos deben incluir motocicletas. Consulta nuestras guías de Tailandia y Bali."
      ]),
      h("Las empresas de alquiler pueden pedir más"),
      p("Aunque la ley no exija un PIC, una empresa de alquiler puede pedirlo, además de una edad mínima o un año o más de experiencia al volante. Si una empresa en Rove necesita documentos, te lo dirá al confirmar tu reserva."),
      h("Scooters y motos"),
      p("Un carnet de coche no cubre automáticamente un scooter. En Grecia, por ejemplo, necesitas al menos la categoría A1 (motocicleta ligera) para alquilar un ciclomotor. Conducir sin el carnet adecuado también puede hacer que tu seguro de viaje no pague tras un accidente.")
    ]
  },
  "car-rental-insurance-explained": {
    title: "Seguro de coche de alquiler: CDW, franquicia y fianza",
    description: "Qué cubre un CDW, qué es la franquicia, por qué se bloquea una fianza en tu tarjeta y cómo evitar cargos sorpresa al alquilar en el extranjero.",
    standfirst: "Los seguros de alquiler están llenos de siglas. Esto es lo que significan CDW, franquicia y fianza, y lo que debes revisar antes de firmar.",
    body: [
      h("Responsabilidad civil"),
      p("El seguro de responsabilidad civil cubre los daños o lesiones que causes a otras personas. En la UE todo vehículo de alquiler debe tenerlo, normalmente incluido en el precio. En los EAU la cobertura a terceros está incluida por ley. En México es obligatoria una responsabilidad civil de una aseguradora mexicana, y las pólizas de EE. UU. o Canadá no son válidas allí."),
      h("CDW (exención por daños) y franquicia"),
      p("El CDW limita lo que pagas si se daña el propio vehículo de alquiler, pero rara vez elimina todo el coste. Lo que queda es la franquicia: lo máximo que pagarías por los daños. El CDW suele excluir neumáticos y cristales, así que revisa qué cubre el tuyo."),
      p("Las empresas de alquiler suelen vender una cobertura extra que reduce la franquicia (a veces a cero). Puede salir cara. Un seguro de franquicia independiente suele ser más barato, pero pagarías primero a la empresa y luego reclamarías el dinero."),
      h("Fianza"),
      p("La fianza suele ser un bloqueo en una tarjeta de crédito a nombre del conductor. No puedes gastar ese importe mientras está bloqueado, y se libera cuando el vehículo vuelve sin daños, multas ni peajes pendientes. En los EAU, por ejemplo, debería liberarse en un plazo de 30 días. En Rove, cada vehículo muestra su fianza antes de reservar."),
      h("Cómo evitar cargos sorpresa"),
      ul([
        "Antes de salir, rodea el vehículo con la empresa y fotografíalo o grábalo por todos los lados, también por dentro, incluido el nivel de combustible. Asegúrate de que cualquier daño quede anotado en el documento de entrega.",
        "Revisa la política de combustible, el límite de kilometraje si lo hay y el precio de extras como las sillas infantiles.",
        "Guarda copias del contrato y de los informes de recogida y devolución.",
        "Si una reclamación con una empresa de otro país de la UE no avanza, el Centro Europeo del Consumidor de tu país puede ayudarte gratis."
      ]),
      h("Scooters y quads"),
      p("El seguro que se vende con scooters y quads suele ser solo a terceros, así que pagarías los daños del propio vehículo. Muchos seguros de viaje excluyen los quads, y conducir sin el carnet adecuado puede anular tu cobertura.")
    ]
  },
  "renting-a-car-in-europe": {
    title: "Alquilar un coche en Europa: carnet, peajes y zonas urbanas",
    description: "Qué necesitas para alquilar y conducir un coche en Europa: carnet y edad, peajes electrónicos, zonas ZTL de Italia, equipamiento obligatorio, alcohol y seguro.",
    standfirst: "Las normas de Europa cambian de un país a otro. Estas son las que más sorprenden a los visitantes.",
    body: [
      h("Carnet y edad"),
      p("Un carnet de un país de la UE o del EEE es válido en toda la UE. Con un carnet de otro lugar, revisa cada país en el que vayas a conducir; algunos piden un permiso internacional de conducir. La edad mínima para conducir un coche es de 18 años en Portugal, España, Grecia, Italia y Croacia, pero las empresas de alquiler suelen fijar su propio mínimo (en Malta lo habitual son 21) y pueden cobrar más a menores de 25."),
      h("Peajes y zonas urbanas"),
      ul([
        "Portugal: algunas autopistas solo tienen peaje electrónico. Pregunta si el coche lleva dispositivo de telepeaje.",
        "Italia: muchos centros urbanos son zonas de tráfico limitado (ZTL) vigiladas por cámaras. Entrar sin permiso supone una multa, que a menudo llega más tarde a través de la empresa de alquiler.",
        "España: algunas ciudades tienen zonas de bajas emisiones, y Barcelona pide a los vehículos extranjeros que se registren con antelación."
      ]),
      h("Lo que debe llevar el coche"),
      p("En Croacia todo coche debe llevar triángulo de emergencia, botiquín y chalecos reflectantes. Comprueba que estén en el coche al recogerlo. Lleva siempre el carnet y un documento de identidad al conducir; en Portugal es obligatorio."),
      h("En la carretera"),
      ul([
        "Se conduce por la derecha en todas partes salvo en Malta, Chipre, Irlanda y el Reino Unido.",
        "El límite habitual de alcohol en Portugal, España y Grecia es del 0,05 % (0,5 g/l), más bajo para conductores noveles.",
        "En España está prohibido usar el móvil al volante incluso con el coche detenido en el arcén, y los niños de menos de 1,35 m necesitan silla infantil."
      ]),
      h("Seguro"),
      p("La responsabilidad civil va incluida en todo alquiler en la UE. Los daños al propio coche suelen cubrirse con un CDW con franquicia; consulta nuestra guía sobre CDW, franquicia y fianza.")
    ]
  },
  "renting-a-scooter-in-greece": {
    title: "Alquilar un scooter o un quad en Grecia",
    description: "El carnet para alquilar un ciclomotor, scooter o quad en Grecia, normas y multas del casco, lagunas del seguro y consejos de seguridad en las islas.",
    standfirst: "Los scooters y los quads están por todas partes en las islas griegas. Las normas del carnet son más estrictas de lo que muchos visitantes esperan.",
    body: [
      h("El carnet que necesitas"),
      p("Para alquilar un ciclomotor o un scooter en Grecia necesitas un carnet vigente con al menos la categoría A1 (motocicleta ligera). Un carnet de coche no basta, y la categoría P británica para ciclomotores de hasta 50 cc no es válida en Grecia. Los permisos provisionales no valen para ningún vehículo."),
      h("Casco"),
      p("Conductores y pasajeros de ciclomotores y quads deben llevar casco. Si la policía te para sin él, te multará y te retirará el carnet, y circular sin casco puede invalidar tu seguro."),
      h("Quads: mucho cuidado"),
      ul([
        "Los quads causan lesiones graves y muertes cada año. Pide instrucciones adecuadas antes de conducir y recuerda que compartes la carretera con tráfico más grande y rápido.",
        "El seguro que se vende con un quad suele ser solo a terceros: lo más probable es que la empresa te cobre cualquier daño al propio quad.",
        "Muchos seguros de viaje consideran los quads un deporte de riesgo y los excluyen. Lee tu póliza antes de salir."
      ]),
      h("En la carretera"),
      ul([
        "En Grecia se conduce por la derecha.",
        "El tráfico puede ser rápido y caótico, y los conductores no siempre paran en los pasos de peatones.",
        "Conducir bebido es un delito grave, con multas y posible cárcel."
      ]),
      h("Antes de salir"),
      ul([
        "Comprueba que el vehículo está en buen estado: frenos, neumáticos y luces.",
        "Fotografíalo con la empresa, incluidos los daños que ya tenga, y acordad la fianza y la hora de devolución."
      ])
    ]
  },
  "renting-a-scooter-in-thailand": {
    title: "Alquilar un scooter en Tailandia: carnet, casco y seguro",
    description: "Qué necesitas para conducir legalmente un scooter de alquiler en Tailandia: el carnet adecuado y el PIC, normas y multas del casco, fianza y seguro.",
    standfirst: "El scooter es la forma más fácil de moverse por la mayoría de las islas tailandesas. Esto es lo que necesitas para conducirlo legalmente y lo que debes revisar antes de salir.",
    body: [
      h("El carnet que necesitas"),
      p("Para conducir un scooter o una moto en Tailandia como visitante necesitas un carnet que cubra motocicletas, más un permiso internacional de conducir (PIC) que indique la categoría de moto. Un carnet de coche por sí solo no cubre un scooter, diga lo que diga la tienda de alquiler."),
      p("El Gobierno tailandés menciona los PIC expedidos según la Convención de Ginebra de 1949, y también se aceptan carnets de otros países de la ASEAN. El Gobierno británico aconseja a los conductores británicos llevar la versión de 1968. Consigue tu PIC en tu país antes de viajar: no puedes obtenerlo una vez en Tailandia."),
      h("El casco es obligatorio, para los dos"),
      p("Conductor y pasajero deben llevar casco según el artículo 122 de la Ley de Tráfico Terrestre (Land Traffic Act). La policía puede multarte con hasta 2.000 bahts, y los controles se intensificaron en todo el país desde el 1 de junio de 2025. Pide a la empresa un casco de tu talla, para ti y para quien vaya contigo."),
      h("Seguro: qué cubre y qué no"),
      ul([
        "Todo vehículo matriculado debe tener el seguro obligatorio (Por Ror Bor). Cubre lesiones y muertes, pero no los daños al scooter ni a bienes de terceros.",
        "Pregunta a la empresa qué más cubre el seguro del scooter y cuánto pagarías si se daña o lo roban.",
        "Comprueba que tu seguro de viaje cubre conducir moto. Muchas pólizas solo pagan si tienes el carnet adecuado para el vehículo, así que sin él puedes quedarte sin cobertura."
      ]),
      h("Fianza"),
      p("Cuenta con dejar una fianza, que te devuelven cuando entregas el scooter en el mismo estado. No dejes tu pasaporte como fianza o garantía: los gobiernos británico y australiano lo desaconsejan. En Rove, cada vehículo muestra su fianza antes de reservar."),
      h("Antes de salir"),
      ul([
        "Rodea el scooter con la empresa y fotografía cualquier arañazo o abolladura, para que nadie discuta por ellos después.",
        "Revisa frenos, neumáticos, luces y claxon, y que la documentación del vehículo y del seguro vaya con el scooter.",
        "Acordad el combustible, la hora de devolución y a quién llamar si se avería.",
        "Guarda el teléfono o el chat de la empresa antes de irte."
      ]),
      h("En la carretera"),
      ul([
        "En Tailandia se conduce por la izquierda.",
        "Tailandia tiene una de las tasas de muertes en carretera más altas del mundo, y los motoristas son los más expuestos. Conduce a la defensiva y con especial cuidado cuando llueve.",
        "Festividades como el Songkran traen más tráfico y más alcohol. Nunca conduzcas después de beber."
      ])
    ]
  },
  "international-driving-permit-thailand": {
    title: "Permiso internacional de conducir para Tailandia",
    description: "¿Necesitas un permiso internacional para conducir coche o moto en Tailandia? Qué tipo sacar, dónde conseguirlo y qué llevar contigo.",
    standfirst: "La mayoría de los visitantes necesita un permiso internacional de conducir para conducir en Tailandia. Te contamos cuál, dónde conseguirlo y qué llevar.",
    body: [
      h("Qué es un PIC"),
      p("El permiso internacional de conducir es una traducción de tu carnet en un formato estándar, reconocido por acuerdos internacionales. No sustituye a tu carnet: llevas los dos siempre que conduces."),
      h("¿Lo necesitas en Tailandia?"),
      p("Sí, salvo que tengas un carnet tailandés o de otro país de la ASEAN. El Gobierno tailandés menciona los PIC expedidos según la Convención de Ginebra de 1949. El Gobierno británico indica a los conductores británicos que lleven la versión de 1968 para Tailandia, así que consulta con tu propia autoridad de tráfico qué tipo expide para Tailandia."),
      p("Sin un carnet válido te pueden multar, y tu seguro de viaje puede rechazar una reclamación tras un accidente. El Gobierno australiano advierte de que conducir sin el carnet correcto puede acabar en detención."),
      h("Scooters y motos"),
      p("Tu PIC solo cubre lo que cubre tu carnet de origen. Para conducir un scooter o una moto, ambos deben incluir la categoría de motocicleta; un carnet y un PIC solo de coche no cubren un scooter."),
      h("Dónde conseguirlo"),
      p("El PIC se obtiene en el país que expidió tu carnet, antes de viajar: no puedes conseguirlo una vez en Tailandia. En el Reino Unido, por ejemplo, se vende en persona en tiendas con servicio PayPoint, por 5,50 £."),
      h("Qué llevar"),
      ul([
        "Tu carnet completo de origen (puede que no acepten un carnet digital).",
        "Tu PIC.",
        "Tu pasaporte o una copia, y la documentación del vehículo, que la empresa de alquiler deja en el vehículo."
      ]),
      h("¿Te quedas más tiempo?"),
      p("Si vives en Tailandia, puedes solicitar un carnet tailandés. El Gobierno tailandés también describe un permiso temporal de 30 días para turistas cuyo carnet no se puede usar, expedido por la Oficina Provincial de Transporte Terrestre.")
    ]
  },
  "monthly-car-rental-thailand": {
    title: "Alquiler de coche por meses en Tailandia: cómo funciona",
    description: "Cómo funciona el alquiler mensual de coches y scooters en Tailandia: precio frente a tarifas diarias, fianza, renovación cada mes y qué revisar.",
    standfirst: "¿Te quedas un mes o más? Alquilar por meses a una empresa local suele salir mucho más barato por día que alquilar día a día.",
    body: [
      h("Por qué alquilar por meses"),
      p("Las empresas de alquiler locales en Tailandia suelen tener un precio mensual muy inferior por día a su tarifa diaria, porque un alquiler largo les ahorra entregas, limpiezas y días sin alquilar. Si te quedas tres semanas o más, compara ambos antes de reservar."),
      h("Cómo funciona en Rove"),
      ul([
        "Elige «Mensual, sin fecha de fin» en la búsqueda para ver los precios mensuales. Un alquiler mensual sin fecha de fin continúa mes a mes hasta que avises de que lo dejas.",
        "Elige una fecha de fin si sabes cuándo te vas: Rove muestra el total exacto para tus fechas, calculado como lo cobra la empresa.",
        "Tu reserva va directamente a la empresa. Ella confirma la entrega contigo, y le pagas según las condiciones que aparecen en su página."
      ]),
      h("Fianza"),
      p("Un alquiler mensual suele incluir una fianza, que se devuelve cuando el vehículo vuelve en el mismo estado. En Rove, cada vehículo muestra su fianza antes de reservar. No dejes tu pasaporte como fianza: las recomendaciones oficiales de viaje lo desaconsejan."),
      h("Qué revisar antes de firmar"),
      ul([
        "Qué pasa al final de cada mes: cómo y cuándo pagas, y con cuánta antelación debes avisar si quieres dejarlo.",
        "Qué cubre el seguro del vehículo. El seguro obligatorio (Por Ror Bor) solo cubre lesiones y muertes, no los daños al vehículo.",
        "Quién paga el mantenimiento y las reparaciones durante un alquiler largo, y qué hacer si el vehículo se avería.",
        "Si puedes sacar el vehículo de la isla o de la provincia, y si hay límite de kilometraje.",
        "Si la entrega y la recogida están incluidas."
      ]),
      h("Tu carnet sigue importando"),
      p("Los visitantes necesitan su carnet de origen y un permiso internacional de conducir para conducir en Tailandia. Si vives en Tailandia, puedes solicitar un carnet tailandés.")
    ]
  },
  "renting-a-scooter-in-bali": {
    title: "Alquilar un scooter en Bali",
    description: "Qué necesitas para alquilar y conducir un scooter en Bali: permiso internacional, casco, controles policiales, seguro y las últimas normas para turistas.",
    standfirst: "En Bali hay scooters por todas partes, y controles policiales también. Esto es lo que necesitas para conducir de forma legal y segura.",
    body: [
      h("El carnet que necesitas"),
      p("Tu carnet de origen no basta por sí solo en Indonesia: necesitas un permiso internacional de conducir (o un carnet indonesio), y debe cubrir motocicletas. Consigue tu PIC en tu país antes de viajar."),
      p("La policía controla. En mayo de 2025, una operación de tres días en Badung, que abarca Canggu, Kuta, Seminyak y Uluwatu, multó a 81 conductores, 30 de ellos turistas, e incautó 56 vehículos."),
      h("Las normas para turistas pueden cambiar"),
      p("El gobierno provincial de Bali ha propuesto que los turistas de estancia corta no puedan alquilar motos para conducirlas ellos mismos. En nuestra última comprobación era una propuesta, no una norma en vigor. Pregunta a la empresa por la situación actual antes de reservar."),
      h("Casco"),
      p("Lleva un casco en buen estado cada vez que conduzcas, y asegúrate de que tu pasajero también tenga uno."),
      h("Seguro"),
      p("Comprueba que tu seguro de viaje cubre conducir moto en Indonesia con el carnet que tienes. Conducir sin el carnet adecuado, o sin respetar las normas, puede hacer que rechacen una reclamación."),
      h("En la carretera"),
      ul([
        "En Indonesia se conduce por la izquierda.",
        "El tráfico es denso e impredecible, sobre todo en el sur. Si no tienes soltura con la moto, quizá te convenga más un coche con conductor.",
        "Si tienes un accidente, espera a la policía en el lugar y denúncialo en una comisaría.",
        "En Nyepi, el día del silencio de Bali, los desplazamientos por la isla se detienen durante todo el día."
      ]),
      h("Antes de salir"),
      ul([
        "Fotografía el scooter con la empresa, incluidos los daños que ya tenga.",
        "Revisa frenos, neumáticos y luces, y acordad la fianza, el combustible y la hora de devolución.",
        "Guarda el teléfono o el chat de la empresa."
      ])
    ]
  }
};

export default es;
