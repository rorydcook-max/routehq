import type { Customer, Reminder, Rental, TimelineEvent, Transaction, Vehicle } from "@/lib/types";

export const vehicles: Vehicle[] = [
  {
    id: "V-1001",
    plate: "BKK-4821",
    make: "Toyota",
    model: "Yaris Ativ",
    trim: "Smart",
    year: 2023,
    color: "Pearl White",
    status: "Rented",
    dailyRate: 1100,
    weeklyRate: 7000,
    monthlyRate: 22000,
    utilization: 92,
    lifecycleUtilization: 86,
    revenue: 286000,
    profit: 104500,
    mileage: 38420,
    nextService: "2026-05-28",
    taxExpiry: "2026-07-14",
    insuranceExpiry: "2026-06-02",
    financeDue: "2026-05-25",
    healthScore: 88,
    purchasePrice: 520000,
    estimatedValue: 420000
  },
  {
    id: "V-1002",
    plate: "BKK-7712",
    make: "Honda",
    model: "City",
    trim: "SV",
    year: 2022,
    color: "Meteoroid Gray",
    status: "Available",
    dailyRate: 1200,
    weeklyRate: 7600,
    monthlyRate: 23500,
    utilization: 74,
    lifecycleUtilization: 68,
    revenue: 214500,
    profit: 79200,
    mileage: 51210,
    nextService: "2026-06-08",
    taxExpiry: "2026-08-19",
    insuranceExpiry: "2026-09-03",
    financeDue: "2026-05-27",
    healthScore: 81,
    purchasePrice: 580000,
    estimatedValue: 490000
  },
  {
    id: "V-1003",
    plate: "HKT-2040",
    make: "Mitsubishi",
    model: "Xpander",
    trim: "GT",
    year: 2021,
    color: "Black Mica",
    status: "Maintenance",
    dailyRate: 1500,
    weeklyRate: 9400,
    monthlyRate: 28500,
    utilization: 68,
    lifecycleUtilization: 76,
    revenue: 238000,
    profit: 61400,
    mileage: 70260,
    nextService: "2026-05-18",
    taxExpiry: "2026-05-31",
    insuranceExpiry: "2026-05-24",
    financeDue: "2026-05-20",
    healthScore: 63,
    purchasePrice: 720000,
    estimatedValue: 590000
  },
  {
    id: "V-1004",
    plate: "CNX-9891",
    make: "Toyota",
    model: "Fortuner",
    trim: "Legender",
    year: 2024,
    color: "Silver",
    status: "Reserved",
    dailyRate: 2800,
    weeklyRate: 17500,
    monthlyRate: 62000,
    utilization: 86,
    lifecycleUtilization: 89,
    revenue: 496000,
    profit: 188000,
    mileage: 18600,
    nextService: "2026-07-01",
    taxExpiry: "2026-10-12",
    insuranceExpiry: "2026-11-18",
    financeDue: "2026-05-22",
    healthScore: 94,
    purchasePrice: 1450000,
    estimatedValue: 1250000
  }
];

export const rentals: Rental[] = [
  {
    id: "R-4208",
    customer: "Maya Jensen",
    vehicle: "Toyota Yaris Ativ",
    plate: "BKK-4821",
    start: "2026-04-18",
    end: "2026-06-18",
    status: "Active",
    location: "Bang Tao, Phuket",
    balance: 0,
    deposit: 10000,
    rentalRate: 22000
  },
  {
    id: "R-4211",
    customer: "Daniel Koh",
    vehicle: "Toyota Fortuner",
    plate: "CNX-9891",
    start: "2026-05-20",
    end: "2026-06-20",
    status: "Booked",
    location: "CNX Airport",
    balance: 62000,
    deposit: 15000,
    rentalRate: 62000
  },
  {
    id: "R-4192",
    customer: "Sofia Miller",
    vehicle: "Mitsubishi Xpander",
    plate: "HKT-2040",
    start: "2026-03-01",
    end: "2026-05-15",
    status: "Overdue",
    location: "Rawai, Phuket",
    balance: 18500,
    deposit: 12000,
    rentalRate: 28500
  }
];

export const customers: Customer[] = [
  {
    id: "C-9181",
    name: "Maya Jensen",
    phone: "+66 84 220 1184",
    nationality: "Denmark",
    lifetimeValue: 88000,
    documents: "Complete",
    openBalance: 0
  },
  {
    id: "C-9174",
    name: "Sofia Miller",
    phone: "+66 93 445 9021",
    nationality: "Germany",
    lifetimeValue: 142500,
    documents: "Missing License",
    openBalance: 18500
  },
  {
    id: "C-9202",
    name: "Daniel Koh",
    phone: "+66 61 772 1039",
    nationality: "Singapore",
    lifetimeValue: 62000,
    documents: "Missing Passport",
    openBalance: 62000
  }
];

export const transactions: Transaction[] = [
  {
    id: "T-8801",
    type: "Rental Income",
    vehicle: "BKK-4821",
    amount: 22000,
    date: "2026-05-01",
    note: "Monthly rental payment"
  },
  {
    id: "T-8807",
    type: "Maintenance",
    vehicle: "HKT-2040",
    amount: -8700,
    date: "2026-05-15",
    note: "Brake pads and oil service"
  },
  {
    id: "T-8810",
    type: "Finance Payment",
    vehicle: "CNX-9891",
    amount: -26500,
    date: "2026-05-16",
    note: "Monthly finance obligation"
  },
  {
    id: "T-8814",
    type: "Deposit",
    vehicle: "CNX-9891",
    amount: 15000,
    date: "2026-05-17",
    note: "Booking deposit received"
  }
];

export const reminders: Reminder[] = [
  {
    id: "A-101",
    title: "Insurance expires in 6 days",
    target: "HKT-2040 Mitsubishi Xpander",
    due: "2026-05-24",
    severity: "High",
    type: "Compliance"
  },
  {
    id: "A-102",
    title: "Finance payment due",
    target: "CNX-9891 Toyota Fortuner",
    due: "2026-05-22",
    severity: "Medium",
    type: "Payment"
  },
  {
    id: "A-103",
    title: "Rental overdue",
    target: "Sofia Miller",
    due: "2026-05-15",
    severity: "High",
    type: "Rental"
  },
  {
    id: "A-104",
    title: "Service due today",
    target: "HKT-2040 Mitsubishi Xpander",
    due: "2026-05-18",
    severity: "High",
    type: "Maintenance"
  }
];

export const timeline: TimelineEvent[] = [
  {
    id: "L-01",
    vehicle: "BKK-4821",
    title: "Payment received",
    date: "2026-05-01",
    detail: "Monthly rental payment posted and profitability updated."
  },
  {
    id: "L-02",
    vehicle: "HKT-2040",
    title: "Service completed",
    date: "2026-05-15",
    detail: "Oil service and brake pads recorded with receipt attached."
  },
  {
    id: "L-03",
    vehicle: "CNX-9891",
    title: "Rental booked",
    date: "2026-05-17",
    detail: "Public intake link completed, deposit captured, contract pending signature."
  }
];

export const money = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0
  }).format(value);
