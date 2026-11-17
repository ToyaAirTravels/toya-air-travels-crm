import { desc, eq, ilike, or } from 'drizzle-orm';
import { db } from './index.ts';
import {
  adminUsers,
  emergencyContacts,
  passengerDocuments,
  passengerFamily,
  passengers,
  passengerServices,
  serviceHistory,
  servicePayments,
} from './schema.ts';

export interface FamilyMemberInput {
  relation: string;
  fullName: string;
  mobileNumber?: string | null;
  notes?: string | null;
}

export interface EmergencyContactInput {
  contactName: string;
  relationship?: string | null;
  mobileNumber?: string | null;
  address?: string | null;
  photoData?: string | null;
}

export interface DocumentUploadInput {
  category: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileData: string;
  notes?: string | null;
}

export interface PassengerCreateInput {
  passengerIdNumber?: string;
  fullName: string;
  dateOfBirth: string;
  sex: string;
  nationality?: string;
  nidNumber?: string | null;
  birthRegistrationNumber?: string | null;
  passportNumber?: string | null;
  mobileNumber?: string | null;
  whatsappNumber?: string | null;
  whatsappSameAsMobile?: boolean;
  presentAddress?: string | null;
  passportPhotoData?: string | null;
  selectedDocumentCategories?: string[];
  additionalDocumentsNote?: string | null;
  remarks?: string | null;
  familyMembers?: FamilyMemberInput[];
  emergencyContact?: EmergencyContactInput | null;
  documents?: DocumentUploadInput[];
}

export async function upsertAdminUser(
  uid: string,
  email: string,
  fullName: string | null
) {
  try {
    const result = await db
      .insert(adminUsers)
      .values({
        uid,
        email,
        fullName,
        role: 'admin',
        isActive: true,
        lastLoginAt: new Date(),
      })
      .onConflictDoUpdate({
        target: adminUsers.uid,
        set: {
          email,
          fullName: fullName ?? undefined,
          lastLoginAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed (upsertAdminUser):', error);
    throw new Error('Failed to verify admin account.', { cause: error });
  }
}

export async function listAdminUsers() {
  try {
    return await db
      .select()
      .from(adminUsers)
      .orderBy(desc(adminUsers.lastLoginAt));
  } catch (error) {
    console.error('Database query failed (listAdminUsers):', error);
    throw new Error('Failed to load admin users.', { cause: error });
  }
}

export async function updateAdminUser(
  id: number,
  role: string,
  isActive: boolean
) {
  try {
    const updated = await db
      .update(adminUsers)
      .set({ role, isActive })
      .where(eq(adminUsers.id, id))
      .returning();
    return updated[0] || null;
  } catch (error) {
    console.error('Database query failed (updateAdminUser):', error);
    throw new Error('Failed to update admin account.', { cause: error });
  }
}

export async function generateNextPassengerId(): Promise<string> {
  try {
    const year = new Date().getFullYear();
    const existing = await db
      .select({ id: passengers.id })
      .from(passengers)
      .orderBy(desc(passengers.id))
      .limit(1);

    const nextSeq = (existing[0]?.id ?? 0) + 1;
    return `TAT-${year}-${String(nextSeq).padStart(4, '0')}`;
  } catch (error) {
    console.error('Database query failed (generateNextPassengerId):', error);
    throw new Error('Failed to generate passenger ID.', { cause: error });
  }
}

export async function listPassengers(search?: string) {
  try {
    const trimmed = search?.trim();
    const passengerRows = trimmed
      ? await db
          .select()
          .from(passengers)
          .where(
            or(
              ilike(passengers.fullName, `%${trimmed}%`),
              ilike(passengers.passengerIdNumber, `%${trimmed}%`),
              ilike(passengers.passportNumber, `%${trimmed}%`),
              ilike(passengers.nidNumber, `%${trimmed}%`),
              ilike(passengers.mobileNumber, `%${trimmed}%`)
            )
          )
          .orderBy(desc(passengers.createdAt))
      : await db
          .select()
          .from(passengers)
          .orderBy(desc(passengers.createdAt));

    const [allServices, allPayments, allDocs, allFamily, allEmergency] =
      await Promise.all([
        db.select().from(passengerServices),
        db.select().from(servicePayments),
        db
          .select({
            id: passengerDocuments.id,
            passengerId: passengerDocuments.passengerId,
          })
          .from(passengerDocuments),
        db
          .select({
            id: passengerFamily.id,
            passengerId: passengerFamily.passengerId,
          })
          .from(passengerFamily),
        db
          .select({
            id: emergencyContacts.id,
            passengerId: emergencyContacts.passengerId,
            contactName: emergencyContacts.contactName,
            mobileNumber: emergencyContacts.mobileNumber,
          })
          .from(emergencyContacts),
      ]);

    return passengerRows.map((p) => {
      const pServices = allServices.filter((s) => s.passengerId === p.id);
      const pPayments = allPayments.filter((pay) => pay.passengerId === p.id);
      const pDocs = allDocs.filter((d) => d.passengerId === p.id);
      const pFamily = allFamily.filter((f) => f.passengerId === p.id);
      const pEmergency = allEmergency.find((e) => e.passengerId === p.id) || null;

      const totalCharge = pServices.reduce(
        (sum, s) => sum + Number(s.totalCharge || 0),
        0
      );
      const totalPaid = pPayments.reduce(
        (sum, pay) => sum + Number(pay.amount || 0),
        0
      );

      return {
        ...p,
        serviceCount: pServices.length,
        documentCount: pDocs.length,
        familyCount: pFamily.length,
        emergencyContactSummary: pEmergency,
        totalCharge,
        totalPaid,
        dueAmount: Math.max(0, totalCharge - totalPaid),
      };
    });
  } catch (error) {
    console.error('Database query failed (listPassengers):', error);
    throw new Error('Failed to load passenger records.', { cause: error });
  }
}

export async function getPassengerFullRecord(passengerId: number) {
  try {
    const passengerRows = await db
      .select()
      .from(passengers)
      .where(eq(passengers.id, passengerId))
      .limit(1);

    const passenger = passengerRows[0];
    if (!passenger) return null;

    const [familyMembers, emergencyList, docs, services, payments, history] =
      await Promise.all([
        db
          .select()
          .from(passengerFamily)
          .where(eq(passengerFamily.passengerId, passengerId))
          .orderBy(passengerFamily.id),
        db
          .select()
          .from(emergencyContacts)
          .where(eq(emergencyContacts.passengerId, passengerId))
          .orderBy(emergencyContacts.id),
        db
          .select({
            id: passengerDocuments.id,
            passengerId: passengerDocuments.passengerId,
            category: passengerDocuments.category,
            fileName: passengerDocuments.fileName,
            mimeType: passengerDocuments.mimeType,
            fileSize: passengerDocuments.fileSize,
            notes: passengerDocuments.notes,
            uploadedByUid: passengerDocuments.uploadedByUid,
            uploadedAt: passengerDocuments.uploadedAt,
          })
          .from(passengerDocuments)
          .where(eq(passengerDocuments.passengerId, passengerId))
          .orderBy(desc(passengerDocuments.uploadedAt)),
        db
          .select()
          .from(passengerServices)
          .where(eq(passengerServices.passengerId, passengerId))
          .orderBy(desc(passengerServices.createdAt)),
        db
          .select()
          .from(servicePayments)
          .where(eq(servicePayments.passengerId, passengerId))
          .orderBy(desc(servicePayments.createdAt)),
        db
          .select()
          .from(serviceHistory)
          .where(eq(serviceHistory.passengerId, passengerId))
          .orderBy(desc(serviceHistory.createdAt)),
      ]);

    const enrichedServices = services.map((service) => {
      const sPayments = payments.filter((p) => p.serviceId === service.id);
      const sHistory = history.filter((h) => h.serviceId === service.id);
      const totalCharge = Number(service.totalCharge || 0);
      const totalPaid = sPayments.reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0
      );
      return {
        ...service,
        totalCharge,
        totalPaid,
        dueAmount: Math.max(0, totalCharge - totalPaid),
        payments: sPayments.map((p) => ({
          ...p,
          amount: Number(p.amount || 0),
        })),
        history: sHistory,
      };
    });

    const summaryTotalCharge = enrichedServices.reduce(
      (sum, s) => sum + s.totalCharge,
      0
    );
    const summaryTotalPaid = enrichedServices.reduce(
      (sum, s) => sum + s.totalPaid,
      0
    );

    return {
      passenger,
      familyMembers,
      emergencyContact: emergencyList[0] || null,
      documents: docs,
      services: enrichedServices,
      financialSummary: {
        totalCharge: summaryTotalCharge,
        totalPaid: summaryTotalPaid,
        dueAmount: Math.max(0, summaryTotalCharge - summaryTotalPaid),
      },
    };
  } catch (error) {
    console.error('Database query failed (getPassengerFullRecord):', error);
    throw new Error('Failed to load passenger details.', { cause: error });
  }
}

export async function createPassengerWithDetails(
  input: PassengerCreateInput,
  uid: string
) {
  try {
    return await db.transaction(async (tx) => {
      let idNumber = input.passengerIdNumber?.trim();
      if (!idNumber) {
        const year = new Date().getFullYear();
        const latest = await tx
          .select({ id: passengers.id })
          .from(passengers)
          .orderBy(desc(passengers.id))
          .limit(1);
        const seq = (latest[0]?.id ?? 0) + 1;
        idNumber = `TAT-${year}-${String(seq).padStart(4, '0')}`;
      }

      const [created] = await tx
        .insert(passengers)
        .values({
          passengerIdNumber: idNumber,
          fullName: input.fullName.trim(),
          dateOfBirth: input.dateOfBirth,
          sex: input.sex,
          nationality: input.nationality?.trim() || 'Bangladeshi',
          nidNumber: input.nidNumber?.trim() || null,
          birthRegistrationNumber: input.birthRegistrationNumber?.trim() || null,
          passportNumber: input.passportNumber?.trim() || null,
          mobileNumber: input.mobileNumber?.trim() || null,
          whatsappNumber: input.whatsappSameAsMobile
            ? input.mobileNumber?.trim() || null
            : input.whatsappNumber?.trim() || null,
          whatsappSameAsMobile: Boolean(input.whatsappSameAsMobile),
          presentAddress: input.presentAddress?.trim() || null,
          passportPhotoData: input.passportPhotoData || null,
          selectedDocumentCategories: input.selectedDocumentCategories || [],
          additionalDocumentsNote: input.additionalDocumentsNote?.trim() || null,
          remarks: input.remarks?.trim() || null,
          createdByUid: uid,
          updatedAt: new Date(),
        })
        .returning();

      const validFamily = (input.familyMembers || []).filter(
        (m) => m.fullName && m.fullName.trim().length > 0
      );
      if (validFamily.length > 0) {
        await tx.insert(passengerFamily).values(
          validFamily.map((m) => ({
            passengerId: created.id,
            relation: m.relation,
            fullName: m.fullName.trim(),
            mobileNumber: m.mobileNumber?.trim() || null,
            notes: m.notes?.trim() || null,
          }))
        );
      }

      if (
        input.emergencyContact &&
        (input.emergencyContact.contactName?.trim() ||
          input.emergencyContact.mobileNumber?.trim() ||
          input.emergencyContact.address?.trim() ||
          input.emergencyContact.photoData)
      ) {
        await tx.insert(emergencyContacts).values({
          passengerId: created.id,
          contactName:
            input.emergencyContact.contactName?.trim() || 'Emergency Contact',
          relationship: input.emergencyContact.relationship?.trim() || null,
          mobileNumber: input.emergencyContact.mobileNumber?.trim() || null,
          address: input.emergencyContact.address?.trim() || null,
          photoData: input.emergencyContact.photoData || null,
        });
      }

      if (input.documents && input.documents.length > 0) {
        await tx.insert(passengerDocuments).values(
          input.documents.map((doc) => ({
            passengerId: created.id,
            category: doc.category,
            fileName: doc.fileName,
            mimeType: doc.mimeType,
            fileSize: doc.fileSize,
            fileData: doc.fileData,
            notes: doc.notes?.trim() || null,
            uploadedByUid: uid,
          }))
        );
      }

      return created;
    });
  } catch (error: unknown) {
    console.error('Database query failed (createPassengerWithDetails):', error);
    const errMsg =
      error instanceof Error && error.message.includes('unique')
        ? 'Passenger ID Number already exists. Please use a unique ID.'
        : 'Failed to create passenger record.';
    throw new Error(errMsg, { cause: error });
  }
}

export async function updatePassengerWithDetails(
  passengerId: number,
  input: PassengerCreateInput,
  uid: string
) {
  try {
    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(passengers)
        .set({
          passengerIdNumber: input.passengerIdNumber?.trim() || undefined,
          fullName: input.fullName.trim(),
          dateOfBirth: input.dateOfBirth,
          sex: input.sex,
          nationality: input.nationality?.trim() || 'Bangladeshi',
          nidNumber: input.nidNumber?.trim() || null,
          birthRegistrationNumber: input.birthRegistrationNumber?.trim() || null,
          passportNumber: input.passportNumber?.trim() || null,
          mobileNumber: input.mobileNumber?.trim() || null,
          whatsappNumber: input.whatsappSameAsMobile
            ? input.mobileNumber?.trim() || null
            : input.whatsappNumber?.trim() || null,
          whatsappSameAsMobile: Boolean(input.whatsappSameAsMobile),
          presentAddress: input.presentAddress?.trim() || null,
          passportPhotoData:
            input.passportPhotoData !== undefined
              ? input.passportPhotoData
              : undefined,
          selectedDocumentCategories: input.selectedDocumentCategories || [],
          additionalDocumentsNote: input.additionalDocumentsNote?.trim() || null,
          remarks: input.remarks?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(passengers.id, passengerId))
        .returning();

      if (!updated) return null;

      // Sync family contacts cleanly while keeping services/payments linked to passenger.id
      await tx
        .delete(passengerFamily)
        .where(eq(passengerFamily.passengerId, passengerId));

      const validFamily = (input.familyMembers || []).filter(
        (m) => m.fullName && m.fullName.trim().length > 0
      );
      if (validFamily.length > 0) {
        await tx.insert(passengerFamily).values(
          validFamily.map((m) => ({
            passengerId,
            relation: m.relation,
            fullName: m.fullName.trim(),
            mobileNumber: m.mobileNumber?.trim() || null,
            notes: m.notes?.trim() || null,
          }))
        );
      }

      await tx
        .delete(emergencyContacts)
        .where(eq(emergencyContacts.passengerId, passengerId));

      if (
        input.emergencyContact &&
        (input.emergencyContact.contactName?.trim() ||
          input.emergencyContact.mobileNumber?.trim() ||
          input.emergencyContact.address?.trim() ||
          input.emergencyContact.photoData)
      ) {
        await tx.insert(emergencyContacts).values({
          passengerId,
          contactName:
            input.emergencyContact.contactName?.trim() || 'Emergency Contact',
          relationship: input.emergencyContact.relationship?.trim() || null,
          mobileNumber: input.emergencyContact.mobileNumber?.trim() || null,
          address: input.emergencyContact.address?.trim() || null,
          photoData: input.emergencyContact.photoData || null,
        });
      }

      if (input.documents && input.documents.length > 0) {
        await tx.insert(passengerDocuments).values(
          input.documents.map((doc) => ({
            passengerId,
            category: doc.category,
            fileName: doc.fileName,
            mimeType: doc.mimeType,
            fileSize: doc.fileSize,
            fileData: doc.fileData,
            notes: doc.notes?.trim() || null,
            uploadedByUid: uid,
          }))
        );
      }

      return updated;
    });
  } catch (error) {
    console.error('Database query failed (updatePassengerWithDetails):', error);
    throw new Error('Failed to update passenger record.', { cause: error });
  }
}

export async function deletePassenger(passengerId: number) {
  try {
    const deleted = await db
      .delete(passengers)
      .where(eq(passengers.id, passengerId))
      .returning();
    return deleted[0] || null;
  } catch (error) {
    console.error('Database query failed (deletePassenger):', error);
    throw new Error('Failed to delete passenger record.', { cause: error });
  }
}

export async function addPassengerDocument(
  passengerId: number,
  doc: DocumentUploadInput,
  uid: string
) {
  try {
    const [inserted] = await db
      .insert(passengerDocuments)
      .values({
        passengerId,
        category: doc.category,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        fileData: doc.fileData,
        notes: doc.notes?.trim() || null,
        uploadedByUid: uid,
      })
      .returning({
        id: passengerDocuments.id,
        passengerId: passengerDocuments.passengerId,
        category: passengerDocuments.category,
        fileName: passengerDocuments.fileName,
        mimeType: passengerDocuments.mimeType,
        fileSize: passengerDocuments.fileSize,
        notes: passengerDocuments.notes,
        uploadedByUid: passengerDocuments.uploadedByUid,
        uploadedAt: passengerDocuments.uploadedAt,
      });

    return inserted;
  } catch (error) {
    console.error('Database query failed (addPassengerDocument):', error);
    throw new Error('Failed to upload document.', { cause: error });
  }
}

export async function getDocumentById(docId: number) {
  try {
    const rows = await db
      .select()
      .from(passengerDocuments)
      .where(eq(passengerDocuments.id, docId))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed (getDocumentById):', error);
    throw new Error('Failed to retrieve document.', { cause: error });
  }
}

export async function getPassengerDocumentsFull(passengerId: number) {
  try {
    return await db
      .select()
      .from(passengerDocuments)
      .where(eq(passengerDocuments.passengerId, passengerId))
      .orderBy(desc(passengerDocuments.uploadedAt));
  } catch (error) {
    console.error('Database query failed (getPassengerDocumentsFull):', error);
    throw new Error('Failed to load passenger documents.', { cause: error });
  }
}

export async function updatePassengerDossierNotes(
  passengerId: number,
  input: {
    selectedDocumentCategories?: string[];
    additionalDocumentsNote?: string | null;
    remarks?: string | null;
  }
) {
  try {
    const [updated] = await db
      .update(passengers)
      .set({
        selectedDocumentCategories:
          input.selectedDocumentCategories !== undefined
            ? input.selectedDocumentCategories
            : undefined,
        additionalDocumentsNote:
          input.additionalDocumentsNote !== undefined
            ? input.additionalDocumentsNote?.trim() || null
            : undefined,
        remarks:
          input.remarks !== undefined
            ? input.remarks?.trim() || null
            : undefined,
        updatedAt: new Date(),
      })
      .where(eq(passengers.id, passengerId))
      .returning();
    return updated || null;
  } catch (error) {
    console.error('Database query failed (updatePassengerDossierNotes):', error);
    throw new Error('Failed to save passenger dossier.', { cause: error });
  }
}

export async function deleteDocument(docId: number) {
  try {
    const deleted = await db
      .delete(passengerDocuments)
      .where(eq(passengerDocuments.id, docId))
      .returning({ id: passengerDocuments.id });
    return deleted[0] || null;
  } catch (error) {
    console.error('Database query failed (deleteDocument):', error);
    throw new Error('Failed to delete document.', { cause: error });
  }
}

export async function createPassengerService(
  passengerId: number,
  input: {
    serviceType: string;
    destinationCountry?: string | null;
    referenceNumber?: string | null;
    processingStatus?: string;
    totalCharge: number;
    currency?: string;
    serviceDate?: string | null;
    remarks?: string | null;
  },
  userEmail: string,
  uid: string
) {
  try {
    return await db.transaction(async (tx) => {
      const status = input.processingStatus || 'Pending';
      const [service] = await tx
        .insert(passengerServices)
        .values({
          passengerId,
          serviceType: input.serviceType,
          destinationCountry: input.destinationCountry?.trim() || null,
          referenceNumber: input.referenceNumber?.trim() || null,
          processingStatus: status,
          totalCharge: Number(input.totalCharge || 0).toFixed(2),
          currency: input.currency || 'BDT',
          serviceDate:
            input.serviceDate || new Date().toISOString().slice(0, 10),
          remarks: input.remarks?.trim() || null,
          updatedAt: new Date(),
        })
        .returning();

      await tx.insert(serviceHistory).values({
        passengerId,
        serviceId: service.id,
        previousStatus: null,
        newStatus: status,
        updateNote: input.remarks?.trim() || `${input.serviceType} service registered`,
        updatedByEmail: userEmail,
        updatedByUid: uid,
      });

      return {
        ...service,
        totalCharge: Number(service.totalCharge || 0),
        totalPaid: 0,
        dueAmount: Number(service.totalCharge || 0),
      };
    });
  } catch (error) {
    console.error('Database query failed (createPassengerService):', error);
    throw new Error('Failed to create passenger service.', { cause: error });
  }
}

export async function updatePassengerService(
  serviceId: number,
  input: {
    serviceType?: string;
    destinationCountry?: string | null;
    referenceNumber?: string | null;
    processingStatus?: string;
    totalCharge?: number;
    currency?: string;
    serviceDate?: string | null;
    remarks?: string | null;
    updateNote?: string | null;
  },
  userEmail: string,
  uid: string
) {
  try {
    return await db.transaction(async (tx) => {
      const existingRows = await tx
        .select()
        .from(passengerServices)
        .where(eq(passengerServices.id, serviceId))
        .limit(1);

      const existing = existingRows[0];
      if (!existing) return null;

      const newStatus = input.processingStatus || existing.processingStatus;

      const [updated] = await tx
        .update(passengerServices)
        .set({
          serviceType: input.serviceType ?? existing.serviceType,
          destinationCountry:
            input.destinationCountry !== undefined
              ? input.destinationCountry?.trim() || null
              : existing.destinationCountry,
          referenceNumber:
            input.referenceNumber !== undefined
              ? input.referenceNumber?.trim() || null
              : existing.referenceNumber,
          processingStatus: newStatus,
          totalCharge:
            input.totalCharge !== undefined
              ? Number(input.totalCharge).toFixed(2)
              : existing.totalCharge,
          currency: input.currency ?? existing.currency,
          serviceDate:
            input.serviceDate !== undefined
              ? input.serviceDate
              : existing.serviceDate,
          remarks:
            input.remarks !== undefined
              ? input.remarks?.trim() || null
              : existing.remarks,
          updatedAt: new Date(),
        })
        .where(eq(passengerServices.id, serviceId))
        .returning();

      if (
        existing.processingStatus !== newStatus ||
        (input.updateNote && input.updateNote.trim().length > 0)
      ) {
        await tx.insert(serviceHistory).values({
          passengerId: existing.passengerId,
          serviceId,
          previousStatus: existing.processingStatus,
          newStatus,
          updateNote:
            input.updateNote?.trim() ||
            `Status updated from ${existing.processingStatus} to ${newStatus}`,
          updatedByEmail: userEmail,
          updatedByUid: uid,
        });
      }

      return updated;
    });
  } catch (error) {
    console.error('Database query failed (updatePassengerService):', error);
    throw new Error('Failed to update passenger service.', { cause: error });
  }
}

export async function deletePassengerService(serviceId: number) {
  try {
    const deleted = await db
      .delete(passengerServices)
      .where(eq(passengerServices.id, serviceId))
      .returning();
    return deleted[0] || null;
  } catch (error) {
    console.error('Database query failed (deletePassengerService):', error);
    throw new Error('Failed to delete service.', { cause: error });
  }
}

export async function recordServicePayment(
  serviceId: number,
  input: {
    amount: number;
    paymentMethod?: string;
    paymentDate?: string;
    notes?: string | null;
  },
  userEmail: string,
  uid: string
) {
  try {
    return await db.transaction(async (tx) => {
      const serviceRows = await tx
        .select()
        .from(passengerServices)
        .where(eq(passengerServices.id, serviceId))
        .limit(1);

      const service = serviceRows[0];
      if (!service) return null;

      const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomPart = Math.floor(1000 + Math.random() * 9000);
      const receiptNumber = `RCP-${dateTag}-${randomPart}`;

      const [payment] = await tx
        .insert(servicePayments)
        .values({
          passengerId: service.passengerId,
          serviceId: service.id,
          receiptNumber,
          amount: Number(input.amount).toFixed(2),
          paymentMethod: input.paymentMethod || 'Cash',
          paymentDate:
            input.paymentDate || new Date().toISOString().slice(0, 10),
          notes: input.notes?.trim() || null,
          recordedByUid: uid,
          recordedByEmail: userEmail,
        })
        .returning();

      await tx.insert(serviceHistory).values({
        passengerId: service.passengerId,
        serviceId: service.id,
        previousStatus: service.processingStatus,
        newStatus: service.processingStatus,
        updateNote: `Payment received: ${service.currency} ${Number(input.amount).toLocaleString()} (${input.paymentMethod || 'Cash'}) · Receipt ${receiptNumber}`,
        updatedByEmail: userEmail,
        updatedByUid: uid,
      });

      return {
        ...payment,
        amount: Number(payment.amount || 0),
      };
    });
  } catch (error) {
    console.error('Database query failed (recordServicePayment):', error);
    throw new Error('Failed to record payment.', { cause: error });
  }
}

export async function deleteServicePayment(paymentId: number) {
  try {
    const deleted = await db
      .delete(servicePayments)
      .where(eq(servicePayments.id, paymentId))
      .returning();
    return deleted[0] || null;
  } catch (error) {
    console.error('Database query failed (deleteServicePayment):', error);
    throw new Error('Failed to delete payment record.', { cause: error });
  }
}

export async function getAllServicesWithPassengers() {
  try {
    const [services, allPassengers, allPayments, allHistory] = await Promise.all([
      db
        .select()
        .from(passengerServices)
        .orderBy(desc(passengerServices.updatedAt)),
      db
        .select({
          id: passengers.id,
          passengerIdNumber: passengers.passengerIdNumber,
          fullName: passengers.fullName,
          passportNumber: passengers.passportNumber,
          mobileNumber: passengers.mobileNumber,
        })
        .from(passengers),
      db.select().from(servicePayments).orderBy(desc(servicePayments.createdAt)),
      db.select().from(serviceHistory).orderBy(desc(serviceHistory.createdAt)),
    ]);

    const passengerMap = new Map(allPassengers.map((p) => [p.id, p]));

    return services.map((service) => {
      const sPayments = allPayments.filter((p) => p.serviceId === service.id);
      const sHistory = allHistory.filter((h) => h.serviceId === service.id);
      const totalCharge = Number(service.totalCharge || 0);
      const totalPaid = sPayments.reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0
      );
      return {
        ...service,
        totalCharge,
        totalPaid,
        dueAmount: Math.max(0, totalCharge - totalPaid),
        passenger: passengerMap.get(service.passengerId) || null,
        payments: sPayments.map((p) => ({
          ...p,
          amount: Number(p.amount || 0),
        })),
        history: sHistory,
      };
    });
  } catch (error) {
    console.error('Database query failed (getAllServicesWithPassengers):', error);
    throw new Error('Failed to load passenger services.', { cause: error });
  }
}

export async function getAllPaymentsWithDetails() {
  try {
    const [payments, allPassengers, allServices] = await Promise.all([
      db.select().from(servicePayments).orderBy(desc(servicePayments.createdAt)),
      db
        .select({
          id: passengers.id,
          passengerIdNumber: passengers.passengerIdNumber,
          fullName: passengers.fullName,
          passportNumber: passengers.passportNumber,
          mobileNumber: passengers.mobileNumber,
        })
        .from(passengers),
      db.select().from(passengerServices),
    ]);

    const passengerMap = new Map(allPassengers.map((p) => [p.id, p]));
    const serviceMap = new Map(allServices.map((s) => [s.id, s]));

    return payments.map((p) => ({
      ...p,
      amount: Number(p.amount || 0),
      passenger: passengerMap.get(p.passengerId) || null,
      service: serviceMap.get(p.serviceId)
        ? {
            ...serviceMap.get(p.serviceId)!,
            totalCharge: Number(serviceMap.get(p.serviceId)!.totalCharge || 0),
          }
        : null,
    }));
  } catch (error) {
    console.error('Database query failed (getAllPaymentsWithDetails):', error);
    throw new Error('Failed to load payment records.', { cause: error });
  }
}

export async function getDashboardStats() {
  try {
    const [passengerRows, serviceRows, paymentRows, docRows] = await Promise.all([
      db
        .select({ id: passengers.id, createdAt: passengers.createdAt })
        .from(passengers),
      db.select().from(passengerServices),
      db.select().from(servicePayments),
      db.select({ id: passengerDocuments.id }).from(passengerDocuments),
    ]);

    const totalRevenueBilled = serviceRows.reduce(
      (sum, s) => sum + Number(s.totalCharge || 0),
      0
    );
    const totalCollected = paymentRows.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    );
    const activeServices = serviceRows.filter(
      (s) => s.processingStatus !== 'Completed' && s.processingStatus !== 'Cancelled'
    ).length;

    return {
      totalPassengers: passengerRows.length,
      totalServices: serviceRows.length,
      activeServices,
      totalDocuments: docRows.length,
      totalRevenueBilled,
      totalCollected,
      totalDue: Math.max(0, totalRevenueBilled - totalCollected),
    };
  } catch (error) {
    console.error('Database query failed (getDashboardStats):', error);
    throw new Error('Failed to load operational metrics.', { cause: error });
  }
}
