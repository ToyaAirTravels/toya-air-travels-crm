import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckSquare,
  CloudUpload,
  FileText,
  Plus,
  RotateCcw,
  Save,
  Square,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  formatFileSize,
  isSupportedDocumentFile,
  isSupportedPhotoFile,
  readFileAsDataUrl,
} from '../lib/fileUtils';
import { DOCUMENT_CATEGORIES } from '../types';
import type {
  FamilyMember,
  PassengerDocumentMeta,
  PassengerFullRecord,
  PendingDocumentUpload,
} from '../types';
import { CameraCaptureModal } from './CameraCaptureModal';

interface PassengerRegistrationFormProps {
  editingRecord: PassengerFullRecord | null;
  onSuccess: (savedRecord: PassengerFullRecord) => void;
  onCancelEdit?: () => void;
}

export function PassengerRegistrationForm({
  editingRecord,
  onSuccess,
  onCancelEdit,
}: PassengerRegistrationFormProps) {
  const { apiFetch } = useAuth();

  // Section 1: Passenger Information
  const [passengerIdNumber, setPassengerIdNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [sex, setSex] = useState<'Male' | 'Female'>('Male');
  const [nationality, setNationality] = useState('Bangladeshi');
  const [nidNumber, setNidNumber] = useState('');
  const [birthRegistrationNumber, setBirthRegistrationNumber] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappSameAsMobile, setWhatsappSameAsMobile] = useState(false);
  const [presentAddress, setPresentAddress] = useState('');
  const [passportPhotoData, setPassportPhotoData] = useState<string | null>(
    null
  );

  // Section 2: Family Contact Information
  const [fatherName, setFatherName] = useState('');
  const [fatherPhone, setFatherPhone] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherPhone, setMotherPhone] = useState('');
  const [spouseName, setSpouseName] = useState('');
  const [spousePhone, setSpousePhone] = useState('');
  const [otherFamily, setOtherFamily] = useState<FamilyMember[]>([]);

  // Section 3: Emergency Contact Details
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [emergencyMobile, setEmergencyMobile] = useState('');
  const [emergencyAddress, setEmergencyAddress] = useState('');
  const [emergencyPhotoData, setEmergencyPhotoData] = useState<string | null>(
    null
  );

  // Section 4: Documents & Remarks
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [uploadCategory, setUploadCategory] = useState<string>(
    DOCUMENT_CATEGORIES[0]
  );
  const [stagedDocs, setStagedDocs] = useState<PendingDocumentUpload[]>([]);
  const [existingDocs, setExistingDocs] = useState<PassengerDocumentMeta[]>([]);
  const [additionalDocumentsNote, setAdditionalDocumentsNote] = useState('');
  const [remarks, setRemarks] = useState('');

  // UI state
  const [cameraTarget, setCameraTarget] = useState<
    'passenger' | 'emergency' | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingDocsToCloud, setSavingDocsToCloud] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const passengerPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const emergencyPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const docFilesInputRef = useRef<HTMLInputElement | null>(null);

  const resetForm = async (fetchNextId = true) => {
    setFullName('');
    setDateOfBirth('');
    setSex('Male');
    setNationality('Bangladeshi');
    setNidNumber('');
    setBirthRegistrationNumber('');
    setPassportNumber('');
    setMobileNumber('');
    setWhatsappNumber('');
    setWhatsappSameAsMobile(false);
    setPresentAddress('');
    setPassportPhotoData(null);
    setFatherName('');
    setFatherPhone('');
    setMotherName('');
    setMotherPhone('');
    setSpouseName('');
    setSpousePhone('');
    setOtherFamily([]);
    setEmergencyName('');
    setEmergencyRelation('');
    setEmergencyMobile('');
    setEmergencyAddress('');
    setEmergencyPhotoData(null);
    setSelectedCategories([]);
    setStagedDocs([]);
    setExistingDocs([]);
    setAdditionalDocumentsNote('');
    setRemarks('');
    setErrorMsg(null);
    if (fetchNextId) {
      try {
        const res = await apiFetch<{ passengerIdNumber: string }>(
          '/api/passengers/next-id'
        );
        setPassengerIdNumber(res.passengerIdNumber);
      } catch {
        setPassengerIdNumber('');
      }
    }
  };

  useEffect(() => {
    if (editingRecord) {
      const p = editingRecord.passenger;
      setPassengerIdNumber(p.passengerIdNumber || '');
      setFullName(p.fullName || '');
      setDateOfBirth(p.dateOfBirth || '');
      setSex(p.sex === 'Female' ? 'Female' : 'Male');
      setNationality(p.nationality || 'Bangladeshi');
      setNidNumber(p.nidNumber || '');
      setBirthRegistrationNumber(p.birthRegistrationNumber || '');
      setPassportNumber(p.passportNumber || '');
      setMobileNumber(p.mobileNumber || '');
      setWhatsappNumber(p.whatsappNumber || '');
      setWhatsappSameAsMobile(Boolean(p.whatsappSameAsMobile));
      setPresentAddress(p.presentAddress || '');
      setPassportPhotoData(p.passportPhotoData || null);
      setSelectedCategories(p.selectedDocumentCategories || []);
      setAdditionalDocumentsNote(p.additionalDocumentsNote || '');
      setRemarks(p.remarks || '');
      setExistingDocs(editingRecord.documents || []);
      setStagedDocs([]);

      const fam = editingRecord.familyMembers || [];
      const father = fam.find((f) => f.relation === 'Father');
      const mother = fam.find((f) => f.relation === 'Mother');
      const spouse = fam.find((f) => f.relation === 'Spouse');
      const others = fam.filter(
        (f) => !['Father', 'Mother', 'Spouse'].includes(f.relation)
      );
      setFatherName(father?.fullName || '');
      setFatherPhone(father?.mobileNumber || '');
      setMotherName(mother?.fullName || '');
      setMotherPhone(mother?.mobileNumber || '');
      setSpouseName(spouse?.fullName || '');
      setSpousePhone(spouse?.mobileNumber || '');
      setOtherFamily(others);

      const em = editingRecord.emergencyContact;
      setEmergencyName(em?.contactName || '');
      setEmergencyRelation(em?.relationship || '');
      setEmergencyMobile(em?.mobileNumber || '');
      setEmergencyAddress(em?.address || '');
      setEmergencyPhotoData(em?.photoData || null);
      setErrorMsg(null);
      setSuccessMsg(null);
    } else {
      resetForm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRecord]);

  useEffect(() => {
    if (whatsappSameAsMobile) {
      setWhatsappNumber(mobileNumber);
    }
  }, [whatsappSameAsMobile, mobileNumber]);

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'passenger' | 'emergency'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isSupportedPhotoFile(file)) {
      setErrorMsg('Photo must be a JPG, JPEG, or PNG image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Photo file size must be under 5 MB.');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (target === 'passenger') {
        setPassportPhotoData(dataUrl);
      } else {
        setEmergencyPhotoData(dataUrl);
      }
      setErrorMsg(null);
    } catch {
      setErrorMsg('Failed to read selected photo.');
    }
    e.target.value = '';
  };

  const handleDocFilesSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newStaged: PendingDocumentUpload[] = [];
    for (const file of files) {
      if (!isSupportedDocumentFile(file)) {
        setErrorMsg(
          `Unsupported file "${file.name}". Supported file formats: PDF, JPG, JPEG and PNG.`
        );
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setErrorMsg(`File "${file.name}" exceeds the 10 MB limit.`);
        continue;
      }
      const dataUrl = await readFileAsDataUrl(file);
      newStaged.push({
        tempId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        category: uploadCategory,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        fileData: dataUrl,
      });
    }

    if (newStaged.length > 0) {
      setStagedDocs((prev) => [...prev, ...newStaged]);
      if (!selectedCategories.includes(uploadCategory)) {
        setSelectedCategories((prev) => [...prev, uploadCategory]);
      }
      setErrorMsg(null);
    }
    e.target.value = '';
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const addFamilyRow = (relation: string) => {
    setOtherFamily((prev) => [
      ...prev,
      { relation, fullName: '', mobileNumber: '', notes: '' },
    ]);
  };

  const updateFamilyRow = (
    idx: number,
    field: keyof FamilyMember,
    value: string
  ) => {
    setOtherFamily((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );
  };

  const removeFamilyRow = (idx: number) => {
    setOtherFamily((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDeleteExistingDoc = async (docId: number) => {
    try {
      await apiFetch(`/api/documents/${docId}`, { method: 'DELETE' });
      setExistingDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to remove document.'
      );
    }
  };

  const handleSaveQueuedDocsToCloud = async () => {
    if (!editingRecord || stagedDocs.length === 0) return;
    setSavingDocsToCloud(true);
    setErrorMsg(null);
    try {
      const inserted = await apiFetch<PassengerDocumentMeta[]>(
        `/api/passengers/${editingRecord.passenger.id}/documents`,
        {
          method: 'POST',
          body: JSON.stringify({
            documents: stagedDocs.map((d) => ({
              category: d.category,
              fileName: d.fileName,
              mimeType: d.mimeType,
              fileSize: d.fileSize,
              fileData: d.fileData,
            })),
          }),
        }
      );
      setExistingDocs((prev) => [...inserted, ...prev]);
      setStagedDocs([]);
      setSuccessMsg(`${inserted.length} document(s) saved to cloud storage.`);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Failed to save documents to cloud.'
      );
    } finally {
      setSavingDocsToCloud(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!fullName.trim()) {
      setErrorMsg('Full Name is required.');
      return;
    }
    if (!dateOfBirth) {
      setErrorMsg('Date of Birth is required.');
      return;
    }

    const familyMembers: FamilyMember[] = [];
    if (fatherName.trim()) {
      familyMembers.push({
        relation: 'Father',
        fullName: fatherName.trim(),
        mobileNumber: fatherPhone.trim() || null,
      });
    }
    if (motherName.trim()) {
      familyMembers.push({
        relation: 'Mother',
        fullName: motherName.trim(),
        mobileNumber: motherPhone.trim() || null,
      });
    }
    if (spouseName.trim()) {
      familyMembers.push({
        relation: 'Spouse',
        fullName: spouseName.trim(),
        mobileNumber: spousePhone.trim() || null,
      });
    }
    otherFamily.forEach((m) => {
      if (m.fullName.trim()) {
        familyMembers.push({
          relation: m.relation,
          fullName: m.fullName.trim(),
          mobileNumber: m.mobileNumber?.trim() || null,
          notes: m.notes?.trim() || null,
        });
      }
    });

    const payload = {
      passengerIdNumber: passengerIdNumber.trim() || undefined,
      fullName: fullName.trim(),
      dateOfBirth,
      sex,
      nationality: nationality.trim() || 'Bangladeshi',
      nidNumber: nidNumber.trim() || null,
      birthRegistrationNumber: birthRegistrationNumber.trim() || null,
      passportNumber: passportNumber.trim() || null,
      mobileNumber: mobileNumber.trim() || null,
      whatsappNumber: whatsappSameAsMobile
        ? mobileNumber.trim() || null
        : whatsappNumber.trim() || null,
      whatsappSameAsMobile,
      presentAddress: presentAddress.trim() || null,
      passportPhotoData,
      selectedDocumentCategories: selectedCategories,
      additionalDocumentsNote: additionalDocumentsNote.trim() || null,
      remarks: remarks.trim() || null,
      familyMembers,
      emergencyContact:
        emergencyName.trim() ||
        emergencyMobile.trim() ||
        emergencyAddress.trim() ||
        emergencyPhotoData
          ? {
              contactName: emergencyName.trim() || 'Emergency Contact',
              relationship: emergencyRelation.trim() || null,
              mobileNumber: emergencyMobile.trim() || null,
              address: emergencyAddress.trim() || null,
              photoData: emergencyPhotoData,
            }
          : null,
      documents: stagedDocs.map((d) => ({
        category: d.category,
        fileName: d.fileName,
        mimeType: d.mimeType,
        fileSize: d.fileSize,
        fileData: d.fileData,
        notes: d.notes || null,
      })),
    };

    setSubmitting(true);
    try {
      const saved = editingRecord
        ? await apiFetch<PassengerFullRecord>(
            `/api/passengers/${editingRecord.passenger.id}`,
            {
              method: 'PUT',
              body: JSON.stringify(payload),
            }
          )
        : await apiFetch<PassengerFullRecord>('/api/passengers', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      setSuccessMsg(
        editingRecord
          ? `Passenger record ${saved.passenger.passengerIdNumber} updated.`
          : `Passenger ${saved.passenger.fullName} (${saved.passenger.passengerIdNumber}) registered.`
      );
      if (!editingRecord) {
        await resetForm(true);
      }
      onSuccess(saved);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to save passenger record.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl">
      {/* Form Title Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-blue-700">
              TOYA AIR TRAVELS · PASSENGER PROFILE · FAMILY · EMERGENCY · DOCUMENTS
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {editingRecord
                ? `Edit Passenger Record — ${editingRecord.passenger.fullName}`
                : 'Passenger Registration Form'}
            </h2>
          </div>
          {editingRecord && onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              Cancel Editing
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {successMsg}
          </div>
        )}
      </div>

      {/* 1. Passenger Information */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-base font-semibold text-slate-900">
            01. Passenger Information
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Passport photo, personal identification details, date of birth, and
            contact address.
          </p>
        </div>

        {/* Passport Photo Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="h-28 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center">
            {passportPhotoData ? (
              <img
                src={passportPhotoData}
                alt="Passenger Passport"
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-9 w-9 text-slate-400" />
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-900">
              Passenger Passport Photo
            </p>
            <p className="text-xs text-slate-500">
              Upload passenger photo or capture directly from webcam (JPG, PNG).
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <input
                ref={passengerPhotoInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                onChange={(e) => handlePhotoUpload(e, 'passenger')}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => passengerPhotoInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload Photo
              </button>
              <button
                type="button"
                onClick={() => setCameraTarget('passenger')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Camera className="h-3.5 w-3.5" />
                Take Photo
              </button>
              {passportPhotoData && (
                <button
                  type="button"
                  onClick={() => setPassportPhotoData(null)}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap shrink-0"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Personal Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Passenger ID Number
            </label>
            <input
              type="text"
              value={passengerIdNumber}
              onChange={(e) => setPassengerIdNumber(e.target.value)}
              placeholder="TAT-2026-0001"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Full Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter passenger full name as per passport"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Date of Birth <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              required
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Sex <span className="text-red-600">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['Male', 'Female'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSex(option)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    sex === option
                      ? 'border-blue-700 bg-blue-50 text-blue-800'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Nationality
            </label>
            <input
              type="text"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              placeholder="Bangladeshi"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              NID Number
            </label>
            <input
              type="text"
              value={nidNumber}
              onChange={(e) => setNidNumber(e.target.value)}
              placeholder="National ID number"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Birth Registration Number
            </label>
            <input
              type="text"
              value={birthRegistrationNumber}
              onChange={(e) => setBirthRegistrationNumber(e.target.value)}
              placeholder="17-digit birth registration"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Passport Number
            </label>
            <input
              type="text"
              value={passportNumber}
              onChange={(e) => setPassportNumber(e.target.value.toUpperCase())}
              placeholder="e.g. A01234567"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Mobile Number
            </label>
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="+880 1XXX-XXXXXX"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-700">
                WhatsApp Number
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whatsappSameAsMobile}
                  onChange={(e) => setWhatsappSameAsMobile(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
                />
                Same as Mobile Number
              </label>
            </div>
            <input
              type="tel"
              value={whatsappNumber}
              disabled={whatsappSameAsMobile}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="+880 1XXX-XXXXXX"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-500 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Present Address
            </label>
            <textarea
              rows={2}
              value={presentAddress}
              onChange={(e) => setPresentAddress(e.target.value)}
              placeholder="House, Road, Village/Area, Thana/Upazila, District"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* 2. Passenger Family Contact Information */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-base font-semibold text-slate-900">
            02. Passenger Family Contact Information
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Record parents, spouse, and other family members (Son, Brother,
            Sister) with their contact details.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Father&apos;s Name
            </label>
            <input
              type="text"
              value={fatherName}
              onChange={(e) => setFatherName(e.target.value)}
              placeholder="Father's full name"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Father&apos;s Mobile Number
            </label>
            <input
              type="tel"
              value={fatherPhone}
              onChange={(e) => setFatherPhone(e.target.value)}
              placeholder="Optional contact number"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Mother&apos;s Name
            </label>
            <input
              type="text"
              value={motherName}
              onChange={(e) => setMotherName(e.target.value)}
              placeholder="Mother's full name"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Mother&apos;s Mobile Number
            </label>
            <input
              type="tel"
              value={motherPhone}
              onChange={(e) => setMotherPhone(e.target.value)}
              placeholder="Optional contact number"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Spouse&apos;s Name
            </label>
            <input
              type="text"
              value={spouseName}
              onChange={(e) => setSpouseName(e.target.value)}
              placeholder="Spouse's full name (if applicable)"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Spouse&apos;s Mobile Number
            </label>
            <input
              type="tel"
              value={spousePhone}
              onChange={(e) => setSpousePhone(e.target.value)}
              placeholder="Optional contact number"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Other Family Members */}
        <div className="border-t border-slate-100 pt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">
                Other Family Members
              </h4>
              <p className="text-xs text-slate-500">
                Record family members and their contact information.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {['Son', 'Brother', 'Sister', 'Daughter', 'Other'].map((rel) => (
                <button
                  key={rel}
                  type="button"
                  onClick={() => addFamilyRow(rel)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add {rel}
                </button>
              ))}
            </div>
          </div>

          {otherFamily.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-xs text-slate-500">
              No additional family members added yet. Use the buttons above to add
              Son, Brother, Sister, or other relatives.
            </div>
          ) : (
            <div className="space-y-3">
              {otherFamily.map((member, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end border-b border-slate-100 pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Relation
                    </label>
                    <select
                      value={member.relation}
                      onChange={(e) =>
                        updateFamilyRow(index, 'relation', e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    >
                      <option value="Son">Son</option>
                      <option value="Brother">Brother</option>
                      <option value="Sister">Sister</option>
                      <option value="Daughter">Daughter</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={member.fullName}
                      onChange={(e) =>
                        updateFamilyRow(index, 'fullName', e.target.value)
                      }
                      placeholder={`${member.relation}'s full name`}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      value={member.mobileNumber || ''}
                      onChange={(e) =>
                        updateFamilyRow(index, 'mobileNumber', e.target.value)
                      }
                      placeholder="Contact number"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Notes
                    </label>
                    <input
                      type="text"
                      value={member.notes || ''}
                      onChange={(e) =>
                        updateFamilyRow(index, 'notes', e.target.value)
                      }
                      placeholder="Optional"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeFamilyRow(index)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      aria-label="Remove family member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 3. Passenger Emergency Contact Details */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-base font-semibold text-slate-900">
            03. Passenger Emergency Contact Details
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Primary emergency point of contact, address, and verification photo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Emergency Contact Name
            </label>
            <input
              type="text"
              value={emergencyName}
              onChange={(e) => setEmergencyName(e.target.value)}
              placeholder="Contact person full name"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Relationship
            </label>
            <input
              type="text"
              value={emergencyRelation}
              onChange={(e) => setEmergencyRelation(e.target.value)}
              placeholder="e.g. Brother, Father, Spouse"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Mobile Number
            </label>
            <input
              type="tel"
              value={emergencyMobile}
              onChange={(e) => setEmergencyMobile(e.target.value)}
              placeholder="+880 1XXX-XXXXXX"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Address
            </label>
            <textarea
              rows={2}
              value={emergencyAddress}
              onChange={(e) => setEmergencyAddress(e.target.value)}
              placeholder="Emergency contact full address"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pt-2">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center">
            {emergencyPhotoData ? (
              <img
                src={emergencyPhotoData}
                alt="Emergency Contact"
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-8 w-8 text-slate-400" />
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-900">
              Emergency Contact Photo
            </p>
            <p className="text-xs text-slate-500">
              Upload an existing photo or take a new photo.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <input
                ref={emergencyPhotoInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                onChange={(e) => handlePhotoUpload(e, 'emergency')}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => emergencyPhotoInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload Photo
              </button>
              <button
                type="button"
                onClick={() => setCameraTarget('emergency')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Camera className="h-3.5 w-3.5" />
                Take Photo
              </button>
              {emergencyPhotoData && (
                <button
                  type="button"
                  onClick={() => setEmergencyPhotoData(null)}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap shrink-0"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Documents & Remarks */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              04. Documents &amp; Remarks
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Upload and manage passenger documents. Multiple files supported.
            </p>
          </div>
          <span className="font-mono text-xs font-medium text-slate-600">
            {selectedCategories.length} Document Categories Selected
          </span>
        </div>

        {/* 12 Document Categories Checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {DOCUMENT_CATEGORIES.map((category) => {
            const checked = selectedCategories.includes(category);
            return (
              <button
                key={category}
                type="button"
                onClick={() => toggleCategory(category)}
                className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors ${
                  checked
                    ? 'border-blue-600 bg-blue-50/70 text-slate-900 font-medium'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {checked ? (
                  <CheckSquare className="h-4 w-4 text-blue-700 shrink-0" />
                ) : (
                  <Square className="h-4 w-4 text-slate-400 shrink-0" />
                )}
                <span className="truncate">{category}</span>
              </button>
            );
          })}
        </div>

        {/* Multi-file Upload Zone */}
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex-1 max-w-xs">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Assign Document Category for Upload
              </label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <input
                ref={docFilesInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={handleDocFilesSelected}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => docFilesInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Upload className="h-4 w-4" />
                Upload Files (Multiple)
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Supported file formats: PDF, JPG, JPEG and PNG.
          </p>

          {/* Existing Uploaded Docs (Edit mode) */}
          {existingDocs.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-700">
                Saved Documents ({existingDocs.length})
              </p>
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                {existingDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {doc.fileName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {doc.category} · {formatFileSize(doc.fileSize)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteExistingDoc(doc.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      aria-label="Delete saved document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Newly Staged Docs */}
          {stagedDocs.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-blue-800">
                  Files Queued for Cloud Upload ({stagedDocs.length})
                </p>
                {editingRecord ? (
                  <button
                    type="button"
                    onClick={handleSaveQueuedDocsToCloud}
                    disabled={savingDocsToCloud}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    <CloudUpload className="h-3.5 w-3.5" />
                    {savingDocsToCloud
                      ? 'Saving to Cloud...'
                      : 'Save Documents to Cloud'}
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500">
                    Uploaded automatically when you click Save Passenger Record
                  </span>
                )}
              </div>
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                {stagedDocs.map((doc) => (
                  <div
                    key={doc.tempId}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {doc.fileName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {doc.category} · {formatFileSize(doc.fileSize)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setStagedDocs((prev) =>
                          prev.filter((d) => d.tempId !== doc.tempId)
                        )
                      }
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      aria-label="Remove staged file"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Additional Documents
            </label>
            <textarea
              rows={3}
              value={additionalDocumentsNote}
              onChange={(e) => setAdditionalDocumentsNote(e.target.value)}
              placeholder="List any additional supporting documents or pending papers"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Remarks / Notes
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Internal agency notes, travel preferences, or special remarks"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Form Actions */}
      <div className="flex flex-wrap items-center justify-end gap-3 pb-6">
        <button
          type="button"
          onClick={() => {
            if (editingRecord && onCancelEdit) {
              onCancelEdit();
            } else {
              resetForm(true);
            }
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
        >
          <RotateCcw className="h-4 w-4" />
          {editingRecord ? 'Cancel' : 'Reset Form'}
        </button>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
        >
          <Save className="h-4 w-4" />
          {submitting
            ? 'Saving...'
            : editingRecord
              ? 'Update Passenger Record'
              : 'Save Passenger Record'}
        </button>
      </div>

      {cameraTarget && (
        <CameraCaptureModal
          title={
            cameraTarget === 'passenger'
              ? 'Take Passenger Passport Photo'
              : 'Take Emergency Contact Photo'
          }
          onCapture={(dataUrl) => {
            if (cameraTarget === 'passenger') {
              setPassportPhotoData(dataUrl);
            } else {
              setEmergencyPhotoData(dataUrl);
            }
          }}
          onClose={() => setCameraTarget(null)}
        />
      )}
    </form>
  );
}
