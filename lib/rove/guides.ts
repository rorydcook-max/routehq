import { ROVE_SOURCES as S, type Source } from "@/lib/rove/destinations";

/**
 * rove.rent's renter guides (task "roverent", 7 Nov 2026): short, practical, and sourced. English only for now.
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

export const GUIDES: Guide[] = [
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
