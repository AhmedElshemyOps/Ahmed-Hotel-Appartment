import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Download,
  ShieldCheck,
  ArrowRight,
  Database,
  Trash2,
  FileCheck,
  Info,
} from 'lucide-react';
import {
  parseCSVText,
  validateReservationsImport,
  SAMPLE_TEMPLATES,
  ValidationResult,
} from './realDataManager';
import { Apartment, ImportJobRecord, Reservation } from '../../shared/types';
import { formatAED } from '../revenue/kpiEngine';

interface DataImportViewProps {
  realApartments: Apartment[];
  importHistory: ImportJobRecord[];
  onCommitImport: (job: ImportJobRecord, newReservations: Reservation[]) => void;
  onRollbackImport: (jobId: string) => void;
  onSwitchToRealDataMode: () => void;
}

export const DataImportView: React.FC<DataImportViewProps> = ({
  realApartments,
  importHistory,
  onCommitImport,
  onRollbackImport,
  onSwitchToRealDataMode,
}) => {
  // 8-step wizard state
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [rawText, setRawText] = useState<string>('');
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);

  // Column mapping: systemField -> uploadedColumn
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({
    unitNumber: '',
    guestName: '',
    checkInDate: '',
    checkOutDate: '',
    dailyRateAED: '',
    channel: '',
  });

  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // Template download helper
  const handleDownloadTemplate = (type: 'reservations' | 'expenses' | 'maintenance') => {
    const content = SAMPLE_TEMPLATES[type];
    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + content);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ahmed_Quality_Ops_${type}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Step 1: File Upload or Sample Load
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileSize(file.size);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processFileContent(file.name, file.size, text);
    };
    reader.readAsText(file);
  };

  const handleLoadSampleReservations = () => {
    const text = SAMPLE_TEMPLATES.reservations;
    setFileName('sample_live_reservations_oct2026.csv');
    setFileSize(text.length);
    processFileContent('sample_live_reservations_oct2026.csv', text.length, text);
  };

  const processFileContent = (name: string, size: number, text: string) => {
    setRawText(text);
    const { headers, rows } = parseCSVText(text);
    setParsedHeaders(headers);
    setParsedRows(rows);

    // Auto-detect column mapping
    const initialMapping: Record<string, string> = {
      unitNumber: headers.find(h => /unit|apt|room/i.test(h)) || headers[0] || '',
      guestName: headers.find(h => /guest|name|customer/i.test(h)) || headers[1] || '',
      checkInDate: headers.find(h => /check.*in|arrival|start/i.test(h)) || headers[2] || '',
      checkOutDate: headers.find(h => /check.*out|departure|end/i.test(h)) || headers[3] || '',
      dailyRateAED: headers.find(h => /rate|adr|price|amount/i.test(h)) || headers[4] || '',
      channel: headers.find(h => /channel|source|ota/i.test(h)) || headers[5] || '',
    };
    setColumnMapping(initialMapping);

    // Move to step 2/3 (Inspection & Mapping)
    setCurrentStep(3);
  };

  // Step 4: Validate Data
  const handleRunValidation = () => {
    const validUnitNumbers = new Set(realApartments.map(a => a.unitNumber));
    const result = validateReservationsImport(parsedHeaders, parsedRows, columnMapping, validUnitNumbers);
    setValidationResult(result);
    setCurrentStep(4);
  };

  // Step 6: User Confirmation & Commit Import
  const handleConfirmImport = () => {
    if (!validationResult || validationResult.validRows.length === 0) return;

    const newJob: ImportJobRecord = {
      id: `JOB-${Date.now()}`,
      fileName,
      fileSize,
      uploadedAt: new Date().toISOString(),
      dataType: 'Reservations',
      totalRows: parsedRows.length,
      validRows: validationResult.validRows.length,
      errorRows: validationResult.invalidRows.length,
      status: 'Approved',
      importedBy: 'General Manager (User)',
      approvedAt: new Date().toISOString(),
      columnMapping,
      warnings: validationResult.warnings,
    };

    onCommitImport(newJob, validationResult.validRows);
    setCurrentStep(7); // Success!
  };

  const handleResetWizard = () => {
    setCurrentStep(1);
    setFileName('');
    setRawText('');
    setParsedHeaders([]);
    setParsedRows([]);
    setValidationResult(null);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">Real Property Data Import Center</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
              Mode B: Isolated Real Data
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            8-step audited data ingestion workflow with column mapping, pre-flight validation, and rollback capability.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownloadTemplate('reservations')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>Download CSV Template</span>
          </button>
        </div>
      </div>

      {/* 8-STEP PROGRESS TRACKER */}
      <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between text-xs">
          {[
            { step: 1, label: 'Upload' },
            { step: 2, label: 'Inspect' },
            { step: 3, label: 'Map' },
            { step: 4, label: 'Validate' },
            { step: 5, label: 'Preview' },
            { step: 6, label: 'Approve' },
            { step: 7, label: 'Commit' },
          ].map((s, idx) => (
            <div key={s.step} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                  currentStep === s.step
                    ? 'bg-sky-500 text-slate-950 ring-2 ring-sky-400/50'
                    : currentStep > s.step
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {currentStep > s.step ? '✓' : s.step}
              </div>
              <span className={`hidden sm:inline font-medium ${
                currentStep === s.step ? 'text-white' : 'text-slate-500'
              }`}>
                {s.label}
              </span>
              {idx < 6 && <div className="hidden md:block w-8 h-px bg-slate-800" />}
            </div>
          ))}
        </div>
      </div>

      {/* WIZARD CONTENT BOX */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-6">
        {/* STEP 1: UPLOAD OR LOAD SAMPLE */}
        {currentStep === 1 && (
          <div className="space-y-6 text-center py-8 max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-indigo-950 border border-indigo-800 flex items-center justify-center mx-auto text-sky-400">
              <UploadCloud className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Select Property CSV / Spreadsheet File</h3>
              <p className="text-xs text-slate-400 mt-1">
                Upload your actual reservations, expenses, or maintenance data to populate Mode B (Live Property Mode).
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <label className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs cursor-pointer shadow-lg shadow-sky-950/50 transition-all">
                <UploadCloud className="w-4 h-4" />
                <span>Choose Local CSV File</span>
                <input
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleLoadSampleReservations}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs cursor-pointer transition-all border border-slate-700"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Load Sample Real Reservations (Demo File)</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero data leakage: Real property data is strictly isolated from simulated datasets.</span>
            </div>
          </div>
        )}

        {/* STEP 3: COLUMN MAPPING & INSPECTION */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Step 3 — Inspect & Map Spreadsheet Columns</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  File: <strong className="text-sky-300 font-mono">{fileName}</strong> ({parsedRows.length} rows detected)
                </p>
              </div>

              <button
                onClick={handleResetWizard}
                className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel / Re-upload
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {[
                { key: 'unitNumber', label: 'Apartment / Unit Number *', req: true },
                { key: 'guestName', label: 'Guest Name / Entity *', req: true },
                { key: 'checkInDate', label: 'Check-In Date (YYYY-MM-DD) *', req: true },
                { key: 'checkOutDate', label: 'Check-Out Date (YYYY-MM-DD) *', req: true },
                { key: 'dailyRateAED', label: 'Realized Daily Rate (AED) *', req: true },
                { key: 'channel', label: 'Distribution Channel (OTA/Direct)', req: false },
              ].map(f => (
                <div key={f.key} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between font-semibold text-slate-200">
                    <span>{f.label}</span>
                    {f.req && <span className="text-[10px] text-amber-400 font-mono">Required</span>}
                  </div>

                  <select
                    aria-label={f.label}
                    value={columnMapping[f.key] || ''}
                    onChange={(e) => setColumnMapping({ ...columnMapping, [f.key]: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-sky-500 cursor-pointer"
                  >
                    <option value="">-- Map to Spreadsheet Column --</option>
                    {parsedHeaders.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                onClick={handleRunValidation}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-all cursor-pointer shadow-sm"
              >
                <span>Run Pre-Flight Validation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 & 5: VALIDATION & PREVIEW */}
        {currentStep === 4 && validationResult && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Step 4 & 5 — Validation Diagnostics & Preview</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pre-flight checks verified dates, positive rate values, and 40-unit integrity.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                  {validationResult.validRows.length} Valid Rows
                </span>
                {validationResult.invalidRows.length > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded bg-rose-950 text-rose-300 border border-rose-800 font-mono">
                    {validationResult.invalidRows.length} Errors
                  </span>
                )}
              </div>
            </div>

            {/* Validation Warnings */}
            {validationResult.warnings.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800 text-xs text-amber-300 space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Validation Notices</span>
                </div>
                <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-amber-200/90">
                  {validationResult.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview of Valid Parsed Rows */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Preview of Approved Stays ({validationResult.validRows.length})
              </h4>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Unit</th>
                      <th className="py-2.5 px-3">Guest</th>
                      <th className="py-2.5 px-3">Channel</th>
                      <th className="py-2.5 px-3">Dates</th>
                      <th className="py-2.5 px-3 text-center">Nights</th>
                      <th className="py-2.5 px-3 text-right">Daily Rate</th>
                      <th className="py-2.5 px-3 text-right">Total Room Rev</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono">
                    {validationResult.validRows.slice(0, 8).map((r, i) => (
                      <tr key={i} className="text-slate-300">
                        <td className="py-2 px-3 font-bold text-white">{r.unitId.replace('REAL-APT-', '')}</td>
                        <td className="py-2 px-3 font-sans text-slate-200">{r.guestName}</td>
                        <td className="py-2 px-3 font-sans text-slate-400">{r.channel}</td>
                        <td className="py-2 px-3 text-slate-400">{r.checkInDate} &rarr; {r.checkOutDate}</td>
                        <td className="py-2 px-3 text-center font-bold text-slate-200">{r.nights}</td>
                        <td className="py-2 px-3 text-right">{formatAED(r.dailyRateAED)}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-400">{formatAED(r.totalRoomRevenueAED)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Explicit Human Approval Action */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-slate-300">
                <strong className="text-white block">Step 6: Explicit User Authorization Required</strong>
                Clicking commit will insert {validationResult.validRows.length} verified stays into isolated Real Property dataset #AHQ-8820.
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Back to Mapping
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950 cursor-pointer transition-all"
                >
                  Approve & Commit Real Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 7: COMMIT SUCCESS */}
        {currentStep === 7 && (
          <div className="py-8 text-center space-y-4 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-full bg-emerald-950 border border-emerald-600 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Import Committed Successfully</h3>
              <p className="text-xs text-slate-400">
                Data stored in Isolated Real Property Tenant #AHQ-8820. Historical provenance and rollback points preserved.
              </p>
            </div>

            <div className="pt-3 flex items-center justify-center gap-3">
              <button
                onClick={onSwitchToRealDataMode}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 cursor-pointer"
              >
                Switch to Real Property Mode
              </button>

              <button
                onClick={handleResetWizard}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Upload Another File
              </button>
            </div>
          </div>
        )}
      </div>

      {/* IMPORT HISTORY & ROLLBACK AUDIT TRAIL */}
      <div className="bg-slate-900/80 rounded-xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Import Job Provenance & Rollback History</h3>
            <p className="text-xs text-slate-400 mt-0.5">Audit log of every uploaded dataset with 1-click rollback</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="py-2.5 px-4">Job ID</th>
                <th className="py-2.5 px-3">File Name</th>
                <th className="py-2.5 px-3">Uploaded At</th>
                <th className="py-2.5 px-3 text-center">Valid Rows</th>
                <th className="py-2.5 px-3">Imported By</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {importHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    No real property import jobs recorded yet. Use the upload wizard above to import actual property data.
                  </td>
                </tr>
              ) : (
                importHistory.map(job => (
                  <tr key={job.id} className="text-slate-300">
                    <td className="py-3 px-4 font-mono font-semibold text-sky-400">{job.id}</td>
                    <td className="py-3 px-3 font-medium text-white">{job.fileName}</td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400">{job.uploadedAt.split('T')[0]}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-emerald-400">{job.validRows}</td>
                    <td className="py-3 px-3 text-slate-400">{job.importedBy}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        job.status === 'Approved' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {job.status === 'Approved' && (
                        <button
                          onClick={() => onRollbackImport(job.id)}
                          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 cursor-pointer ml-auto"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Rollback Job</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
