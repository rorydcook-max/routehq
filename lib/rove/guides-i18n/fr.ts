import { h, p, ul, type GuideTranslations } from "./blocks";

const fr: GuideTranslations = {
  "do-i-need-an-international-driving-permit": {
    title: "Faut-il un permis international ? Le guide pays par pays",
    description: "Quels pays exigent un permis de conduire international, quelle version ils acceptent et quoi emporter pour les destinations de location populaires.",
    standfirst: "Le permis international (PCI) est une traduction de votre permis. Certains pays l'exigent, d'autres non. Voici comment il fonctionne et ce que demandent les destinations populaires.",
    body: [
      h("Ce qu'est un PCI, et ce qu'il n'est pas"),
      p("Le permis de conduire international traduit votre permis dans un format standard reconnu par les conventions internationales sur la circulation routière. Il n'est valable qu'avec votre permis complet d'origine, et seulement pour les catégories de véhicules que celui-ci couvre. Vous l'obtenez avant de partir, dans le pays qui a délivré votre permis."),
      p("Il en existe trois versions, du nom des conventions dont elles découlent : 1926, 1949 et 1968. Un pays accepte la version (ou les versions) des conventions dont il est signataire ; la bonne dépend donc de votre destination."),
      h("Ce que demandent les destinations populaires"),
      ul([
        "Union européenne : un permis délivré dans un pays de l'UE ou de l'EEE est valable dans toute l'UE. Les visiteurs d'ailleurs doivent vérifier pays par pays ; le gouvernement britannique classe le Portugal, la Grèce, l'Italie et la Croatie sous la convention de 1968, et l'Espagne et Malte sous celle de 1949.",
        "Japon : seul le PCI papier de la Convention de Genève de 1949 est accepté. Les permis de Suisse, d'Allemagne, de France, de Belgique, de Monaco et de Taïwan s'utilisent à la place avec une traduction japonaise agréée. Vous pouvez conduire jusqu'à un an après votre arrivée.",
        "États-Unis : les visiteurs peuvent en général conduire avec leur permis national, mais les règles varient selon les États et un PCI peut être nécessaire (version 1949). Vérifiez chaque État où vous conduirez, ainsi que les règles du loueur.",
        "Nouvelle-Zélande : vous pouvez conduire avec un permis étranger valide pendant une durée limitée ; s'il n'est pas en anglais, ayez sur vous une traduction anglaise agréée.",
        "Costa Rica : un permis national valide suffit pendant votre séjour touristique, normalement jusqu'à 90 jours.",
        "Émirats arabes unis : les visiteurs de plus de 30 pays peuvent conduire avec leur permis national sous visa de visite ; les autres ont besoin d'un PCI.",
        "Maroc : selon le gouvernement britannique, les conducteurs britanniques doivent avoir le PCI de 1968, la version de 1949 n'étant plus acceptée.",
        "Thaïlande et Indonésie : les visiteurs ont besoin d'un PCI avec leur permis, et pour un scooter, les deux doivent inclure la moto. Voir nos guides Thaïlande et Bali."
      ]),
      h("Les loueurs peuvent en demander plus"),
      p("Même là où la loi n'exige pas de PCI, un loueur peut le demander, tout comme un âge minimum ou au moins un an de permis. Si un loueur sur Rove a besoin de documents, il vous le dira en confirmant votre réservation."),
      h("Scooters et motos"),
      p("Un permis voiture ne couvre pas automatiquement un scooter. En Grèce, par exemple, il faut au moins la catégorie A1 (motocyclette légère) pour louer un cyclomoteur. Conduire sans le bon permis peut aussi empêcher votre assurance voyage de payer après un accident.")
    ]
  },
  "car-rental-insurance-explained": {
    title: "Assurance location de voiture : CDW, franchise et caution",
    description: "Ce que couvre une CDW, ce qu'est la franchise, pourquoi une caution est bloquée sur votre carte et comment éviter les frais surprises à l'étranger.",
    standfirst: "L'assurance de location est pleine de sigles. Voici ce que signifient CDW, franchise et caution, et ce qu'il faut vérifier avant de signer.",
    body: [
      h("Responsabilité civile"),
      p("L'assurance responsabilité civile couvre les dommages ou blessures que vous causez à autrui. Dans l'UE, tout véhicule de location doit en être doté, normalement inclus dans le prix. Aux Émirats, elle est incluse par la loi. Au Mexique, une responsabilité civile souscrite auprès d'un assureur mexicain est obligatoire, et les polices américaines ou canadiennes n'y sont pas valables."),
      h("CDW (rachat partiel de franchise) et franchise"),
      p("La CDW limite ce que vous payez si le véhicule loué est endommagé, mais supprime rarement tout le coût. Ce qui reste, c'est la franchise : le montant maximal que vous paieriez pour les dégâts. La CDW exclut souvent les pneus et les vitres ; vérifiez ce que couvre la vôtre."),
      p("Les loueurs vendent souvent une couverture complémentaire qui réduit la franchise (parfois à zéro). Elle peut coûter cher. Une assurance franchise indépendante est souvent moins chère, mais vous payez d'abord le loueur puis vous vous faites rembourser."),
      h("Caution"),
      p("La caution est généralement une empreinte bloquée sur une carte de crédit au nom du conducteur. Vous ne pouvez pas dépenser ce montant tant qu'il est bloqué ; il est libéré quand le véhicule revient sans dommages, amendes ni péages impayés. Aux Émirats, par exemple, il doit être libéré sous 30 jours. Sur Rove, chaque véhicule affiche sa caution avant la réservation."),
      h("Éviter les frais surprises"),
      ul([
        "Avant de partir, faites le tour du véhicule avec le loueur et photographiez-le ou filmez-le sous tous les angles, intérieur compris, niveau de carburant inclus. Vérifiez que chaque dommage figure sur l'état des lieux.",
        "Vérifiez la politique carburant, une éventuelle limite de kilométrage et le prix des options comme les sièges enfant.",
        "Gardez une copie du contrat et des états des lieux de départ et de retour.",
        "Si un litige avec un loueur d'un autre pays de l'UE n'aboutit pas, le Centre européen des consommateurs de votre pays peut vous aider gratuitement."
      ]),
      h("Scooters et quads"),
      p("L'assurance vendue avec les scooters et les quads se limite souvent à la responsabilité civile : les dégâts au véhicule lui-même sont à votre charge. Beaucoup d'assurances voyage excluent le quad, et conduire sans le bon permis peut annuler votre couverture.")
    ]
  },
  "renting-a-car-in-europe": {
    title: "Louer une voiture en Europe : permis, péages, ZTL",
    description: "Louer et conduire en Europe : permis et âge, péages électroniques, zones ZTL en Italie, équipement obligatoire, alcool au volant et assurance.",
    standfirst: "Les règles changent d'un pays européen à l'autre. Voici celles qui piègent le plus souvent les visiteurs.",
    body: [
      h("Permis et âge"),
      p("Un permis d'un pays de l'UE ou de l'EEE est valable dans toute l'UE. Avec un permis d'ailleurs, vérifiez chaque pays où vous conduirez ; certains demandent un permis international. L'âge minimum pour conduire une voiture est de 18 ans au Portugal, en Espagne, en Grèce, en Italie et en Croatie, mais les loueurs fixent souvent leur propre minimum (21 ans est courant à Malte) et peuvent facturer plus avant 25 ans."),
      h("Péages et zones urbaines"),
      ul([
        "Portugal : certaines autoroutes n'acceptent que le péage électronique. Demandez si la voiture a un badge de télépéage.",
        "Italie : de nombreux centres-villes sont des zones à trafic limité (ZTL) contrôlées par caméras. Y entrer sans autorisation vaut une amende, souvent envoyée plus tard via le loueur.",
        "Espagne : certaines villes ont des zones à faibles émissions, et Barcelone demande aux véhicules étrangers de s'enregistrer à l'avance."
      ]),
      h("Ce que la voiture doit avoir à bord"),
      p("En Croatie, toute voiture doit avoir un triangle de signalisation, une trousse de premiers secours et des gilets réfléchissants. Vérifiez qu'ils sont dans la voiture au départ. Ayez toujours votre permis et une pièce d'identité au volant ; c'est obligatoire au Portugal."),
      h("Sur la route"),
      ul([
        "On roule à droite partout, sauf à Malte, à Chypre, en Irlande et au Royaume-Uni.",
        "Le taux d'alcool habituel au Portugal, en Espagne et en Grèce est de 0,05 % (0,5 g/l), plus bas pour les jeunes conducteurs.",
        "En Espagne, utiliser son téléphone au volant est interdit même arrêté sur le bas-côté, et les enfants de moins de 1,35 m doivent avoir un siège auto."
      ]),
      h("Assurance"),
      p("La responsabilité civile est incluse dans toute location dans l'UE. Les dégâts à la voiture elle-même sont en général couverts par une CDW avec franchise ; voir notre guide sur la CDW, la franchise et la caution.")
    ]
  },
  "renting-a-scooter-in-greece": {
    title: "Louer un scooter ou un quad en Grèce",
    description: "Le permis pour louer un cyclomoteur, un scooter ou un quad en Grèce, casque et amendes, trous de couverture et conseils de sécurité sur les îles.",
    standfirst: "Scooters et quads sont partout sur les îles grecques. Les règles de permis sont plus strictes que beaucoup de visiteurs ne le pensent.",
    body: [
      h("Le permis nécessaire"),
      p("Pour louer un cyclomoteur ou un scooter en Grèce, il vous faut un permis valide comportant au moins la catégorie A1 (motocyclette légère). Un permis voiture seul ne suffit pas, et la catégorie P britannique pour les cyclomoteurs jusqu'à 50 cm³ n'est pas valable en Grèce. Les permis provisoires ne sont valables pour aucun véhicule."),
      h("Casque"),
      p("Conducteurs et passagers de cyclomoteurs et de quads doivent porter un casque. Si la police vous arrête sans casque, vous aurez une amende et votre permis sera retiré, et rouler sans casque peut annuler votre assurance."),
      h("Quads : redoublez de prudence"),
      ul([
        "Les quads causent chaque année des blessures graves et des décès. Faites-vous bien expliquer la conduite avant de partir, et n'oubliez pas que vous partagez la route avec des véhicules plus gros et plus rapides.",
        "L'assurance vendue avec un quad se limite généralement à la responsabilité civile : le loueur vous facturera probablement tout dégât au quad lui-même.",
        "Beaucoup d'assurances voyage considèrent le quad comme un sport extrême et l'excluent. Lisez votre contrat avant de partir."
      ]),
      h("Sur la route"),
      ul([
        "En Grèce, on roule à droite.",
        "La circulation peut être rapide et chaotique, et les automobilistes ne s'arrêtent pas toujours aux passages piétons.",
        "L'alcool au volant est une infraction grave, passible d'amendes et de prison."
      ]),
      h("Avant de partir"),
      ul([
        "Vérifiez que le véhicule est en bon état : freins, pneus et éclairage.",
        "Photographiez-le avec le loueur, y compris les dégâts existants, et convenez de la caution et de l'heure de retour."
      ])
    ]
  },
  "renting-a-scooter-in-thailand": {
    title: "Louer un scooter en Thaïlande : permis, casque, assurance",
    description: "Ce qu'il faut pour conduire légalement un scooter de location en Thaïlande : le bon permis et le PCI, casque et amendes, caution et assurance.",
    standfirst: "Le scooter est le moyen le plus simple de circuler sur la plupart des îles thaïlandaises. Voici ce qu'il faut pour rouler en règle, et ce qu'il faut vérifier avant de partir.",
    body: [
      h("Le permis nécessaire"),
      p("Pour conduire un scooter ou une moto en Thaïlande en tant que visiteur, il vous faut un permis qui couvre les motos, plus un permis de conduire international (PCI) qui mentionne la catégorie moto. Un permis voiture seul ne couvre pas un scooter, quoi qu'en dise le loueur."),
      p("Le gouvernement thaïlandais cite les PCI délivrés selon la Convention de Genève de 1949, et les permis des autres pays de l'ASEAN sont aussi acceptés. Le gouvernement britannique conseille aux conducteurs britanniques d'avoir la version de 1968. Obtenez votre PCI dans votre pays avant de partir : impossible de l'obtenir une fois en Thaïlande."),
      h("Le casque est obligatoire, pour vous deux"),
      p("Conducteur et passager doivent tous deux porter un casque selon l'article 122 du Land Traffic Act. La police peut infliger une amende allant jusqu'à 2 000 bahts, et les contrôles ont été renforcés dans tout le pays depuis le 1er juin 2025. Demandez au loueur un casque à votre taille, pour vous et pour votre passager."),
      h("Assurance : ce qui est couvert et ce qui ne l'est pas"),
      ul([
        "Tout véhicule immatriculé doit avoir l'assurance obligatoire (Por Ror Bor). Elle indemnise les blessures et les décès, mais pas les dégâts au scooter ni aux biens d'autrui.",
        "Demandez au loueur pour quoi d'autre le scooter est assuré, et ce que vous paieriez en cas de dégât ou de vol.",
        "Vérifiez que votre assurance voyage couvre la conduite d'une moto. Beaucoup de contrats ne paient que si vous avez le bon permis pour le véhicule ; sans lui, vous pouvez vous retrouver sans couverture."
      ]),
      h("Caution"),
      p("Attendez-vous à laisser une caution, rendue quand vous rapportez le scooter dans le même état. Ne laissez pas votre passeport en caution ou en garantie : les gouvernements britannique et australien le déconseillent tous deux. Sur Rove, chaque véhicule affiche sa caution avant la réservation."),
      h("Avant de partir"),
      ul([
        "Faites le tour du scooter avec le loueur et photographiez rayures et bosses, pour éviter toute discussion plus tard.",
        "Vérifiez freins, pneus, éclairage et klaxon, et que la carte grise et les papiers d'assurance sont avec le scooter.",
        "Mettez-vous d'accord sur le carburant, l'heure de retour et qui appeler en cas de panne.",
        "Enregistrez le numéro de téléphone ou de messagerie du loueur avant de partir."
      ]),
      h("Sur la route"),
      ul([
        "En Thaïlande, on roule à gauche.",
        "La Thaïlande a l'un des taux de mortalité routière les plus élevés au monde, et les motocyclistes sont les plus exposés. Conduisez prudemment, surtout sous la pluie.",
        "Les fêtes comme Songkran amènent plus de circulation et plus d'alcool. Ne conduisez jamais après avoir bu."
      ])
    ]
  },
  "international-driving-permit-thailand": {
    title: "Permis de conduire international pour la Thaïlande",
    description: "Faut-il un permis international pour conduire une voiture ou un scooter en Thaïlande ? Quelle version, où l'obtenir et quoi avoir sur vous.",
    standfirst: "La plupart des visiteurs ont besoin d'un permis international pour conduire en Thaïlande. Voici lequel, où l'obtenir et quoi avoir sur vous.",
    body: [
      h("Ce qu'est un PCI"),
      p("Le permis de conduire international est une traduction de votre permis dans un format standard, reconnu par des accords internationaux. Il ne remplace pas votre permis : vous avez les deux sur vous chaque fois que vous conduisez."),
      h("En faut-il un en Thaïlande ?"),
      p("Oui, sauf si vous avez un permis thaïlandais ou un permis d'un autre pays de l'ASEAN. Le gouvernement thaïlandais cite les PCI délivrés selon la Convention de Genève de 1949. Le gouvernement britannique demande aux conducteurs britanniques d'avoir la version de 1968 pour la Thaïlande ; vérifiez donc auprès de votre propre autorité quelle version elle délivre pour la Thaïlande."),
      p("Sans permis valide, vous risquez une amende, et votre assurance voyage peut refuser de payer après un accident. Le gouvernement australien prévient que conduire sans le bon permis peut mener à une arrestation."),
      h("Scooters et motos"),
      p("Votre PCI ne couvre que ce que couvre votre permis national. Pour conduire un scooter ou une moto, les deux doivent inclure la catégorie moto ; un permis et un PCI voiture seulement ne couvrent pas un scooter."),
      h("Où l'obtenir"),
      p("Le PCI s'obtient dans le pays qui a délivré votre permis, avant le départ : impossible de l'obtenir une fois en Thaïlande. Au Royaume-Uni, par exemple, il se vend en personne dans les commerces proposant le service PayPoint, pour 5,50 £."),
      h("Quoi avoir sur vous"),
      ul([
        "Votre permis complet d'origine (un permis numérique peut être refusé).",
        "Votre PCI.",
        "Votre passeport ou une copie, et les papiers du véhicule, que le loueur laisse avec le véhicule."
      ]),
      h("Vous restez plus longtemps ?"),
      p("Si vous vivez en Thaïlande, vous pouvez demander un permis thaïlandais. Le gouvernement thaïlandais décrit aussi un permis temporaire de 30 jours pour les touristes dont le permis n'est pas utilisable, délivré par le Provincial Land Transport Office.")
    ]
  },
  "monthly-car-rental-thailand": {
    title: "Location de voiture au mois en Thaïlande : mode d'emploi",
    description: "La location au mois de voitures et scooters en Thaïlande : prix face au tarif journalier, caution, renouvellement mensuel et points à vérifier.",
    standfirst: "Vous restez un mois ou plus ? Louer au mois auprès d'un loueur local revient généralement bien moins cher par jour qu'à la journée.",
    body: [
      h("Pourquoi louer au mois"),
      p("Les loueurs locaux en Thaïlande ont souvent un tarif mensuel bien plus bas par jour que leur tarif journalier, car une longue location leur épargne remises de clés, nettoyages et jours sans client. Si vous restez trois semaines ou plus, comparez les deux avant de réserver."),
      h("Comment ça marche sur Rove"),
      ul([
        "Choisissez « Au mois, sans date de fin » dans la recherche pour voir les prix mensuels. Une location au mois sans date de fin se poursuit de mois en mois jusqu'à ce que vous donniez votre préavis.",
        "Choisissez plutôt une date de fin si vous savez quand vous partez : Rove affiche le total exact pour vos dates, calculé comme le loueur le facture.",
        "Votre réservation va directement au loueur. Il confirme la remise du véhicule avec vous, et vous le payez selon les conditions indiquées sur sa page."
      ]),
      h("Caution"),
      p("Une location au mois s'accompagne normalement d'une caution, rendue quand le véhicule revient dans le même état. Sur Rove, chaque véhicule affiche sa caution avant la réservation. Ne laissez pas votre passeport en caution : les conseils officiels aux voyageurs le déconseillent."),
      h("À vérifier avant de signer"),
      ul([
        "Ce qui se passe à la fin de chaque mois : comment et quand vous payez, et quel préavis donner pour arrêter.",
        "Pour quoi le véhicule est assuré. L'assurance obligatoire (Por Ror Bor) ne couvre que les blessures et les décès, pas les dégâts au véhicule.",
        "Qui paie l'entretien et les réparations pendant une longue location, et que faire en cas de panne.",
        "Si vous pouvez quitter l'île ou la province avec le véhicule, et s'il y a une limite de kilométrage.",
        "Si la livraison et la reprise sont incluses."
      ]),
      h("Votre permis compte toujours"),
      p("Les visiteurs ont besoin de leur permis national et d'un permis international pour conduire en Thaïlande. Si vous vivez en Thaïlande, vous pouvez demander un permis thaïlandais à la place.")
    ]
  },
  "renting-a-scooter-in-bali": {
    title: "Louer un scooter à Bali",
    description: "Ce qu'il faut pour louer et conduire un scooter à Bali : permis international, casque, contrôles de police, assurance et dernières règles pour les touristes.",
    standfirst: "Les scooters sont partout à Bali, les contrôles de police aussi. Voici ce qu'il faut pour rouler en règle et en sécurité.",
    body: [
      h("Le permis nécessaire"),
      p("Votre permis national ne suffit pas seul en Indonésie : il vous faut un permis de conduire international (ou un permis indonésien), et il doit couvrir les motos. Obtenez votre PCI dans votre pays avant de partir."),
      p("La police contrôle. En mai 2025, une opération de trois jours à Badung, qui couvre Canggu, Kuta, Seminyak et Uluwatu, a verbalisé 81 conducteurs, dont 30 touristes, et saisi 56 véhicules."),
      h("Les règles pour les touristes peuvent changer"),
      p("Le gouvernement provincial de Bali a proposé d'interdire aux touristes de court séjour de louer des motos pour les conduire eux-mêmes. Lors de notre dernière vérification, c'était une proposition, pas une règle en vigueur. Demandez au loueur où en sont les choses avant de réserver."),
      h("Casque"),
      p("Portez un casque en bon état à chaque trajet, et assurez-vous que votre passager en a un aussi."),
      h("Assurance"),
      p("Vérifiez que votre assurance voyage couvre la conduite d'une moto en Indonésie avec le permis que vous avez. Rouler sans le bon permis, ou sans respecter les règles, peut entraîner un refus d'indemnisation."),
      h("Sur la route"),
      ul([
        "En Indonésie, on roule à gauche.",
        "La circulation est dense et imprévisible, surtout dans le sud. Si vous n'êtes pas à l'aise sur deux-roues, une voiture avec chauffeur vous conviendra peut-être mieux.",
        "En cas d'accident, attendez la police sur place et déclarez-le dans un commissariat.",
        "Le jour de Nyepi, le jour du silence à Bali, tous les déplacements s'arrêtent sur l'île pour la journée."
      ]),
      h("Avant de partir"),
      ul([
        "Photographiez le scooter avec le loueur, y compris les dégâts existants.",
        "Vérifiez freins, pneus et éclairage, et convenez de la caution, du carburant et de l'heure de retour.",
        "Enregistrez le numéro de téléphone ou de messagerie du loueur."
      ])
    ]
  }
};

export default fr;
