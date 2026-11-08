import { ROVE_SOURCES as S, type Source } from "@/lib/rove/destinations";
import { WORLD_SOURCES as W } from "@/lib/rove/destinations-world";
import { GUIDE_TRANSLATIONS } from "@/lib/rove/guides-i18n";

/**
 * rove.rent's renter guides (task "roverent", 7 Nov 2026): short, practical, and sourced. Written here in English;
 * every other language's words are in lib/rove/guides-i18n/<code>.ts (task rove-guides-i18n, 8 Nov 2026).
 * Facts come from government travel advice and named reporting (the sources under each article); anything we could
 * not confirm was left out. Researched 7 Nov 2026: re-check when editing, rules change.
 */

export type GuideBlock = { type: "p"; text: string } | { type: "h2"; text: string } | { type: "ul"; items: string[] };

export type Guide = {
  slug: string;
  title: string;
  /** The search-result description (about 150 characters). */
  description: string;
  /** One line under the title. */
  standfirst: string;
  published: string;
  updated: string;
  /** Destinations to link to from the article ("thailand/koh-samui"). */
  related: string[];
  body: GuideBlock[];
  sources: Source[];
};

const GOVUK_IDP: Source = { label: "GOV.UK: international driving permits", url: "https://www.gov.uk/driving-abroad/international-driving-permit" };

// Worldwide guides first (task "roverent2"): rove.rent is for renters everywhere.
export const GUIDES: Guide[] = [
  {
    slug: "do-i-need-an-international-driving-permit",
    title: "Do I need an international driving permit? A country-by-country guide for renters",
    description: "Which countries ask visitors for an international driving permit, which convention version they accept, and what else to carry, for popular rental destinations.",
    standfirst: "An IDP is a translation of your license, and some countries require one while others don't. Here's how it works and what popular destinations ask for.",
    published: "2026-11-07",
    updated: "2026-11-07",
    related: ["japan/okinawa", "greece/crete", "united-states/maui", "thailand/koh-samui", "indonesia/bali", "morocco/marrakech"],
    body: [
      { type: "h2", text: "What an IDP is, and what it isn't" },
      {
        type: "p",
        text: "An International Driving Permit translates your license into a standard format recognized under international road-traffic conventions. It only works alongside your full license from home, and it only covers the vehicle categories your license covers. You get it in the country that issued your license, before you travel."
      },
      {
        type: "p",
        text: "There are three versions, named after the conventions behind them: 1926, 1949 and 1968. A country accepts the version (or versions) of the conventions it belongs to, so the right one depends on where you're going."
      },
      { type: "h2", text: "What popular destinations ask for" },
      {
        type: "ul",
        items: [
          "European Union: a license from an EU or EEA country is valid across the EU. Visitors from elsewhere should check each country; the UK government lists Portugal, Greece, Italy and Croatia under the 1968 convention, and Spain and Malta under 1949.",
          "Japan: only the paper IDP under the 1949 Geneva Convention is accepted. Licenses from Switzerland, Germany, France, Belgium, Monaco and Taiwan are used instead with an authorized Japanese translation. You can drive for up to a year after arriving.",
          "United States: visitors can generally drive on their home license, but rules vary by state and an IDP may be needed (the 1949 version). Check each state you'll drive in, and the rental business's own rules.",
          "New Zealand: you can drive on a current overseas license for a limited time; if it isn't in English, carry an approved English translation.",
          "Costa Rica: a valid home license works for the length of your tourist stay, normally up to 90 days.",
          "United Arab Emirates: visitors from more than 30 countries can drive on their home license on a visit visa; others need an IDP.",
          "Morocco: the UK government says UK drivers need the 1968 IDP, and that the 1949 version is no longer accepted.",
          "Thailand and Indonesia: visitors need an IDP with their license, and for scooters both must include motorcycles. See our Thailand and Bali guides."
        ]
      },
      { type: "h2", text: "Rental businesses can ask for more" },
      {
        type: "p",
        text: "Even where the law doesn't require an IDP, a rental business may, along with a minimum age or a year or more of driving experience. If a business on Rove asks for documents, they'll say so when they confirm your booking."
      },
      { type: "h2", text: "Scooters and motorbikes" },
      {
        type: "p",
        text: "A car license doesn't automatically cover a scooter. In Greece, for example, you need at least category A1 (light motorcycle) to rent a moped. Riding without the right license can also mean your travel insurance won't pay out after an accident."
      }
    ],
    sources: [W.idpTable, W.jp, W.ukUs, W.nz, W.crLicense, W.uae, W.ukMa, W.ukGr, S.thGov, S.ukId]
  },
  {
    slug: "car-rental-insurance-explained",
    title: "Car rental insurance explained: CDW, excess and deposits",
    description: "What a collision damage waiver covers, what the excess is, why a deposit is held on your card, and how to avoid surprise charges when you rent a car or scooter abroad.",
    standfirst: "Rental cover is full of acronyms. Here's what CDW, excess and deposits mean, and what to check before you sign.",
    published: "2026-11-07",
    updated: "2026-11-07",
    related: ["portugal/algarve", "spain/mallorca", "united-states/miami-florida-keys", "mexico/cancun-riviera-maya", "united-arab-emirates/dubai"],
    body: [
      { type: "h2", text: "Third-party liability" },
      {
        type: "p",
        text: "Liability insurance covers damage or injury you cause to other people. In the EU every rental vehicle must have it, normally included in the price. In the UAE third-party cover is included by law. In Mexico liability cover from a Mexican insurer is required, and US or Canadian policies aren't valid there."
      },
      { type: "h2", text: "Collision damage waiver (CDW) and the excess" },
      {
        type: "p",
        text: "A CDW limits what you pay if the rental vehicle itself is damaged, but it rarely removes the cost completely. What's left is the excess: the most you'd pay toward damage. A CDW often excludes tires and glass, so check what yours covers."
      },
      {
        type: "p",
        text: "Rental businesses often sell extra cover that lowers the excess (sometimes to zero). It can be expensive. Independent excess insurance is often cheaper, but you'd pay the business first and claim the money back."
      },
      { type: "h2", text: "Deposits" },
      {
        type: "p",
        text: "The deposit is usually a hold on a credit card in the driver's name. You can't spend that amount while it's held, and it's released when the vehicle comes back without damage, fines or unpaid tolls. In the UAE, for example, it should be released within 30 days. On Rove, each vehicle shows its deposit before you book."
      },
      { type: "h2", text: "Avoiding surprise charges" },
      {
        type: "ul",
        items: [
          "Before you drive away, walk round the vehicle with the business and photograph or film it from every side, inside too, including the fuel level. Make sure any damage is written on the handover form.",
          "Check the fuel policy, any mileage limit, and the price of extras like child seats.",
          "Keep copies of the contract and the pick-up and return reports.",
          "If a dispute with a business in another EU country goes nowhere, your country's European Consumer Centre can help for free."
        ]
      },
      { type: "h2", text: "Scooters and quads" },
      {
        type: "p",
        text: "Cover sold with scooters and quads is often third-party only, so you'd pay for damage to the vehicle itself. Many travel policies exclude quad biking, and riding without the right license can void your cover."
      }
    ],
    sources: [W.renting, W.euRental, W.uae, W.mxIns, W.ukGr, { label: "European Consumer Centre Czech Republic: holiday with a rental car", url: "https://evropskyspotrebitel.gov.cz/articles/holiday-with-a-rental-car-get-ready-before-you-turn-the-key/" }]
  },
  {
    slug: "renting-a-car-in-europe",
    title: "Renting a car in Europe: licenses, tolls, city zones and what to carry",
    description: "What visitors need to rent and drive a car in Europe: license and age rules, electronic tolls, Italy's ZTL zones, compulsory kit, drink-drive limits and insurance.",
    standfirst: "Europe's rules vary from country to country. These are the ones that catch visitors out most.",
    published: "2026-11-07",
    updated: "2026-11-07",
    related: ["portugal/algarve", "spain/mallorca", "italy/amalfi-coast", "greece/crete", "croatia/split", "malta/malta-and-gozo"],
    body: [
      { type: "h2", text: "Licenses and age" },
      {
        type: "p",
        text: "A license from an EU or EEA country is valid across the EU. With a license from elsewhere, check each country you'll drive in; some ask for an International Driving Permit. The minimum age to drive a car is 18 in Portugal, Spain, Greece, Italy and Croatia, but rental businesses often set their own minimum (21 is common in Malta) and may charge more under 25."
      },
      { type: "h2", text: "Tolls and city zones" },
      {
        type: "ul",
        items: [
          "Portugal: some motorways take electronic tolls only. Ask whether the car has a toll transponder.",
          "Italy: many town centers are limited traffic zones (ZTL) enforced by cameras. Driving in without a permit brings a fine, often sent on later through the rental business.",
          "Spain: some cities have low-emission zones, and Barcelona asks foreign vehicles to register in advance."
        ]
      },
      { type: "h2", text: "What the car must carry" },
      {
        type: "p",
        text: "In Croatia every car must carry a warning triangle, a first-aid kit and reflective vests. Check they're in the car at pick-up. Carry your license and ID whenever you drive; it's mandatory in Portugal."
      },
      { type: "h2", text: "On the road" },
      {
        type: "ul",
        items: [
          "Everyone drives on the right except in Malta, Cyprus, Ireland and the UK.",
          "The usual drink-drive limit in Portugal, Spain and Greece is 0.05%, lower for new drivers.",
          "In Spain using a phone while driving is illegal even when pulled over, and children under 1.35 m need a child seat."
        ]
      },
      { type: "h2", text: "Insurance" },
      {
        type: "p",
        text: "Third-party liability is included with every EU rental. Damage to the car itself is usually covered by a CDW with an excess; see our guide to CDW, excess and deposits."
      }
    ],
    sources: [W.euRental, W.idpTable, W.racPt, W.racEs, W.racIt, W.racHr, W.racMt, W.racGr, W.ukEs, W.ukPt, W.sides]
  },
  {
    slug: "renting-a-scooter-in-greece",
    title: "Renting a scooter or quad in Greece",
    description: "The license you need to rent a moped, scooter or quad in Greece, helmet rules and fines, insurance gaps and safety tips for the islands.",
    standfirst: "Scooters and quads are everywhere on the Greek islands. The license rules are stricter than many visitors expect.",
    published: "2026-11-07",
    updated: "2026-11-07",
    related: ["greece/santorini", "greece/crete"],
    body: [
      { type: "h2", text: "The license you need" },
      {
        type: "p",
        text: "To rent a moped or scooter in Greece you need a valid license with at least category A1 (light motorcycle). A car license alone isn't enough, and the UK's category P for mopeds up to 50 cc isn't valid in Greece. Provisional licenses aren't valid for any vehicle."
      },
      { type: "h2", text: "Helmets" },
      {
        type: "p",
        text: "Riders and passengers on mopeds and quads must wear helmets. If police stop you without one, they will fine you and take your license, and riding without one can invalidate your insurance."
      },
      { type: "h2", text: "Quads: take extra care" },
      {
        type: "ul",
        items: [
          "Quad bikes cause serious injuries and deaths every year. Get proper instructions before you ride, and remember you're sharing the road with bigger, faster traffic.",
          "Insurance sold with a quad is usually third-party only: the business will likely charge you for any damage to the quad itself.",
          "Many travel policies treat quad biking as an extreme sport and exclude it. Read your policy before you ride."
        ]
      },
      { type: "h2", text: "On the road" },
      {
        type: "ul",
        items: [
          "Greece drives on the right.",
          "Traffic can be fast and chaotic, and drivers don't always stop at pedestrian crossings.",
          "Drink-driving is a serious offense, with fines and possible prison."
        ]
      },
      { type: "h2", text: "Before you ride away" },
      {
        type: "ul",
        items: [
          "Check the vehicle is in good condition: brakes, tires and lights.",
          "Photograph it with the business, including any existing damage, and agree the deposit and return time."
        ]
      }
    ],
    sources: [W.ukGr, W.racGr, W.renting]
  },
  {
    slug: "renting-a-scooter-in-thailand",
    title: "Renting a scooter in Thailand: licenses, helmets and insurance",
    description: "What you need to ride a rented scooter legally in Thailand: the right license and IDP, helmet rules and fines, deposits and insurance.",
    standfirst: "A scooter is the easiest way around most Thai islands. Here's what you need to ride one legally, and what to check before you set off.",
    published: "2026-11-07",
    updated: "2026-11-07",
    related: ["thailand/koh-samui", "thailand/koh-phangan", "thailand/phuket", "thailand/chiang-mai"],
    body: [
      { type: "h2", text: "The license you need" },
      {
        type: "p",
        text: "To ride a scooter or motorbike in Thailand as a visitor you need a driving license that covers motorcycles, plus an International Driving Permit (IDP) that shows the motorcycle category. A car license alone doesn't cover a scooter, whatever a rental shop tells you."
      },
      {
        type: "p",
        text: "Thailand's government lists IDPs issued under the 1949 Geneva Convention, and licenses from other ASEAN countries are accepted too. The UK government advises UK drivers to carry the 1968 version. Get your IDP in your home country before you travel: you can't buy one once you're in Thailand."
      },
      { type: "h2", text: "Helmets are the law, for both of you" },
      {
        type: "p",
        text: "Riders and passengers must both wear a helmet under section 122 of the Land Traffic Act. Police can fine you up to 2,000 baht, and checks were stepped up nationwide from 1 June 2025. Ask the business for a helmet that fits, for you and for anyone riding with you."
      },
      { type: "h2", text: "Insurance: what's covered and what isn't" },
      {
        type: "ul",
        items: [
          "Every registered vehicle must carry compulsory motor insurance (Por Ror Bor). It pays toward injury and death, but not damage to the scooter or to anyone's property.",
          "Ask the business what else the scooter is insured for, and what you'd pay if it's damaged or stolen.",
          "Check your travel insurance covers riding a motorbike. Many policies only pay out if you hold the right license for the vehicle, so riding without one can leave you uncovered."
        ]
      },
      { type: "h2", text: "Deposits" },
      {
        type: "p",
        text: "Expect to leave a deposit, paid back when you return the scooter in the same condition. Don't hand over your passport as a deposit or guarantee: the UK and Australian governments both warn against it. On Rove, each vehicle shows its deposit before you book."
      },
      { type: "h2", text: "Before you ride away" },
      {
        type: "ul",
        items: [
          "Walk round the scooter with the business and photograph any scratches or dents, so nobody argues about them later.",
          "Check the brakes, tires, lights and horn, and that the registration and insurance papers are with the scooter.",
          "Agree the fuel arrangement, the return time, and who to call if it breaks down.",
          "Save the business's phone or chat number before you leave."
        ]
      },
      { type: "h2", text: "On the road" },
      {
        type: "ul",
        items: [
          "Thailand drives on the left.",
          "Thailand has one of the highest road death rates in the world, and motorcyclists are most at risk. Ride defensively and take extra care in the rain.",
          "Holidays such as Songkran bring more traffic and more drinking. Never ride after drinking."
        ]
      }
    ],
    sources: [S.thGov, S.ukTh, S.auTh, S.helmet, S.cmi, S.tat]
  },
  {
    slug: "international-driving-permit-thailand",
    title: "International driving permit for Thailand",
    description: "Do you need an international driving permit to drive or ride in Thailand? Which type to get, where to get it, and what to carry with you.",
    standfirst: "Most visitors need an International Driving Permit to drive or ride in Thailand. Here's which one, where to get it, and what to carry.",
    published: "2026-11-07",
    updated: "2026-11-07",
    related: ["thailand/bangkok", "thailand/phuket", "thailand/chiang-mai"],
    body: [
      { type: "h2", text: "What an IDP is" },
      {
        type: "p",
        text: "An International Driving Permit is a translation of your driving license in a standard format, recognized under international agreements. It doesn't replace your license; you carry both, all the time you're driving."
      },
      { type: "h2", text: "Do you need one in Thailand?" },
      {
        type: "p",
        text: "Yes, unless you hold a Thai license or a license from another ASEAN country. Thailand's government lists IDPs issued under the 1949 Geneva Convention. The UK government tells UK drivers to carry the 1968 version for Thailand, so check with your own licensing authority which type it issues for Thailand."
      },
      {
        type: "p",
        text: "Without a valid license you can be fined, and your travel insurance may refuse a claim after an accident. The Australian government warns that driving without the correct license can lead to arrest."
      },
      { type: "h2", text: "Scooters and motorbikes" },
      {
        type: "p",
        text: "Your IDP only covers what your home license covers. To ride a scooter or motorbike, both must include the motorcycle category; a car-only license and IDP don't cover a scooter."
      },
      { type: "h2", text: "Where to get one" },
      {
        type: "p",
        text: "You get an IDP in the country that issued your license, before you travel: you can't buy one once you're in Thailand. In the UK, for example, IDPs are sold in person at shops offering PayPoint services, for £5.50."
      },
      { type: "h2", text: "What to carry" },
      {
        type: "ul",
        items: [
          "Your full driving license from home (a digital license may not be accepted).",
          "Your IDP.",
          "Your passport or a copy, and the vehicle's papers, which the rental business keeps with the vehicle."
        ]
      },
      { type: "h2", text: "Staying longer?" },
      {
        type: "p",
        text: "If you live in Thailand, you can apply for a Thai driving license. Thailand's government also describes a 30-day temporary license for tourists whose license can't be used, issued by the Provincial Land Transport Office."
      }
    ],
    sources: [S.thGov, S.tat, S.ukTh, S.auTh, GOVUK_IDP]
  },
  {
    slug: "monthly-car-rental-thailand",
    title: "Monthly car rental in Thailand: how it works",
    description: "How monthly car and scooter rental works in Thailand: what it costs compared with daily rates, deposits, renewing each month, and what to check.",
    standfirst: "Staying a month or more? Renting by the month from a local business is usually far cheaper per day than renting day by day.",
    published: "2026-11-07",
    updated: "2026-11-07",
    related: ["thailand/koh-samui", "thailand/chiang-mai", "thailand/pattaya", "thailand/bangkok"],
    body: [
      { type: "h2", text: "Why rent by the month" },
      {
        type: "p",
        text: "Local rental businesses in Thailand often have a monthly price that works out much lower per day than their daily price, because a long rental saves them handovers, cleaning and empty days. If you're staying three weeks or more, compare the two before you book."
      },
      { type: "h2", text: "How it works on Rove" },
      {
        type: "ul",
        items: [
          "Choose \"Monthly, no end date\" in the search to see monthly prices. A monthly rental with no end date carries on month by month until you give notice.",
          "Pick an end date instead if you know when you're leaving: Rove shows the exact total for your dates, worked out the way the business charges it.",
          "Your booking goes straight to the business. They confirm the handover with you, and you pay them on the terms shown on their page."
        ]
      },
      { type: "h2", text: "Deposits" },
      {
        type: "p",
        text: "A monthly rental normally comes with a deposit, returned when the vehicle comes back in the same condition. On Rove each vehicle shows its deposit before you book. Don't hand over your passport as a deposit: government travel advice warns against it."
      },
      { type: "h2", text: "What to check before you sign" },
      {
        type: "ul",
        items: [
          "What happens at the end of each month: how and when you pay, and how much notice to give when you want to stop.",
          "What the vehicle is insured for. Compulsory motor insurance (Por Ror Bor) only covers injury and death, not damage to the vehicle.",
          "Who pays for servicing and repairs during a long rental, and what to do if the vehicle breaks down.",
          "Whether you can take the vehicle off the island or out of the province, and whether there's a mileage limit.",
          "Whether delivery and collection are included."
        ]
      },
      { type: "h2", text: "Your license still matters" },
      {
        type: "p",
        text: "Visitors need their home license plus an International Driving Permit to drive in Thailand. If you're living in Thailand, you can apply for a Thai license instead."
      }
    ],
    sources: [S.thGov, S.ukTh, S.auTh, S.cmi]
  },
  {
    slug: "renting-a-scooter-in-bali",
    title: "Renting a scooter in Bali",
    description: "What you need to rent and ride a scooter in Bali: international driving permit, helmets, police checks, insurance and the latest rules for tourists.",
    standfirst: "Scooters are everywhere in Bali, and so are police checks. Here's what you need to ride legally and safely.",
    published: "2026-11-07",
    updated: "2026-11-07",
    related: ["indonesia/bali"],
    body: [
      { type: "h2", text: "The license you need" },
      {
        type: "p",
        text: "Your home license isn't enough on its own in Indonesia: you need an International Driving Permit (or an Indonesian license), and it must cover motorcycles. Get your IDP in your home country before you travel."
      },
      {
        type: "p",
        text: "Police do check. In May 2025 a three-day operation in Badung, which covers Canggu, Kuta, Seminyak and Uluwatu, cited 81 riders, 30 of them tourists, and seized 56 vehicles."
      },
      { type: "h2", text: "Rules for tourists may change" },
      {
        type: "p",
        text: "Bali's provincial government has proposed stopping short-stay tourists from renting motorbikes to ride themselves. As of our last check this was a proposal, not a rule in force. Ask the business about the current position before you book."
      },
      { type: "h2", text: "Helmets" },
      { type: "p", text: "Wear a helmet in good condition every time you ride, and make sure any passenger has one too." },
      { type: "h2", text: "Insurance" },
      {
        type: "p",
        text: "Check your travel insurance covers riding a motorbike in Indonesia with the license you hold. Riding without the right license, or without following the rules, can mean a claim is refused."
      },
      { type: "h2", text: "On the road" },
      {
        type: "ul",
        items: [
          "Indonesia drives on the left.",
          "Traffic is heavy and unpredictable, especially in the south. If you're not a confident rider, a car with a driver may suit you better.",
          "If you're in an accident, wait at the scene for the police, and report it at a police station.",
          "On Nyepi, Bali's day of silence, travel on the island stops for the day."
        ]
      },
      { type: "h2", text: "Before you ride away" },
      {
        type: "ul",
        items: [
          "Photograph the scooter with the business, including any existing damage.",
          "Check the brakes, tires and lights, and agree the deposit, fuel and return time.",
          "Save the business's phone or chat number."
        ]
      }
    ],
    sources: [S.ukId, S.auId, S.idLeft, S.baliChecks, S.baliBan]
  }
];

export function findGuide(slug: string): Guide | null {
  return GUIDES.find((guide) => guide.slug === slug) || null;
}

/** A guide in a language: its translated words (lib/rove/guides-i18n) over the English facts, else the English. */
export function localizedGuide(guide: Guide, locale: string): Guide & { locale: string } {
  const text = locale === "en" ? null : GUIDE_TRANSLATIONS[locale]?.[guide.slug];
  return text ? { ...guide, title: text.title, description: text.description, standfirst: text.standfirst, body: text.body, locale } : { ...guide, locale: "en" };
}

/** Every guide in a language (English where a guide isn't translated yet). */
export function localizedGuides(locale: string) {
  return GUIDES.map((guide) => localizedGuide(guide, locale));
}
