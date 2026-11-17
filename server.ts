import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { requireAuth } from './src/middleware/auth.ts';
import type { AuthRequest } from './src/middleware/auth.ts';
import {
  addPassengerDocument,
  createPassengerService,
  createPassengerWithDetails,
  deleteDocument,
  deletePassenger,
  deletePassengerService,
  deleteServicePayment,
  generateNextPassengerId,
  getAllPaymentsWithDetails,
  getAllServicesWithPassengers,
  getDashboardStats,
  getDocumentById,
  getPassengerDocumentsFull,
  getPassengerFullRecord,
  listAdminUsers,
  listPassengers,
  recordServicePayment,
  updateAdminUser,
  updatePassengerDossierNotes,
  updatePassengerService,
  updatePassengerWithDetails,
} from './src/db/queries.ts';
import type { DocumentUploadInput } from './src/db/queries.ts';

dotenv.config();

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

function validateDocumentFile(doc: DocumentUploadInput): string | null {
  const mime = (doc.mimeType || '').toLowerCase();
  const ext = (doc.fileName || '').toLowerCase().split('.').pop() || '';
  const validExt = ['pdf', 'jpg', 'jpeg', 'png'].includes(ext);
  if (!ALLOWED_MIME_TYPES.has(mime) && !validExt) {
    return `Unsupported file format for "${doc.fileName}". Supported formats: PDF, JPG, JPEG, and PNG.`;
  }
  if (!doc.fileData || typeof doc.fileData !== 'string') {
    return `Missing file content for "${doc.fileName}".`;
  }
  return null;
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '35mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Current authenticated admin profile
  app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
    res.json({ admin: req.adminRecord });
  });

  // Admin & staff accounts
  app.get('/api/admin-users', requireAuth, async (_req: AuthRequest, res) => {
    try {
      const users = await listAdminUsers();
      res.json(users);
    } catch (error: unknown) {
      res.status(500).json({
        error:
          error instanceof Error ? error.message : 'Failed to load admin users',
      });
    }
  });

  app.patch(
    '/api/admin-users/:id',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) {
          return res.status(400).json({ error: 'Invalid admin user ID' });
        }
        const { role, isActive } = req.body as {
          role?: string;
          isActive?: boolean;
        };
        if (
          req.adminRecord?.id === id &&
          isActive === false
        ) {
          return res
            .status(400)
            .json({ error: 'You cannot deactivate your own active session.' });
        }
        const updated = await updateAdminUser(
          id,
          role || 'staff',
          isActive !== undefined ? Boolean(isActive) : true
        );
        if (!updated) {
          return res.status(404).json({ error: 'Admin user not found' });
        }
        res.json(updated);
      } catch (error: unknown) {
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to update admin user',
        });
      }
    }
  );

  // Dashboard metrics
  app.get(
    '/api/dashboard/stats',
    requireAuth,
    async (_req: AuthRequest, res) => {
      try {
        const stats = await getDashboardStats();
        res.json(stats);
      } catch (error: unknown) {
        res.status(500).json({
          error:
            error instanceof Error ? error.message : 'Failed to load metrics',
        });
      }
    }
  );

  // Next auto-generated passenger ID
  app.get(
    '/api/passengers/next-id',
    requireAuth,
    async (_req: AuthRequest, res) => {
      try {
        const passengerIdNumber = await generateNextPassengerId();
        res.json({ passengerIdNumber });
      } catch (error: unknown) {
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to generate passenger ID',
        });
      }
    }
  );

  // Passengers CRUD
  app.get('/api/passengers', requireAuth, async (req: AuthRequest, res) => {
    try {
      const search =
        typeof req.query.search === 'string' ? req.query.search : undefined;
      const list = await listPassengers(search);
      res.json(list);
    } catch (error: unknown) {
      res.status(500).json({
        error:
          error instanceof Error ? error.message : 'Failed to load passengers',
      });
    }
  });

  app.post('/api/passengers', requireAuth, async (req: AuthRequest, res) => {
    try {
      const body = req.body;
      if (!body.fullName?.trim()) {
        return res.status(400).json({ error: 'Full Name is required.' });
      }
      if (!body.dateOfBirth?.trim()) {
        return res.status(400).json({ error: 'Date of Birth is required.' });
      }
      if (!body.sex || !['Male', 'Female'].includes(body.sex)) {
        return res
          .status(400)
          .json({ error: 'Sex must be Male or Female.' });
      }

      if (Array.isArray(body.documents)) {
        for (const doc of body.documents as DocumentUploadInput[]) {
          const validationError = validateDocumentFile(doc);
          if (validationError) {
            return res.status(400).json({ error: validationError });
          }
        }
      }

      const created = await createPassengerWithDetails(
        body,
        req.user?.uid || 'system'
      );
      const fullRecord = await getPassengerFullRecord(created.id);
      res.status(201).json(fullRecord);
    } catch (error: unknown) {
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to register passenger',
      });
    }
  });

  app.get(
    '/api/passengers/:id',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) {
          return res.status(400).json({ error: 'Invalid passenger ID' });
        }
        const record = await getPassengerFullRecord(id);
        if (!record) {
          return res.status(404).json({ error: 'Passenger not found' });
        }
        res.json(record);
      } catch (error: unknown) {
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to load passenger details',
        });
      }
    }
  );

  app.put(
    '/api/passengers/:id',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) {
          return res.status(400).json({ error: 'Invalid passenger ID' });
        }
        const body = req.body;
        if (!body.fullName?.trim()) {
          return res.status(400).json({ error: 'Full Name is required.' });
        }
        if (!body.dateOfBirth?.trim()) {
          return res.status(400).json({ error: 'Date of Birth is required.' });
        }
        if (!body.sex || !['Male', 'Female'].includes(body.sex)) {
          return res
            .status(400)
            .json({ error: 'Sex must be Male or Female.' });
        }

        if (Array.isArray(body.documents)) {
          for (const doc of body.documents as DocumentUploadInput[]) {
            const validationError = validateDocumentFile(doc);
            if (validationError) {
              return res.status(400).json({ error: validationError });
            }
          }
        }

        const updated = await updatePassengerWithDetails(
          id,
          body,
          req.user?.uid || 'system'
        );
        if (!updated) {
          return res.status(404).json({ error: 'Passenger not found' });
        }
        const fullRecord = await getPassengerFullRecord(id);
        res.json(fullRecord);
      } catch (error: unknown) {
        res.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to update passenger record',
        });
      }
    }
  );

  app.delete(
    '/api/passengers/:id',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) {
          return res.status(400).json({ error: 'Invalid passenger ID' });
        }
        const deleted = await deletePassenger(id);
        if (!deleted) {
          return res.status(404).json({ error: 'Passenger not found' });
        }
        res.json({ deleted: true, id });
      } catch (error: unknown) {
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to delete passenger',
        });
      }
    }
  );

  // Documents management
  app.post(
    '/api/passengers/:id/documents',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const passengerId = Number(req.params.id);
        if (!Number.isInteger(passengerId)) {
          return res.status(400).json({ error: 'Invalid passenger ID' });
        }
        const files = Array.isArray(req.body.documents)
          ? (req.body.documents as DocumentUploadInput[])
          : [req.body as DocumentUploadInput];

        if (files.length === 0) {
          return res.status(400).json({ error: 'No documents provided.' });
        }

        for (const file of files) {
          const validationError = validateDocumentFile(file);
          if (validationError) {
            return res.status(400).json({ error: validationError });
          }
        }

        const inserted = [];
        for (const file of files) {
          const doc = await addPassengerDocument(
            passengerId,
            file,
            req.user?.uid || 'system'
          );
          inserted.push(doc);
        }

        res.status(201).json(inserted);
      } catch (error: unknown) {
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to upload documents',
        });
      }
    }
  );

  app.get(
    '/api/passengers/:id/documents/full',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const passengerId = Number(req.params.id);
        if (!Number.isInteger(passengerId)) {
          return res.status(400).json({ error: 'Invalid passenger ID' });
        }
        const docs = await getPassengerDocumentsFull(passengerId);
        res.json(docs);
      } catch (error: unknown) {
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to load passenger documents',
        });
      }
    }
  );

  app.patch(
    '/api/passengers/:id/dossier',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const passengerId = Number(req.params.id);
        if (!Number.isInteger(passengerId)) {
          return res.status(400).json({ error: 'Invalid passenger ID' });
        }
        const updated = await updatePassengerDossierNotes(passengerId, req.body);
        if (!updated) {
          return res.status(404).json({ error: 'Passenger not found' });
        }
        const fullRecord = await getPassengerFullRecord(passengerId);
        res.json(fullRecord);
      } catch (error: unknown) {
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to save passenger dossier',
        });
      }
    }
  );

  app.get(
    '/api/documents/:id',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) {
          return res.status(400).json({ error: 'Invalid document ID' });
        }
        const doc = await getDocumentById(id);
        if (!doc) {
          return res.status(404).json({ error: 'Document not found' });
        }
        res.json(doc);
      } catch (error: unknown) {
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to retrieve document',
        });
      }
    }
  );

  app.delete(
    '/api/documents/:id',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) {
          return res.status(400).json({ error: 'Invalid document ID' });
        }
        const deleted = await deleteDocument(id);
        if (!deleted) {
          return res.status(404).json({ error: 'Document not found' });
        }
        res.json({ deleted: true, id });
      } catch (error: unknown) {
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to delete document',
        });
      }
    }
  );

  // Passenger Services
  app.get('/api/services', requireAuth, async (_req: AuthRequest, res) => {
    try {
      const services = await getAllServicesWithPassengers();
      res.json(services);
    } catch (error: unknown) {
      res.status(500).json({
        error:
          error instanceof Error ? error.message : 'Failed to load services',
      });
    }
  });

  app.post(
    '/api/passengers/:id/services',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const passengerId = Number(req.params.id);
        if (!Number.isInteger(passengerId)) {
          return res.status(400).json({ error: 'Invalid passenger ID' });
        }
        if (!req.body.serviceType?.trim()) {
          return res.status(400).json({ error: 'Service Type is required.' });
        }
        const created = await createPassengerService(
          passengerId,
          req.body,
          req.user?.email || 'admin',
          req.user?.uid || 'system'
        );
        res.status(201).json(created);
      } catch (error: unknown) {
        res.status(500).json({
          error:
            error instanceof Error ? error.message : 'Failed to add service',
        });
      }
    }
  );

  app.patch(
    '/api/services/:id',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const serviceId = Number(req.params.id);
        if (!Number.isInteger(serviceId)) {
          return res.status(400).json({ error: 'Invalid service ID' });
        }
        const updated = await updatePassengerService(
          serviceId,
          req.body,
          req.user?.email || 'admin',
          req.user?.uid || 'system'
        );
        if (!updated) {
          return res.status(404).json({ error: 'Service not found' });
        }
        res.json(updated);
      } catch (error: unknown) {
        res.status(500).json({
          error:
            error instanceof Error ? error.message : 'Failed to update service',
        });
      }
    }
  );

  app.delete(
    '/api/services/:id',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const serviceId = Number(req.params.id);
        if (!Number.isInteger(serviceId)) {
          return res.status(400).json({ error: 'Invalid service ID' });
        }
        const deleted = await deletePassengerService(serviceId);
        if (!deleted) {
          return res.status(404).json({ error: 'Service not found' });
        }
        res.json({ deleted: true, id: serviceId });
      } catch (error: unknown) {
        res.status(500).json({
          error:
            error instanceof Error ? error.message : 'Failed to delete service',
        });
      }
    }
  );

  // Payment Management
  app.get('/api/payments', requireAuth, async (_req: AuthRequest, res) => {
    try {
      const payments = await getAllPaymentsWithDetails();
      res.json(payments);
    } catch (error: unknown) {
      res.status(500).json({
        error:
          error instanceof Error ? error.message : 'Failed to load payments',
      });
    }
  });

  app.post(
    '/api/services/:id/payments',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const serviceId = Number(req.params.id);
        if (!Number.isInteger(serviceId)) {
          return res.status(400).json({ error: 'Invalid service ID' });
        }
        const amount = Number(req.body.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          return res
            .status(400)
            .json({ error: 'Payment amount must be greater than zero.' });
        }
        const payment = await recordServicePayment(
          serviceId,
          req.body,
          req.user?.email || 'admin',
          req.user?.uid || 'system'
        );
        if (!payment) {
          return res.status(404).json({ error: 'Service not found' });
        }
        res.status(201).json(payment);
      } catch (error: unknown) {
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to record payment',
        });
      }
    }
  );

  app.delete(
    '/api/payments/:id',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const paymentId = Number(req.params.id);
        if (!Number.isInteger(paymentId)) {
          return res.status(400).json({ error: 'Invalid payment ID' });
        }
        const deleted = await deleteServicePayment(paymentId);
        if (!deleted) {
          return res.status(404).json({ error: 'Payment record not found' });
        }
        res.json({ deleted: true, id: paymentId });
      } catch (error: unknown) {
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to delete payment record',
        });
      }
    }
  );

  // Vite middleware in dev, static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Toya Air Travels server listening on port ${port}`);
  });
}

startServer();
