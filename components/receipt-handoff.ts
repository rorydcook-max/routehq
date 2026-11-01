"use client";

// A receipt photo picked on "Upload a receipt", carried to the money form on the next screen (same page load, no upload twice).
let pending: File | null = null;

export function setPendingReceipt(file: File | null) {
  pending = file;
}

export function takePendingReceipt(): File | null {
  const file = pending;
  pending = null;
  return file;
}
