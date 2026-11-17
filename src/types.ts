export const DOCUMENT_CATEGORIES = [
  'Passport Copy',
  'NID Card',
  'Birth Certificate',
  'Visa Copy',
  'Air Ticket',
  'Medical Report',
  'BMET Registration',
  'BMET Card',
  'PDO Training Certificate',
  'Manpower Card',
  'Police Clearance Certificate',
  'Other Documents',
] as const;

export const SERVICE_TYPES = [
  'Visa Processing',
  'Work Permit',
  'Air Ticket',
  'Medical Examination',
  'BMET Registration',
  'PDO Training',
  'Manpower Clearance',
  'Police Clearance',
  'Passport Assistance',
  'Other Agency Service',
] as const;

export const SERVICE_STATUSES = [
  'Pending',
  'Documents Collected',
  'Submitted',
  'In Progress',
  'Approved',
  'Completed',
  'On Hold',
  'Cancelled',
] as const;

export const PAYMENT_METHODS = [
  'Cash',
  'Bank Transfer',
  'bKash',
  'Nagad',
  'Card',
  'Cheque',
] as const;

export const CURRENCIES = ['BDT', 'USD', 'SAR', 'AED', 'MYR', 'QAR'] as const;

export interface AdminUser {
  id: number;
  uid: string;
  email: string;
  fullName: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
}

export interface FamilyMember {
  id?: number;
  passengerId?: number;
  relation: string;
  fullName: string;
  mobileNumber?: string | null;
  notes?: string | null;
}

export interface EmergencyContact {
  id?: number;
  passengerId?: number;
  contactName: string;
  relationship?: string | null;
  mobileNumber?: string | null;
  address?: string | null;
  photoData?: string | null;
}

export interface PassengerDocumentMeta {
  id: number;
  passengerId: number;
  category: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  notes?: string | null;
  uploadedByUid?: string | null;
  uploadedAt: string;
}

export interface PassengerDocumentFull extends PassengerDocumentMeta {
  fileData: string;
}

export interface PendingDocumentUpload {
  tempId: string;
  category: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileData: string;
  notes?: string;
}

export interface ServicePayment {
  id: number;
  passengerId: number;
  serviceId: number;
  receiptNumber: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  notes?: string | null;
  recordedByEmail?: string | null;
  createdAt: string;
}

export interface ServiceHistoryEntry {
  id: number;
  passengerId: number;
  serviceId: number;
  previousStatus: string | null;
  newStatus: string;
  updateNote: string;
  updatedByEmail?: string | null;
  createdAt: string;
}

export interface PassengerService {
  id: number;
  passengerId: number;
  serviceType: string;
  destinationCountry?: string | null;
  referenceNumber?: string | null;
  processingStatus: string;
  totalCharge: number;
  totalPaid: number;
  dueAmount: number;
  currency: string;
  serviceDate?: string | null;
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
  payments: ServicePayment[];
  history: ServiceHistoryEntry[];
  passenger?: {
    id: number;
    passengerIdNumber: string;
    fullName: string;
    passportNumber?: string | null;
    mobileNumber?: string | null;
  } | null;
}

export interface PassengerSummary {
  id: number;
  passengerIdNumber: string;
  fullName: string;
  dateOfBirth: string;
  sex: string;
  nationality: string;
  nidNumber?: string | null;
  birthRegistrationNumber?: string | null;
  passportNumber?: string | null;
  mobileNumber?: string | null;
  whatsappNumber?: string | null;
  whatsappSameAsMobile: boolean;
  presentAddress?: string | null;
  passportPhotoData?: string | null;
  selectedDocumentCategories: string[];
  additionalDocumentsNote?: string | null;
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
  serviceCount: number;
  documentCount: number;
  familyCount: number;
  emergencyContactSummary?: {
    id: number;
    contactName: string;
    mobileNumber?: string | null;
  } | null;
  totalCharge: number;
  totalPaid: number;
  dueAmount: number;
}

export interface PassengerFullRecord {
  passenger: PassengerSummary;
  familyMembers: FamilyMember[];
  emergencyContact: EmergencyContact | null;
  documents: PassengerDocumentMeta[];
  services: PassengerService[];
  financialSummary: {
    totalCharge: number;
    totalPaid: number;
    dueAmount: number;
  };
}

export interface DashboardStats {
  totalPassengers: number;
  totalServices: number;
  activeServices: number;
  totalDocuments: number;
  totalRevenueBilled: number;
  totalCollected: number;
  totalDue: number;
}

export interface PaymentWithDetails extends ServicePayment {
  passenger?: {
    id: number;
    passengerIdNumber: string;
    fullName: string;
    passportNumber?: string | null;
    mobileNumber?: string | null;
  } | null;
  service?: {
    id: number;
    serviceType: string;
    destinationCountry?: string | null;
    currency: string;
    totalCharge: number;
    processingStatus: string;
  } | null;
}

export type AppModule =
  | 'overview'
  | 'register'
  | 'directory'
  | 'services'
  | 'payments'
  | 'documents'
  | 'admin';
