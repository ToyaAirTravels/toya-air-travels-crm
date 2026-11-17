import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// 1. admin_users - Admin and staff accounts linked to Firebase Auth UID
export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name'),
  role: text('role').notNull().default('admin'),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. passengers - Personal information
export const passengers = pgTable('passengers', {
  id: serial('id').primaryKey(),
  passengerIdNumber: text('passenger_id_number').notNull().unique(),
  fullName: text('full_name').notNull(),
  dateOfBirth: text('date_of_birth').notNull(),
  sex: text('sex').notNull(),
  nationality: text('nationality').notNull().default('Bangladeshi'),
  nidNumber: text('nid_number'),
  birthRegistrationNumber: text('birth_registration_number'),
  passportNumber: text('passport_number'),
  mobileNumber: text('mobile_number'),
  whatsappNumber: text('whatsapp_number'),
  whatsappSameAsMobile: boolean('whatsapp_same_as_mobile').notNull().default(false),
  presentAddress: text('present_address'),
  passportPhotoData: text('passport_photo_data'),
  selectedDocumentCategories: jsonb('selected_document_categories')
    .$type<string[]>()
    .notNull()
    .default([]),
  additionalDocumentsNote: text('additional_documents_note'),
  remarks: text('remarks'),
  createdByUid: text('created_by_uid'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 3. passenger_family - Family contacts (Father, Mother, Spouse, Son, Brother, Sister, etc.)
export const passengerFamily = pgTable('passenger_family', {
  id: serial('id').primaryKey(),
  passengerId: integer('passenger_id')
    .references(() => passengers.id, { onDelete: 'cascade' })
    .notNull(),
  relation: text('relation').notNull(),
  fullName: text('full_name').notNull(),
  mobileNumber: text('mobile_number'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 4. emergency_contacts - Emergency information & photo
export const emergencyContacts = pgTable('emergency_contacts', {
  id: serial('id').primaryKey(),
  passengerId: integer('passenger_id')
    .references(() => passengers.id, { onDelete: 'cascade' })
    .notNull(),
  contactName: text('contact_name').notNull(),
  relationship: text('relationship'),
  mobileNumber: text('mobile_number'),
  address: text('address'),
  photoData: text('photo_data'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 5. passenger_documents - Document files and details (PDF, JPG, JPEG, PNG)
export const passengerDocuments = pgTable('passenger_documents', {
  id: serial('id').primaryKey(),
  passengerId: integer('passenger_id')
    .references(() => passengers.id, { onDelete: 'cascade' })
    .notNull(),
  category: text('category').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  fileData: text('file_data').notNull(),
  notes: text('notes'),
  uploadedByUid: text('uploaded_by_uid'),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
});

// 6. passenger_services - Services taken per passenger
export const passengerServices = pgTable('passenger_services', {
  id: serial('id').primaryKey(),
  passengerId: integer('passenger_id')
    .references(() => passengers.id, { onDelete: 'cascade' })
    .notNull(),
  serviceType: text('service_type').notNull(),
  destinationCountry: text('destination_country'),
  referenceNumber: text('reference_number'),
  processingStatus: text('processing_status').notNull().default('Pending'),
  totalCharge: numeric('total_charge', { precision: 12, scale: 2 })
    .notNull()
    .default('0.00'),
  currency: text('currency').notNull().default('BDT'),
  serviceDate: text('service_date'),
  remarks: text('remarks'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 7. service_payments - Payment records per service
export const servicePayments = pgTable('service_payments', {
  id: serial('id').primaryKey(),
  passengerId: integer('passenger_id')
    .references(() => passengers.id, { onDelete: 'cascade' })
    .notNull(),
  serviceId: integer('service_id')
    .references(() => passengerServices.id, { onDelete: 'cascade' })
    .notNull(),
  receiptNumber: text('receipt_number').notNull().unique(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text('payment_method').notNull().default('Cash'),
  paymentDate: text('payment_date').notNull(),
  notes: text('notes'),
  recordedByUid: text('recorded_by_uid'),
  recordedByEmail: text('recorded_by_email'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 8. service_history - Processing updates per service
export const serviceHistory = pgTable('service_history', {
  id: serial('id').primaryKey(),
  passengerId: integer('passenger_id')
    .references(() => passengers.id, { onDelete: 'cascade' })
    .notNull(),
  serviceId: integer('service_id')
    .references(() => passengerServices.id, { onDelete: 'cascade' })
    .notNull(),
  previousStatus: text('previous_status'),
  newStatus: text('new_status').notNull(),
  updateNote: text('update_note').notNull(),
  updatedByEmail: text('updated_by_email'),
  updatedByUid: text('updated_by_uid'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const passengersRelations = relations(passengers, ({ many }) => ({
  familyMembers: many(passengerFamily),
  emergencyContacts: many(emergencyContacts),
  documents: many(passengerDocuments),
  services: many(passengerServices),
  payments: many(servicePayments),
  serviceHistory: many(serviceHistory),
}));

export const passengerFamilyRelations = relations(passengerFamily, ({ one }) => ({
  passenger: one(passengers, {
    fields: [passengerFamily.passengerId],
    references: [passengers.id],
  }),
}));

export const emergencyContactsRelations = relations(emergencyContacts, ({ one }) => ({
  passenger: one(passengers, {
    fields: [emergencyContacts.passengerId],
    references: [passengers.id],
  }),
}));

export const passengerDocumentsRelations = relations(passengerDocuments, ({ one }) => ({
  passenger: one(passengers, {
    fields: [passengerDocuments.passengerId],
    references: [passengers.id],
  }),
}));

export const passengerServicesRelations = relations(passengerServices, ({ one, many }) => ({
  passenger: one(passengers, {
    fields: [passengerServices.passengerId],
    references: [passengers.id],
  }),
  payments: many(servicePayments),
  history: many(serviceHistory),
}));

export const servicePaymentsRelations = relations(servicePayments, ({ one }) => ({
  passenger: one(passengers, {
    fields: [servicePayments.passengerId],
    references: [passengers.id],
  }),
  service: one(passengerServices, {
    fields: [servicePayments.serviceId],
    references: [passengerServices.id],
  }),
}));

export const serviceHistoryRelations = relations(serviceHistory, ({ one }) => ({
  passenger: one(passengers, {
    fields: [serviceHistory.passengerId],
    references: [passengers.id],
  }),
  service: one(passengerServices, {
    fields: [serviceHistory.serviceId],
    references: [passengerServices.id],
  }),
}));
