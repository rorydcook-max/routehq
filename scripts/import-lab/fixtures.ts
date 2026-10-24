/**
 * Realistic sheets small rental operators in Thailand keep, each with what the owner would expect to see after
 * importing it. Dates are relative to today so the fixtures don't go stale.
 */
import { dMon, dMonY, dmy, dmyBE, iso, monDthY, monthTab, noProblem, rentalHas, moneyKinds, moneyNote, same, thaiMonthTab, thaiShort, vehicleHas, vehicle, rentalOn, type Check, type Tab } from "./helpers";
import type { ImportPreview } from "@/lib/import/preview";

export type Fixture = {
  name: string;
  about: string;
  tabs?: Tab[];
  csv?: string;
  filename?: string;
  expect: Expect;
  /** What the AI should add on top of the rules (run with --ai); otherwise `expect` holds for both. */
  expectAi?: Expect;
  /** Corrections this business made before (heading -> field, cost description -> kind). */
  learned?: { columns?: Record<string, string>; costs?: Record<string, string> };
};
/** `questions`: the quick questions the import screen should ask (their kinds), when given. */
type Expect = { vehicles?: number; rentals?: number; customers?: number; transactions?: number; checks?: Check[]; questions?: string[] };

const plusDays = (date: string, days: number) => {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
};

const plusMonths = (date: string, months: number) => {
  const day = new Date(`${date}T00:00:00Z`);
  const dom = day.getUTCDate();
  day.setUTCDate(1);
  day.setUTCMonth(day.getUTCMonth() + months);
  day.setUTCDate(Math.min(dom, new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)).getUTCDate()));
  return day.toISOString().slice(0, 10);
};

export const FIXTURES: Fixture[] = [
  {
    name: "thai-fleet",
    about: "Thai-only fleet list: Buddhist years, units in cells, ค่าเช่า/เดือน",
    tabs: [{
      name: "รถทั้งหมด",
      rows: [
        ["ทะเบียน", "ยี่ห้อ", "รุ่น", "ปี", "สี", "เลขไมล์", "ค่าเช่า/เดือน", "ภาษีหมดอายุ", "พ.ร.บ. หมดอายุ"],
        ["กข 1234", "Toyota", "Yaris", "2565", "ขาว", "45,000", "12,000", dmyBE(140), dmyBE(140)],
        ["2กค 5678", "Honda", "City", "2563", "ดำ", "80,500 กม.", "11,000 บาท", dmyBE(40), dmyBE(40)],
        ["ขจ 9012", "Nissan", "Almera", "2566", "เทา", "30000", "10,500", "", ""]
      ]
    }],
    expect: {
      vehicles: 3, rentals: 0,
      checks: [
        vehicleHas("กข 1234", { make: "Toyota", model: "Yaris", year: 2022, mileage: 45000, monthlyRate: 12000 }),
        vehicleHas("2กค 5678", { year: 2020, mileage: 80500, monthlyRate: 11000 }),
        noProblem("no_mileage")
      ]
    }
  },
  {
    name: "title-rows",
    about: "A title and an 'updated' note above the headers",
    tabs: [{
      name: "Fleet",
      rows: [
        ["SamuiCar Fleet List", "", "Updated 01/10/2026"],
        [],
        ["Plate", "Make", "Model", "Year", "Colour", "Price per month", "Notes"],
        ["กข 1111", "Toyota", "Vios", 2019, "White", 9500, "new tyres"],
        ["กข 2222", "Honda", "Jazz", 2018, "Red", 9000, ""],
        ["กข 3333", "Mazda", "2", 2020, "Blue", 10000, ""]
      ]
    }],
    expect: { vehicles: 3, checks: [vehicleHas("กข 1111", { make: "Toyota", model: "Vios", year: 2019, monthlyRate: 9500 }), vehicleHas("กข 3333", { make: "Mazda", model: "2" })] }
  },
  {
    name: "bike-daily",
    about: "Motorbike shop rental log: days instead of an end date, price per day, returned yes/no",
    tabs: [{
      name: "Rentals Oct",
      rows: [
        ["Date out", "Bike", "Plate", "Customer", "Passport", "Days", "Price/day", "Total", "Deposit", "Returned"],
        [dmy(-20), "Click 125i", "1กข 2345", "John Smith", "X1234567", 7, 250, 1750, 1000, "Yes"],
        [dmy(-3), "PCX 160", "2กท 1188", "Anna Müller", "C9988776", 14, 350, 4900, 2000, "No"],
        [dmy(-1), "NMAX", "3ขค 4455", "Ken Tanaka", "TK554433", 30, 300, 9000, 3000, "No"],
        [dmy(-40), "Click 125i", "1กข 2345", "Maria Garcia", "P1122334", 5, 250, 1250, 1000, "Yes"]
      ]
    }],
    expect: {
      rentals: 4, vehicles: 3, customers: 4,
      checks: [
        rentalHas("2กท 1188", { startDate: iso(-3), endDate: iso(11), rate: 350, ratePeriod: "day", status: "active" }),
        (preview) => same("completed rentals", preview.rentals.filter((item) => item.status === "completed").length, 2),
        vehicleHas("1กข 2345", { make: "Honda", dailyRate: 250 }),
        noProblem("bad_date")
      ]
    }
  },
  {
    name: "tab-per-car",
    about: "One tab per car (named with the plate), income and expense columns, plus a summary tab",
    tabs: [
      {
        name: "Yaris กข 1234",
        rows: [
          ["Date", "Description", "Income", "Expense"],
          [dmy(-60), "Rent Aug - Tom", 12000, ""],
          [dmy(-55), "Oil change", "", 1500],
          [dmy(-30), "Rent Sep - Tom", 12000, ""],
          [dmy(-12), "New tyres x2", "", 4200]
        ]
      },
      {
        name: "Vios 2ขค 5678",
        rows: [
          ["Date", "Description", "Income", "Expense"],
          [dmy(-45), "Rent - Lisa", 11000, ""],
          [dmy(-20), "Insurance renewal", "", 18000],
          [dmy(-5), "Car wash", "", 200]
        ]
      },
      { name: "Summary", rows: [["Car", "Income", "Expense", "Profit"], ["Yaris กข 1234", 24000, 5700, 18300], ["Vios 2ขค 5678", 11000, 18200, -7200]] }
    ],
    expect: {
      vehicles: 2, transactions: 7,
      checks: [
        vehicleHas("กข 1234", { make: "Toyota", model: "Yaris" }),
        moneyKinds({ rental_income: 3, servicing: 1, maintenance: 2, insurance: 1 }),
        moneyNote("Oil change", "servicing", iso(-55)),
        noProblem("unknown_vehicle")
      ]
    }
  },
  {
    name: "tab-per-month",
    about: "Rent received, one Thai-named tab per month: date, plate, customer, amount",
    tabs: [
      { name: thaiMonthTab(-30), rows: [["วันที่", "ทะเบียน", "ชื่อลูกค้า", "ยอด", "หมายเหตุ"], [dmyBE(-35), "กข 1234", "สมชาย", "12,000", "โอน"], [dmyBE(-33), "2กค 5678", "John", "11,000", "เงินสด"], [dmyBE(-31), "ขจ 9012", "Anna", "10,500", "โอน"]] },
      { name: thaiMonthTab(0), rows: [["วันที่", "ทะเบียน", "ชื่อลูกค้า", "ยอด", "หมายเหตุ"], [dmyBE(-5), "กข 1234", "สมชาย", "12,000", "โอน"], [dmyBE(-3), "2กค 5678", "John", "11,000", "เงินสด"], [dmyBE(-1), "ขจ 9012", "Anna", "10,500", "โอน"]] }
    ],
    expect: { transactions: 6, vehicles: 3, checks: [moneyKinds({ rental_income: 6 }), (preview) => same("first payment date", preview.transactions[0]?.date, iso(-35))] }
  },
  {
    name: "booking-export",
    about: "Booking-system CSV: first/last name, country code, cancelled booking, total price",
    csv: [
      "Booking ID,Status,First Name,Last Name,Country Code,Phone,Vehicle,Pick-up Date,Drop-off Date,Daily Rate,Total,Paid",
      `B-101,Confirmed,Emma,Wilson,44,7700900123,Economy - Toyota Yaris (กข 1111),${iso(-2)} 10:00,${iso(5)} 10:00,900,6300,6300`,
      `B-102,Cancelled,Liam,Brown,61,412345678,Economy - Toyota Yaris (กข 1111),${iso(10)} 10:00,${iso(14)} 10:00,900,3600,0`,
      `B-103,Confirmed,Noah,Davis,1,2025550123,SUV - Toyota Fortuner (ขค 2222),${iso(3)} 09:00,${iso(10)} 09:00,1800,12600,2000`,
      `B-104,Returned,Olivia,Taylor,49,1701234567,SUV - Toyota Fortuner (ขค 2222),${iso(-20)} 09:00,${iso(-13)} 09:00,1800,12600,12600`
    ].join("\n"),
    expect: {
      rentals: 3, vehicles: 2,
      checks: [
        rentalHas("ขค 2222", { customerName: "Noah Davis", rate: 1800, ratePeriod: "day", status: "booked" }),
        (preview) => same("cancelled left out", preview.rentals.filter((item) => !item.include).length, 1)
      ]
    }
  },
  {
    name: "semicolon-csv",
    about: "CSV saved with ; separators, a byte-order mark and comma decimals",
    csv: "﻿Plate;Make;Model;Year;Mileage;Monthly price\nกข 4444;Toyota;Vios;2020;55000;\"9.500,00\"\nกข 5555;Honda;City;2021;42000;\"10.000,00\"\n",
    expect: { vehicles: 2, checks: [vehicleHas("กข 4444", { make: "Toyota", year: 2020, mileage: 55000, monthlyRate: 9500 })] }
  },
  {
    name: "quoted-newline-csv",
    about: "CSV with a line break inside a quoted note",
    csv: 'Plate,Make,Model,Notes\n"กข 6666",Honda,Jazz,"Scratch on door\nNeeds tyres"\n"กข 7777",Toyota,Yaris,""\n"กข 8888",Suzuki,Swift,"Fine"\n',
    expect: { vehicles: 3, checks: [vehicleHas("กข 7777", { make: "Toyota", model: "Yaris" })] }
  },
  {
    name: "duplicate-headers",
    about: "Costs list with two 'Date' columns (ordered and paid)",
    tabs: [{
      name: "Costs",
      rows: [
        ["Date", "Vehicle", "Item", "Amount", "Date"],
        [dmy(-30), "Yaris กข 1234", "Brake pads", 2400, dmy(-25)],
        [dmy(-10), "Yaris กข 1234", "Service", 3100, dmy(-9)]
      ]
    }],
    expect: { transactions: 2, checks: [moneyNote("Brake pads", "maintenance", iso(-30)), moneyNote("Service", "servicing", iso(-10))] }
  },
  {
    name: "merged-two-row-header",
    about: "Two header rows, the top one merged over groups (Vehicle / Current renter)",
    tabs: [{
      name: "Cars",
      merges: ["A1:C1", "D1:F1"],
      rows: [
        ["Vehicle", "", "", "Current renter", "", ""],
        ["Plate", "Model", "Year", "Name", "Phone", "Since"],
        ["กข 1010", "Yaris", 2019, "Tom Hardy", "081 234 5678", dmy(-50)],
        ["กข 2020", "Vios", 2018, "", "", ""],
        ["กข 3030", "Almera", 2021, "Sara Lee", "+66 89 111 2222", dmy(-10)]
      ]
    }],
    expect: {
      vehicles: 3, rentals: 2,
      checks: [vehicleHas("กข 1010", { make: "Toyota", model: "Yaris", year: 2019 }), rentalHas("กข 3030", { customerName: "Sara Lee", phone: "0891112222", startDate: iso(-10) })]
    }
  },
  {
    name: "costs-thai",
    about: "Thai costs log: Buddhist dates, Thai descriptions",
    tabs: [{
      name: "ค่าใช้จ่าย",
      rows: [
        ["วันที่", "ทะเบียน", "รายการ", "จำนวนเงิน"],
        [dmyBE(-90), "กข 1234", "เปลี่ยนน้ำมันเครื่อง", "1,200"],
        [dmyBE(-80), "กข 1234", "ซ่อมเบรก", "2,500"],
        [dmyBE(-70), "2กค 5678", "ต่อภาษี", "1,900"],
        [dmyBE(-60), "2กค 5678", "ประกันชั้น 1", "18,000"],
        [dmyBE(-50), "ขจ 9012", "ล้างรถ", "200"],
        [dmyBE(-40), "ขจ 9012", "เปลี่ยนยาง 4 เส้น", "8,000"],
        [dmyBE(-30), "กข 1234", "ค่าปรับจราจร", "500"],
        [dmyBE(-20), "2กค 5678", "ค่างวดรถ", "7,500"],
        [dmyBE(-10), "ขจ 9012", "ติดกล้องหน้ารถ", "1,500"]
      ]
    }],
    expect: {
      transactions: 9,
      checks: [
        moneyKinds({ servicing: 1, repair: 1, tax: 1, insurance: 1, maintenance: 2, fine: 1, finance: 1, accessories: 1 }),
        moneyNote("น้ำมันเครื่อง", "servicing", iso(-90)),
        moneyNote("ยาง", "maintenance")
      ]
    }
  },
  {
    name: "date-headings",
    about: "Rental log where each day's date is a heading row above that day's rentals",
    tabs: [{
      name: "Log",
      rows: [
        ["Bike", "Plate", "Customer", "Price/day", "Days"],
        [dmy(-12)],
        ["Click", "2กข 777", "Somchai", 250, 3],
        ["PCX", "1กท 555", "Mike", 350, 3],
        [dmy(-10)],
        ["Scoopy", "3กค 999", "Lena", 200, 7]
      ]
    }],
    expect: { rentals: 3, checks: [rentalHas("3กค 999", { startDate: iso(-10), endDate: iso(-3), rate: 200, ratePeriod: "day" }), rentalHas("2กข 777", { startDate: iso(-12) })] }
  },
  {
    name: "fleet-with-renters",
    about: "Owner's fleet sheet: one row per car with who has it now (one car free)",
    tabs: [{
      name: "Fleet",
      rows: [
        ["Plate", "Car", "Year", "Colour", "Monthly price", "Renter", "Phone", "Start", "End", "Rent", "Deposit", "Next payment", "Tax due", "Insurance due"],
        ["กข 1001", "Toyota Yaris", 2019, "White", 12000, "Tom", "0812345678", dmy(-100), "", 11000, 5000, dmy(6), dmy(120), dmy(200)],
        ["กข 1002", "Honda City", 2020, "Grey", 12000, "Anna", "0898765432", dmy(-40), dmy(50), 12000, 5000, dmy(20), dmy(300), dmy(310)],
        ["กข 1003", "Mazda 2", 2018, "Red", 10000, "", "", "", "", "", "", "", dmy(30), dmy(60)],
        ["กข 1004", "Ford Ranger", 2018, "White", 20000, "Dean", "0861112222", dmy(-365), "", 20000, 5000, dmy(-2), dmy(90), dmy(90)]
      ]
    }],
    expect: {
      vehicles: 4, rentals: 3, questions: [],
      checks: [
        vehicleHas("กข 1003", { make: "Mazda", monthlyRate: 10000 }),
        rentalHas("กข 1001", { rate: 11000, nextDue: iso(6), paidUntil: iso(5), deposit: 5000 }),
        rentalHas("กข 1004", { nextDue: iso(-2) })
      ]
    }
  },
  {
    name: "customers-list",
    about: "Customer list: name, nationality, passport, WhatsApp",
    tabs: [{
      name: "Customers",
      rows: [
        ["Name", "Nationality", "Passport No.", "WhatsApp", "Email", "Notes"],
        ["Tom Hardy", "British", "123456789", "+44 7700 900123", "tom@example.com", "good"],
        ["Anna Müller", "German", "C01X00T47", "+49 170 1234567", "", ""],
        ["สมชาย ใจดี", "Thai", "", "081 234 5678", "", "ลูกค้าประจำ"],
        ["Ken Tanaka", "Japanese", "TK1234567", "+81 90 1234 5678", "ken@example.jp", ""]
      ]
    }],
    expect: { customers: 4, vehicles: 0, checks: [(preview) => same("Thai phone", preview.customers[2]?.phone, "0812345678")] }
  },
  {
    name: "two-tables-one-tab",
    about: "One tab holding the fleet, then a titled expenses table under it",
    tabs: [{
      name: "Sheet1",
      rows: [
        ["Plate", "Make", "Model", "Year"],
        ["กข 1212", "Toyota", "Yaris", 2019],
        ["กข 3434", "Honda", "City", 2020],
        ["กข 5656", "Nissan", "Almera", 2021],
        [],
        ["Expenses"],
        ["Date", "Plate", "Item", "Amount"],
        [dmy(-20), "กข 1212", "Oil change", 1200],
        [dmy(-15), "กข 3434", "Wiper blades", 450],
        [dmy(-5), "กข 5656", "Bumper repair", 6500]
      ]
    }],
    expect: { vehicles: 3, transactions: 3, checks: [moneyKinds({ servicing: 1, maintenance: 1, repair: 1 }), vehicleHas("กข 5656", { model: "Almera" })] }
  },
  {
    name: "payment-grid-thai",
    about: "Thai master tab with rental status, and a sideways Thai payment grid",
    tabs: [
      {
        name: "รถ",
        rows: [
          ["ทะเบียน", "รถ", "ผู้เช่า", "เริ่มเช่า", "ค่าเช่า", "สถานะการเช่า"],
          ["กข 1234", "Toyota Yaris", "สมชาย", dmy(-95), "12,000", "TRUE"],
          ["2กค 5678", "Honda City", "John", dmy(-65), "11,000", "TRUE"],
          ["ขจ 9012", "Nissan Almera", "", "", "", "FALSE"]
        ]
      },
      {
        name: "การชำระเงิน",
        rows: [
          ["", "Toyota Yaris กข 1234", "", "", "Honda City 2กค 5678", "", "", "Nissan Almera ขจ 9012", "", ""],
          ["", "วันครบกำหนด", "จำนวนเงิน", "ได้รับแล้ว", "วันครบกำหนด", "จำนวนเงิน", "ได้รับแล้ว", "วันครบกำหนด", "จำนวนเงิน", "ได้รับแล้ว"],
          ["", dmy(-95), "12,000", "TRUE", dmy(-65), "11,000", "TRUE", "", "", ""],
          ["", dmy(-65), "12,000", "TRUE", dmy(-35), "11,000", "TRUE", "", "", ""],
          ["", dmy(-35), "12,000", "TRUE", dmy(-5), "11,000", "FALSE", "", "", ""],
          ["", dmy(-5), "12,000", "TRUE", dmy(25), "11,000", "FALSE", "", "", ""],
          ["", dmy(25), "12,000", "FALSE", "", "", "", "", "", ""]
        ]
      }
    ],
    expect: {
      vehicles: 3, rentals: 2, transactions: 6,
      checks: [moneyKinds({ rental_income: 6 }), rentalHas("กข 1234", { nextDue: iso(25) }), rentalHas("2กค 5678", { nextDue: iso(-5) })]
    }
  },
  {
    name: "payment-rows",
    about: "Rent payments one per row: car, due date, amount, paid?, paid on",
    tabs: [
      { name: "Cars", rows: [["Plate", "Car", "Renter", "Start", "Monthly rent"], ["กข 4545", "Toyota Vios", "Lisa", dmy(-70), 10000]] },
      {
        name: "Payments",
        rows: [
          ["Car", "Due date", "Amount", "Paid?", "Paid on"],
          ["กข 4545", dmy(-70), 10000, "Y", dmy(-69)],
          ["กข 4545", dmy(-40), 10000, "Y", dmy(-38)],
          ["กข 4545", dmy(-10), 10000, "N", ""],
          ["กข 4545", dmy(20), 10000, "N", ""]
        ]
      }
    ],
    expect: {
      rentals: 1, transactions: 2,
      checks: [rentalHas("กข 4545", { nextDue: iso(-10), rate: 10000 }), (preview) => same("paid-on date used", preview.transactions.map((item) => item.date), [iso(-69), iso(-38)])]
    }
  },
  {
    name: "income-expense-ledger",
    about: "One money ledger: date, description, car, money in, money out (incl. a business cost)",
    tabs: [{
      name: "Ledger",
      rows: [
        ["Date", "Description", "Car", "In", "Out"],
        [dmy(-40), "Rent from Tom", "กข 1234", 12000, ""],
        [dmy(-38), "Deposit from Tom", "กข 1234", 5000, ""],
        [dmy(-30), "Oil + filter", "กข 1234", "", 1400],
        [dmy(-20), "Office rent", "", "", 6000],
        [dmy(-10), "Rent from Anna", "2กค 5678", 11000, ""],
        [dmy(-2), "Windscreen chip repair", "2กค 5678", "", 900]
      ]
    }],
    expect: {
      transactions: 6,
      checks: [moneyKinds({ rental_income: 2, deposit_received: 1, servicing: 1, other: 1, repair: 1 }), moneyNote("Office rent", "other"), (preview) => same("office cost has no car", preview.transactions.find((item) => item.notes.includes("Office"))?.business, true)]
    }
  },
  {
    name: "messy-values",
    about: "Units and odd writing in cells: พ.ศ. years, '45,000 km', '12,000 บาท/เดือน', '8k'",
    tabs: [{
      name: "Cars",
      rows: [
        ["Reg", "Model", "Year", "Km", "Rate"],
        ["กข 1111", "Toyota Yaris Ativ", "พ.ศ. 2565", "45,000 km", "12,000 บาท/เดือน"],
        ["กข 2222", "Honda City", "2019", "62,300km", "8k/month"],
        ["กข 3333", "Suzuki Swift", "'20", "n/a", "฿8,500.-"]
      ]
    }],
    expect: {
      vehicles: 3, rentals: 0,
      checks: [
        vehicleHas("กข 1111", { make: "Toyota", model: "Yaris Ativ", year: 2022, mileage: 45000, monthlyRate: 12000 }),
        vehicleHas("กข 2222", { mileage: 62300, monthlyRate: 8000 }),
        vehicleHas("กข 3333", { year: 2020, mileage: null, monthlyRate: 8500 })
      ]
    }
  },
  {
    name: "rentals-messy-dates",
    about: "Rentals with every way of writing a date, and a monthly rent column",
    tabs: [{
      name: "Rentals",
      rows: [
        ["Customer", "Phone", "Car", "Plate", "From", "To", "Monthly rent", "Deposit"],
        ["Tom", "+66 81 234 5678", "Toyota Yaris", "กข 1", dMonY(-30), dMon(30), 12000, 5000],
        ["Anna", "089-876-5432", "Honda City", "กข 2", monDthY(-20), dmy(40, "."), 11000, 5000],
        ["Ken", "0861112222", "Mazda 2", "กข 3", dmy(-10, "-"), iso(50).replace(/-/g, "/"), 10000, 4000],
        ["สมชาย", "0812223333", "Nissan Almera", "กข 4", thaiShort(-5), thaiShort(85), 10500, 5000]
      ]
    }],
    expect: {
      rentals: 4, vehicles: 4,
      checks: [
        rentalHas("กข 1", { startDate: iso(-30), endDate: iso(30), rate: 12000, ratePeriod: "month", phone: "0812345678" }),
        rentalHas("กข 2", { startDate: iso(-20), endDate: iso(40) }),
        rentalHas("กข 3", { startDate: iso(-10), endDate: iso(50) }),
        rentalHas("กข 4", { startDate: iso(-5), endDate: iso(85) }),
        noProblem("bad_date")
      ]
    }
  },
  {
    name: "costs-other-languages",
    about: "Costs written in Russian, Chinese, German and odd English: the rules leave them, the AI places them",
    tabs: [{
      name: "Costs",
      rows: [
        ["Date", "Plate", "Description", "Amount"],
        [dmy(-30), "กข 1234", "Замена масла и фильтра", 1500],
        [dmy(-25), "กข 1234", "更换轮胎", 6000],
        [dmy(-20), "2กค 5678", "Reparatur Stoßstange hinten", 4500],
        [dmy(-15), "2กค 5678", "New rubbers all round", 7200],
        [dmy(-10), "กข 1234", "Zoom subscription", 500]
      ]
    }],
    expect: { transactions: 5, checks: [moneyKinds({ other: 5 })] },
    expectAi: { transactions: 5, checks: [moneyNote("Замена масла", "servicing"), moneyNote("更换轮胎", "maintenance"), moneyNote("Reparatur", "repair"), moneyNote("rubbers", "maintenance"), moneyNote("Zoom", "other")] }
  },
  {
    name: "american-dates",
    about: "A US-style export: 11/05/2026 means 5 November, which a date like 10/22/2026 in the same sheet settles",
    csv: [
      "Customer,Vehicle,Plate,Pickup,Return,Daily rate",
      "Amy,Toyota Yaris,กข 7001,10/22/2026,11/05/2026,1200",
      "Ben,Honda City,กข 7002,11/02/2026,11/09/2026,1100"
    ].join("\n"),
    expect: {
      rentals: 2, questions: [],
      checks: [rentalHas("กข 7001", { startDate: "2026-10-22", endDate: "2026-11-05" }), rentalHas("กข 7002", { startDate: "2026-11-02", endDate: "2026-11-09" })]
    }
  },
  {
    name: "ambiguous-dates",
    about: "Every date could be either way round (03/04/2026): read day first, and asked about",
    csv: ["Customer,Car,Plate,From,To,Price per day", "Cara,Mazda 2,กข 7101,03/04/2026,08/04/2026,900", "Dan,Toyota Vios,กข 7102,05/06/2026,09/06/2026,850"].join("\n"),
    expect: { rentals: 2, questions: ["date_order"], checks: [rentalHas("กข 7101", { startDate: "2026-04-03", endDate: "2026-04-08" })] }
  },
  {
    name: "unclear-rent",
    about: "A 'Rent' column whose figures could be per day or per month (฿2,500 for two months): asked about",
    tabs: [{ name: "Rentals", rows: [["Customer", "Bike", "Plate", "Start", "End", "Rent"], ["Joe", "Click", "1กก 1111", dmy(-20), dmy(40), 2500], ["Kim", "PCX", "1กก 2222", dmy(-5), dmy(55), 3500]] }],
    expect: { rentals: 2, questions: ["rate_period"] }
  },
  {
    name: "learned-corrections",
    about: "A business's past corrections: 'Rego' is the plate, 'Lot' is ignored, 'Lazada order' is accessories",
    tabs: [
      { name: "Cars", rows: [["Rego", "Make", "Model", "Lot"], ["กข 1515", "Toyota", "Vios", "A3"], ["กข 2626", "Honda", "City", "B1"]] },
      { name: "Costs", rows: [["Date", "Rego", "Item", "Amount"], [dmy(-9), "กข 1515", "Lazada order", 890], [dmy(-4), "กข 2626", "Oil change", 1300]] }
    ],
    learned: { columns: { rego: "registration_number", lot: "__ignore__" }, costs: { "lazada order": "accessories" } },
    expect: {
      vehicles: 2, transactions: 2,
      checks: [vehicleHas("กข 1515", { make: "Toyota", extra: {} }), moneyNote("Lazada", "accessories"), moneyNote("Oil change", "servicing")]
    }
  },
  {
    name: "headerless-notebook",
    about: "A notebook typed into a sheet: no heading row, just bike, plate, name, phone, out, back, price",
    tabs: [{
      name: "Sheet1",
      rows: [
        ["Click 125i", "2กข 777", "Somchai", "081 234 5678", dmy(-12), dmy(-9), 250],
        ["PCX", "1กท 555", "Mike Jones", "089 999 8888", dmy(-5), dmy(9), 350],
        ["Scoopy", "3กค 999", "Lena", "+66 86 123 4567", dmy(-2), dmy(5), 200]
      ]
    }],
    expect: {
      rentals: 3, vehicles: 3,
      checks: [
        rentalHas("1กท 555", { customerName: "Mike Jones", phone: "0899998888", startDate: iso(-5), endDate: iso(9), rate: 350, ratePeriod: "day" }),
        vehicleHas("2กข 777", { make: "Honda", model: "Click 125i" })
      ]
    }
  },
  {
    name: "province-plates-bikes",
    about: "Thai motorbike fleet: plates with their province, daily and weekly prices, no renters",
    tabs: [{
      name: "มอเตอร์ไซค์",
      rows: [
        ["ทะเบียน", "รุ่น", "ปี", "ราคาต่อวัน", "ราคาต่อสัปดาห์", "ราคาต่อเดือน"],
        ["1กข 2345 สุราษฎร์ธานี", "Click 125i", "2566", "250", "1,500", "4,500"],
        ["2กท 1188 สุราษฎร์ธานี", "PCX 160", "2567", "350", "2,100", "6,500"],
        ["3ขค 4455 กรุงเทพมหานคร", "NMAX", "2565", "300", "1,800", "5,500"]
      ]
    }],
    expect: {
      vehicles: 3, rentals: 0,
      checks: [
        vehicleHas("1กข 2345 สุราษฎร์ธานี", { make: "Honda", model: "Click 125i", year: 2023, dailyRate: 250, weeklyRate: 1500, monthlyRate: 4500 }),
        vehicleHas("3ขค 4455 กรุงเทพมหานคร", { make: "Yamaha" })
      ]
    }
  },
  {
    name: "owner-master-grid-costs",
    about: "Like Rory's sheet: master with Rental Status, English payment grid with a totals column, costs with descriptions",
    tabs: [
      {
        name: "Master",
        rows: [
          ["License Plate", "Rental Status", "Make", "Model", "Year", "Colour", "Monthly Rate", "Rented By", "Rental Start", "Rental End", "Deposit"],
          ["ขษ5168", "TRUE", "Ford", "Ranger", 2018, "White", 20000, "Dean White", dmy(-370), dmy(-5), 5000],
          ["กษ4562", "TRUE", "Toyota", "Yaris", 2017, "White", 11000, "Hannah H", dmy(-90), "", 4000],
          ["ผห4417", "FALSE", "Mazda", "BT-50 Pro", 2014, "Black", 15000, "", "", "", ""],
          ["", "FALSE", "", "", "", "", "฿0.00", "", "", "", ""],
          ["Totals", "", "", "", "", "", "", "", "", "", ""]
        ]
      },
      {
        name: "Payment Records",
        rows: [
          ["Totals", "", "", "Ford Ranger Wildtrak - 2018 - White - ขษ5168", "", "", "", "Toyota Yaris - 2017 - White - กษ4562", "", "", "", "Mazda BT50 Pro - 2014 - Black - ผห4417", "", "", ""],
          ["", "", "", "[NAME]", "", "", "", "[NAME]", "", "", "", "[NAME]", "", "", ""],
          ["Vehicle", "Paid", "", "Payment Due Date", "Amount", "Received", "Receipt", "Payment Due Date", "Amount", "Received", "Receipt", "Payment Due Date", "Amount", "Received", "Receipt"],
          ["Ranger", "฿40,000", "", dmy(-65), "฿20,000.00", "TRUE", "", dmy(-90), "฿11,000.00", "TRUE", "", "", "", "FALSE", ""],
          ["Yaris", "฿33,000", "", dmy(-35), "฿20,000.00", "TRUE", "", dmy(-60), "฿11,000.00", "TRUE", "", "", "", "FALSE", ""],
          ["", "", "", dmy(-3), "฿60,000.00", "TRUE", "", dmy(-30), "฿11,000.00", "TRUE", "", "", "", "FALSE", ""],
          ["", "", "", "", "", "FALSE", "", dmy(0), "฿11,000.00", "FALSE", "", "", "", "FALSE", ""]
        ]
      },
      {
        name: "Transactions",
        rows: [
          ["Date", "Purchase", "Vehicle", "Cost", "Notes", "", "Totals", ""],
          ["", "GPS & Dashcam", "2017 Toyota Yaris กษ4562", "฿3,500.00", "", "", "2018 Ford Ranger ขษ5168", "฿4,000"],
          [dmy(-50), "Front Wipers", "2017 Toyota Yaris กษ4562", "฿383.70", "", "", "2017 Toyota Yaris กษ4562", "฿3,884"],
          [dmy(-40), "Insurance Excess for bumper repair claim", "2018 Ford Ranger ขษ5168", "฿3,000.00", "", "", "", ""],
          [dmy(-30), "Deposit for windshield trim", "2018 Ford Ranger ขษ5168", "฿1,000.00", "", "", "", ""],
          [dmy(-20), "File Binders", "NON-VEHICLE PURCHASE", "฿1,405.44", "", "", "", ""],
          [dmy(-10), "Car Purchase - BT50", "2014 Mazda BT-50 Pro ผห4417", "฿300,000.00", "", "", "", ""]
        ]
      }
    ],
    expect: {
      vehicles: 3, rentals: 2,
      checks: [
        rentalHas("ขษ5168", { endDate: null, nextDue: plusMonths(iso(-3), 3) }),
        rentalHas("กษ4562", { nextDue: iso(0) }),
        moneyKinds({ rental_income: 6, accessories: 1, maintenance: 1, insurance: 1, repair: 1, other: 1 }),
        moneyNote("GPS", "accessories", iso(-50)),
        (preview) => same("purchase listed but left out", preview.transactions.filter((item) => !item.include).length, 1)
      ]
    }
  }
];

void plusDays;
void monthTab;
void vehicle;
void rentalOn;
export type { ImportPreview };
