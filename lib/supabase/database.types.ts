export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type TableDef<Row> = {
  Row: Row;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
};

type TenantRow = {
  id: string;
  organization_id: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
};

type OrganizationRole = "owner" | "manager" | "operator" | "accountant" | "driver";
type VehicleStatus = "available" | "rented" | "maintenance" | "reserved" | "inactive" | "retired";
type AvailabilityStatus = "available_now" | "reserved" | "rented" | "blocked" | "offline";
type ServiceArea = "home_branch" | "all_branches";
type RentalStatus = "draft" | "booked" | "active" | "due_soon" | "overdue" | "extended" | "completed" | "cancelled";
type PricingModel = "hourly" | "daily" | "weekly" | "monthly" | "subscription" | "custom";
type PaymentStatus = "scheduled" | "pending" | "paid" | "failed" | "overdue" | "cancelled" | "refunded" | "reconciled" | "voided" | "waived";
type TransactionType =
  | "rental_income"
  | "repair"
  | "servicing"
  | "maintenance"
  | "fuel"
  | "insurance"
  | "tax"
  | "finance"
  | "fine"
  | "accessories"
  | "refund"
  | "deposit"
  | "deposit_received"
  | "deposit_refunded"
  | "deposit_forfeited"
  | "deposit_deduction"
  | "other";
type DocumentOwnerType = "vehicle" | "customer" | "rental" | "transaction" | "inspection" | "contract" | "invoice" | "organization";
type InspectionType = "delivery" | "return" | "maintenance" | "incident" | "periodic" | "condition_report";
type ReminderType = "payment" | "compliance" | "maintenance" | "rental" | "inspection" | "contract" | "gps";
type ReminderSeverity = "low" | "medium" | "high" | "critical";
type ActivityEntityType = "vehicle" | "customer" | "rental" | "payment" | "transaction" | "document" | "maintenance" | "compliance" | "inspection" | "contract" | "invoice" | "reminder" | "notification" | "task" | "gps_device" | "organization";
type NotificationChannel = "whatsapp" | "line" | "messenger" | "email" | "sms" | "push" | "in_app";
type NotificationStatus = "draft" | "queued" | "sent" | "delivered" | "failed" | "cancelled";
type TemplateType = "notification" | "contract" | "message" | "invoice" | "inspection_form" | "onboarding_form";
type RentalDocumentType =
  | "rental_agreement"
  | "agreement_amendment"
  | "delivery_report"
  | "return_report"
  | "vehicle_substitution"
  | "extension_amendment"
  | "early_termination_statement"
  | "incident_report"
  | "deposit_reconciliation"
  | "final_rental_pack";
type RentalDocumentStatus = "draft" | "generated" | "partially_signed" | "signed" | "finalised" | "voided" | "superseded";
type RentalDocumentVersionStatus = "draft" | "rendered" | "finalised" | "signed" | "superseded" | "voided";
type RentalDocumentSignerRole = "authorised_business_signatory" | "operator" | "renter" | "additional_driver" | "witness";
type ContractAuthorityMode = "legacy" | "rental_document_engine";
type RentalAmendmentApprovalStatus = "pending" | "approved" | "rejected" | "cancelled" | "superseded";
type DepositReconciliationStatus = "held" | "partially_refunded" | "fully_refunded" | "retained_pending_assessment" | "reconciled";
type InspectionMediaType = "photo" | "video" | "odometer_photo" | "fuel_photo" | "damage_photo" | "walkaround_video" | "other";

export type Database = {
  public: {
    Tables: {
      organizations: TableDef<{
        id: string;
        name: string;
        slug: string;
        country_code: string;
        timezone: string;
        default_locale: string;
        fallback_locale: string;
        currency: string;
        supported_locales: string[];
        supported_currencies: string[];
        settings: Json;
        onboarding_completed: boolean;
        onboarding_completed_at: string | null;
        onboarding_skipped: boolean;
        trial_started_at: string | null;
        trial_ends_at: string | null;
        subscription_status: "trial" | "active" | "past_due" | "paused" | "cancelled" | "expired";
        subscription_tier: "starter" | "growth" | "pro" | "business";
        subscription_started_at: string | null;
        next_payment_due: string | null;
        payment_method: string | null;
        logo_url: string | null;
        business_logo_storage_bucket: string | null;
        business_logo_storage_path: string | null;
        owner_signature_url: string | null;
        trading_name: string | null;
        legal_name: string | null;
        registration_or_tax_number: string | null;
        business_address: string | null;
        business_phone: string | null;
        business_email: string | null;
        whatsapp: string | null;
        line_id: string | null;
        contract_accent_colour: string | null;
        authorised_signatory_name: string | null;
        authorised_signatory_title: string | null;
        authorised_signature_storage_bucket: string | null;
        authorised_signature_storage_path: string | null;
        signature_authorised_at: string | null;
        signature_authorisation_text_version: string | null;
        default_contract_locale: string | null;
        default_contract_template_id: string | null;
        contract_footer_text: string | null;
        powered_by_routehq_enabled: boolean;
        created_by: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      onboarding_checklist: TableDef<{
        id: string;
        organization_id: string;
        step: string;
        completed: boolean;
        completed_at: string | null;
        created_at: string;
      }>;
      users: TableDef<{
        id: string;
        full_name: string | null;
        preferred_locale: string;
        preferred_calendar: string;
        timezone: string | null;
        avatar_url: string | null;
        created_at: string;
        updated_at: string;
      }>;
      organization_members: TableDef<TenantRow & {
        user_id: string;
        role: OrganizationRole;
        display_name: string | null;
        invited_email: string | null;
        is_active: boolean;
      }>;
      platform_admins: TableDef<{
        user_id: string;
        display_name: string | null;
        created_by: string | null;
        created_at: string;
      }>;
      branches: TableDef<{
        id: string;
        organization_id: string;
        name: string;
        address: string | null;
        latitude: number | null;
        longitude: number | null;
        phone: string | null;
        email: string | null;
        is_active: boolean;
        created_at: string;
      }>;
      vehicle_categories: TableDef<{
        id: string;
        organization_id: string | null;
        code: string;
        name: string;
        description: string | null;
        icon: string | null;
        sort_order: number;
        is_system: boolean;
        created_at: string;
        updated_at: string;
      }>;
      vehicle_types: TableDef<{
        id: string;
        organization_id: string | null;
        category_id: string;
        code: string;
        name: string;
        default_spec_schema: Json;
        created_at: string;
        updated_at: string;
      }>;
      vehicle_makes: TableDef<{
        id: string;
        name: string;
        slug: string;
        origin_country: string | null;
        logo_url: string | null;
        is_active: boolean;
        sort_order: number;
        created_at: string;
      }>;
      vehicle_models: TableDef<{
        id: string;
        make_id: string;
        name: string;
        category_code: string;
        body_type: string | null;
        is_active: boolean;
        created_at: string;
      }>;
      vehicle_trims: TableDef<{
        id: string;
        model_id: string;
        name: string;
        year_from: number;
        year_to: number | null;
        engine_cc: number | null;
        transmission: string | null;
        fuel_type: string | null;
        seating_capacity: number | null;
        drivetrain: string | null;
        source: string;
        verification_status: string;
        confidence_score: number | null;
        raw_ai_payload: Json | null;
        is_active: boolean;
        created_at: string;
      }>;
      vehicle_catalog_submissions: TableDef<TenantRow & {
        submitted_by: string | null;
        status: string;
        make_name: string;
        model_name: string | null;
        trim_name: string | null;
        category_code: string | null;
        year_from: number | null;
        year_to: number | null;
        engine_cc: number | null;
        transmission: string | null;
        fuel_type: string | null;
        seating_capacity: number | null;
        drivetrain: string | null;
        notes: string | null;
        curator_notes: string | null;
        research_status: string | null;
        research_payload: Json | null;
        research_sources: Json | null;
        researched_at: string | null;
      }>;
      customers: TableDef<TenantRow & {
        display_code: string | null;
        full_name: string;
        date_of_birth: string | null;
        email: string | null;
        phone: string | null;
        whatsapp: string | null;
        nationality: string | null;
        preferred_locale: string;
        preferred_currency: string | null;
        address: string | null;
        hotel_name: string | null;
        license_type: string | null;
        passport_number: string | null;
        passport_expiry: string | null;
        driver_license_number: string | null;
        driver_license_expiry: string | null;
        driver_license_country: string | null;
        emergency_contact_name: string | null;
        emergency_contact_phone: string | null;
        document_status: string;
        lifetime_value: number;
        open_balance: number;
        notes: string | null;
        created_by: string | null;
      }>;
      vehicles: TableDef<TenantRow & {
        category_id: string;
        type_id: string | null;
        display_code: string | null;
        make: string;
        model: string;
        trim: string | null;
        year: number | null;
        vin: string | null;
        registration_number: string;
        color: string | null;
        purchase_price: number | null;
        purchase_date: string | null;
        estimated_value: number | null;
        mileage: number;
        status: VehicleStatus;
        availability_status: AvailabilityStatus;
        home_branch_id: string | null;
        service_area: ServiceArea;
        partner_network_enabled: boolean;
        current_customer_id: string | null;
        current_rental_id: string | null;
        daily_rate: number;
        weekly_rate: number;
        monthly_rate: number;
        utilization_12_month: number;
        utilization_lifecycle: number;
        revenue_generated: number;
        profit_generated: number;
        health_score: number;
        specifications: Json;
        metadata: Json;
        created_by: string | null;
      }>;
      rentals: TableDef<TenantRow & {
        display_code: string | null;
        reference: string | null;
        customer_id: string;
        vehicle_id: string;
        start_date: string;
        end_date: string | null;
        is_indefinite: boolean;
        status: RentalStatus;
        pricing_model: PricingModel;
        recurring_billing: boolean;
        billing_interval: string | null;
        rental_rate: number;
        contracted_rate: number | null;
        billing_period: string | null;
        standard_daily_rate: number | null;
        early_termination_minimum_days: number | null;
        delivery_fee: number | null;
        collection_fee: number | null;
        cancellation_admin_fee: number | null;
        insurance_excess: number | null;
        mileage_allowance: number | null;
        excess_mileage_rate: number | null;
        deposit_amount: number;
        deposit_held: number;
        deposit_status: "pending" | "received" | "partially_returned" | "fully_returned" | "forfeited" | "partially_forfeited";
        deposit_received_at: string | null;
        deposit_refunded_amount: number;
        deposit_forfeited_amount: number;
        deposit_deduction_reason: string | null;
        deposit_reconciled_at: string | null;
        deposit_reconciled_by: string | null;
        balance_due: number;
        currency: string;
        delivery_method: "delivery" | "collection" | "tbd";
        delivery_location: string | null;
        delivery_datetime: string | null;
        return_location: string | null;
        contract_id: string | null;
        contract_authority_mode: ContractAuthorityMode;
        rental_document_executed_at: string | null;
        mileage_at_delivery: number | null;
        mileage_at_return: number | null;
        km_driven: number | null;
        created_by: string | null;
      }>;
      rental_extensions: TableDef<TenantRow & { rental_id: string; previous_end_date: string | null; new_end_date: string | null; rate_override: number | null; reason: string | null; created_by: string | null }>;
      rental_payments: TableDef<TenantRow & {
        rental_id: string;
        customer_id: string;
        vehicle_id: string;
        provider: string | null;
        provider_payment_id: string | null;
        payment_method: string | null;
        scheduled_date: string | null;
        due_date: string;
        paid_at: string | null;
        status: PaymentStatus;
        amount: number;
        currency: string;
        attempt_count: number;
        reconciliation_reference: string | null;
        metadata: Json;
      }>;
      transactions: TableDef<TenantRow & {
        display_code: string | null;
        vehicle_id: string;
        rental_id: string | null;
        customer_id: string | null;
        rental_payment_id: string | null;
        type: TransactionType;
        amount: number;
        currency: string;
        transaction_date: string;
        supplier: string | null;
        mileage: number | null;
        notes: string | null;
        receipt_document_id: string | null;
        metadata: Json;
        is_deposit: boolean;
        deposit_rental_id: string | null;
        created_by: string | null;
      }>;
      maintenance_events: TableDef<TenantRow & { vehicle_id: string; transaction_id: string | null; event_type: string; service_date: string; mileage: number | null; cost: number | null; supplier: string | null; notes: string | null; next_due_date: string | null; next_due_mileage: number | null; created_by: string | null }>;
      compliance_events: TableDef<TenantRow & { vehicle_id: string; transaction_id: string | null; compliance_type: string; effective_date: string | null; expiry_date: string; cost: number | null; provider: string | null; policy_number: string | null; notes: string | null; created_by: string | null }>;
      inspections: TableDef<TenantRow & { rental_id: string | null; vehicle_id: string; customer_id: string | null; inspection_type: InspectionType; type: "delivery" | "return" | "condition_report"; status: "draft" | "submitted"; inspected_at: string; mileage: number | null; odometer_reading: number | null; fuel_level: number | null; fuel_level_label: string | null; damage_markers: Json; damage_items: Json; photos: Json; video_url: string | null; customer_signature: string | null; customer_signed_at: string | null; customer_signed_name: string | null; notes: string | null; submitted_at: string | null; submitted_by: string | null; photo_document_ids: string[]; video_document_ids: string[]; completed_by: string | null }>;
      booking_links: TableDef<TenantRow & {
        rental_id: string | null;
        vehicle_id: string | null;
        customer_id: string | null;
        contract_id: string | null;
        token: string;
        status: string;
        data_type: string;
        delivery_method: "delivery" | "collection" | "tbd";
        booking_data: Json;
        included_items: Json;
        special_conditions: string | null;
        share_channels: Json;
        public_url: string | null;
        expires_at: string | null;
        sent_at: string | null;
        viewed_at: string | null;
        customer_details_submitted_at: string | null;
        documents_uploaded_at: string | null;
        contract_signed_at: string | null;
        completed_at: string | null;
        cancelled_at: string | null;
        created_by: string | null;
      }>;
      contracts: TableDef<TenantRow & {
        rental_id: string | null;
        booking_link_id: string | null;
        customer_id: string | null;
        locale: string;
        status: string;
        template_id: string | null;
        document_id: string | null;
        content_html: string | null;
        content_pdf_url: string | null;
        customer_signature: string | null;
        customer_signed_at: string | null;
        customer_signed_name: string | null;
        customer_signed_ip: string | null;
        owner_signature: string | null;
        owner_signed_at: string | null;
        signed_at: string | null;
        metadata: Json;
      }>;
      invoices: TableDef<TenantRow & { rental_id: string | null; customer_id: string; invoice_number: string; locale: string; currency: string; subtotal: number; tax_amount: number; total: number; balance_due: number; due_date: string | null; status: string; document_id: string | null }>;
      documents: TableDef<TenantRow & { owner_type: DocumentOwnerType; owner_id: string | null; storage_bucket: string; storage_path: string; file_name: string; mime_type: string | null; size_bytes: number | null; category: string; locale: string | null; ocr_status: string; ocr_provider: string | null; extracted_data: Json; uploaded_by: string | null }>;
      rental_documents: TableDef<{
        id: string;
        organization_id: string;
        rental_id: string;
        legacy_contract_id: string | null;
        document_type: RentalDocumentType;
        status: RentalDocumentStatus;
        current_version_id: string | null;
        source_event_type: string | null;
        source_event_id: string | null;
        created_by: string | null;
        created_at: string;
        updated_at: string;
        finalised_at: string | null;
      }>;
      rental_document_versions: TableDef<{
        id: string;
        organization_id: string;
        document_id: string;
        version_number: number;
        template_id: string | null;
        template_version: number | null;
        rendered_html_snapshot: string;
        rendered_data_snapshot: Json;
        business_snapshot: Json;
        pdf_storage_bucket: string | null;
        pdf_storage_path: string | null;
        draft_pdf_storage_bucket: string | null;
        draft_pdf_storage_path: string | null;
        draft_pdf_generated_at: string | null;
        final_pdf_storage_bucket: string | null;
        final_pdf_storage_path: string | null;
        final_pdf_generated_at: string | null;
        content_hash: string;
        status: RentalDocumentVersionStatus;
        generated_at: string;
        finalised_at: string | null;
        supersedes_version_id: string | null;
        created_by: string | null;
        created_at: string;
      }>;
      rental_document_signatures: TableDef<{
        id: string;
        organization_id: string;
        document_version_id: string;
        signer_role: RentalDocumentSignerRole;
        signer_name: string;
        signer_user_id: string | null;
        signature_storage_bucket: string | null;
        signature_storage_path: string | null;
        signature_data_url: string | null;
        signed_at: string;
        ip_address: string | null;
        user_agent: string | null;
        verification_method: string | null;
        consent_text_version: string | null;
        content_hash_at_signing: string;
        metadata: Json;
        created_at: string;
      }>;
      rental_document_acknowledgements: TableDef<{
        id: string;
        organization_id: string;
        rental_id: string;
        document_version_id: string;
        booking_link_id: string | null;
        signer_role: "renter";
        acknowledgement_type: string;
        acknowledgement_text_version: string;
        acknowledgement_text_snapshot: string;
        content_hash: string;
        accepted_at: string;
        metadata: Json;
        created_at: string;
      }>;
      rental_document_execution_certificates: TableDef<{
        id: string;
        organization_id: string;
        rental_id: string;
        document_id: string;
        document_version_id: string;
        original_content_hash: string;
        certificate_storage_bucket: string;
        certificate_storage_path: string;
        generated_at: string;
        verification_reference: string;
        metadata: Json;
        created_at: string;
      }>;
      rental_amendments: TableDef<{
        id: string;
        organization_id: string;
        rental_id: string;
        document_id: string | null;
        amendment_type: string;
        original_values: Json;
        amended_values: Json;
        reason: string | null;
        effective_at: string | null;
        approval_status: RentalAmendmentApprovalStatus;
        customer_signature_required: boolean;
        approved_at: string | null;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      deposit_reconciliations: TableDef<{
        id: string;
        organization_id: string;
        rental_id: string;
        document_id: string | null;
        deposit_amount_held: number;
        deductions: Json;
        amount_refunded: number;
        amount_retained: number;
        pending_assessment_amount: number;
        retention_reason: string | null;
        status: DepositReconciliationStatus;
        supporting_document_ids: Json;
        finalised_at: string | null;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      inspection_media_manifest: TableDef<{
        id: string;
        organization_id: string;
        inspection_id: string;
        document_id: string | null;
        media_type: InspectionMediaType;
        storage_bucket: string;
        storage_path: string;
        thumbnail_storage_path: string | null;
        captured_at: string | null;
        uploaded_by: string | null;
        file_size_bytes: number | null;
        duration_seconds: number | null;
        checksum: string | null;
        customer_visible: boolean;
        metadata: Json;
        created_at: string;
      }>;
      reminders: TableDef<TenantRow & { vehicle_id: string | null; rental_id: string | null; customer_id: string | null; type: ReminderType; severity: ReminderSeverity; title_key: string | null; title: string; due_date: string; completed_at: string | null; created_by: string | null }>;
      gps_devices: TableDef<TenantRow & { vehicle_id: string | null; provider: string; external_device_id: string; imei: string | null; phone_number: string | null; status: string; last_seen_at: string | null; metadata: Json }>;
      vehicle_locations: TableDef<{ id: string; organization_id: string; vehicle_id: string; gps_device_id: string | null; latitude: number; longitude: number; speed_kph: number | null; heading: number | null; odometer: number | null; recorded_at: string; raw_payload: Json; created_at: string }>;
      notifications: TableDef<TenantRow & { customer_id: string | null; rental_id: string | null; vehicle_id: string | null; channel: NotificationChannel; provider: string | null; locale: string; template_id: string | null; status: NotificationStatus; recipient: string; subject: string | null; body: string; sent_at: string | null; delivered_at: string | null; error_message: string | null; metadata: Json }>;
      message_templates: TableDef<{ id: string; organization_id: string | null; template_type: TemplateType; template_key: string; locale: string; version: number; title: string | null; subject: string | null; body: string; variables: Json; is_active: boolean; created_at: string; updated_at: string }>;
      notification_templates: TableDef<{ id: string; organization_id: string | null; channel: NotificationChannel; template_key: string; locale: string; version: number; subject: string | null; body: string; variables: Json; provider_template_id: string | null; is_active: boolean; created_at: string; updated_at: string }>;
      contract_templates: TableDef<{ id: string; organization_id: string | null; template_type: TemplateType; template_key: string; locale: string; version: number; title: string; body: string; name: string | null; content_html: string | null; is_default: boolean; language: string | null; variables: Json; jurisdiction: string | null; is_active: boolean; created_at: string; updated_at: string }>;
      activity_events: TableDef<{
        id: string;
        organization_id: string;
        actor_id: string | null;
        entity_type: ActivityEntityType;
        entity_id: string;
        vehicle_id: string | null;
        rental_id: string | null;
        customer_id: string | null;
        event_type: string;
        title_key: string | null;
        title: string;
        detail: string | null;
        metadata: Json;
        occurred_at: string;
        created_at: string;
      }>;
      tasks: TableDef<TenantRow & { assigned_to: string | null; vehicle_id: string | null; rental_id: string | null; title: string; title_key: string | null; task_type: string; due_at: string | null; completed_at: string | null; completion_notes: string | null; created_by: string | null }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      organization_role: OrganizationRole;
      vehicle_status: VehicleStatus;
      availability_status: AvailabilityStatus;
      rental_status: RentalStatus;
      pricing_model: PricingModel;
      payment_status: PaymentStatus;
      transaction_type: TransactionType;
      document_owner_type: DocumentOwnerType;
      inspection_type: InspectionType;
      reminder_type: ReminderType;
      reminder_severity: ReminderSeverity;
      activity_entity_type: ActivityEntityType;
      notification_channel: NotificationChannel;
      notification_status: NotificationStatus;
      template_type: TemplateType;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type TableName = keyof Database["public"]["Tables"];
export type TableRow<T extends TableName> = Database["public"]["Tables"][T]["Row"];
export type TableInsert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
export type TableUpdate<T extends TableName> = Database["public"]["Tables"][T]["Update"];
