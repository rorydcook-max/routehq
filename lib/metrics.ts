import type { Reminder, Rental, Transaction, Vehicle } from "@/lib/types";
import { isRevenueTransaction } from "@/lib/transaction-options";
import { businessToday } from "@/lib/business-time";

export function calculateDashboardMetrics({
  reminders,
  rentals,
  transactions,
  vehicles
}: {
  reminders: Reminder[];
  rentals: Rental[];
  transactions: Transaction[];
  vehicles: Vehicle[];
}) {
  // "This month" in business time - this used to add up every transaction ever recorded.
  const thisMonth = businessToday().slice(0, 7);
  return {
    monthlyRevenue: transactions
      .filter((transaction) => String(transaction.date || "").slice(0, 7) === thisMonth)
      .filter((transaction) =>
        isRevenueTransaction({
          amount: transaction.amount,
          isDeposit: transaction.isDeposit,
          type: transaction.rawType || transaction.type
        })
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0),
    outstandingPayments: rentals.reduce((sum, rental) => sum + rental.balance, 0),
    fleetProfit: vehicles.reduce((sum, vehicle) => sum + vehicle.profit, 0),
    activeRentals: rentals.filter((rental) => rental.status === "Active").length,
    availableVehicles: vehicles.filter((vehicle) => vehicle.status === "Available").length,
    maintenanceDue: vehicles.filter((vehicle) => vehicle.status === "Maintenance").length,
    highAlerts: reminders.filter((reminder) => reminder.severity === "High").length,
    averageUtilization: vehicles.length ? Math.round(vehicles.reduce((sum, vehicle) => sum + vehicle.utilization, 0) / vehicles.length) : 0
  };
}
