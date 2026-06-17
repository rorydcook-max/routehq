export type VehicleStatus = "Rented" | "Available" | "Maintenance" | "Reserved";

export type Vehicle = {
  id: string;
  plate: string;
  make: string;
  model: string;
  trim: string;
  year: number;
  color: string;
  status: VehicleStatus;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  utilization: number;
  lifecycleUtilization: number;
  revenue: number;
  profit: number;
  mileage: number;
  nextService: string;
  taxExpiry: string;
  insuranceExpiry: string;
  financeDue: string;
  healthScore: number;
  purchasePrice: number;
  estimatedValue: number;
};

export type Rental = {
  id: string;
  customer: string;
  vehicle: string;
  plate: string;
  start: string;
  end: string;
  status: "Active" | "Due Soon" | "Overdue" | "Booked";
  location: string;
  balance: number;
  deposit: number;
  rentalRate: number;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  nationality: string;
  lifetimeValue: number;
  documents: string;
  openBalance: number;
};

export type Transaction = {
  id: string;
  type: "Rental Income" | "Repair" | "Maintenance" | "Fuel" | "Insurance" | "Tax" | "Finance Payment" | "Fine" | "Accessories" | "Refund" | "Deposit" | "Deposit received" | "Deposit refunded" | "Deposit forfeited (kept)" | "Deposit deduction";
  rawType?: string;
  isDeposit?: boolean;
  vehicle: string;
  amount: number;
  date: string;
  note: string;
};

export type Reminder = {
  id: string;
  title: string;
  target: string;
  due: string;
  severity: "High" | "Medium" | "Low";
  type: "Payment" | "Compliance" | "Maintenance" | "Rental";
};

export type TimelineEvent = {
  id: string;
  vehicle: string;
  title: string;
  date: string;
  detail: string;
};
