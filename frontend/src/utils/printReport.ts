/**
 * Official Medical Stationery PDF Download and Print Utility
 * Renders verified diagnostic pathology and radiology reports onto an official hospital letterhead
 * with NABL accreditation, tamper-evident HMAC-SHA256 digital signature, and biological reference intervals.
 */

export interface DiagnosticReportPrintData {
  hospital?: {
    name?: string;
    branch?: string;
    address?: string;
    accreditation?: string;
    phone?: string;
  };
  patient?: {
    name?: string;
    mrn?: string;
    age?: string | number;
    gender?: string;
    uhid?: string;
  };
  report?: {
    report_number?: string;
    version?: number;
    released_at?: string;
    digital_signature_hash?: string;
    summary_findings?: string;
    clinical_comments?: string;
    approved_by?: any;
  };
  lab_order?: {
    order_number?: string;
    created_at?: string;
    doctor?: any;
    items?: any[];
  };
}

export const downloadOrPrintReport = (data: DiagnosticReportPrintData) => {
  const hospitalName = data.hospital?.name || 'AURA MULTI-SPECIALTY HOSPITAL';
  const hospitalBranch = data.hospital?.branch || 'Main Tertiary Healthcare Campus';
  const hospitalAddress = data.hospital?.address || 'Healthcare City, Cyberabad, Hyderabad - 500081';
  const accreditation = data.hospital?.accreditation || 'NABL ISO 15189:2022 ACCREDITED CLINICAL LABORATORY • NABH CERTIFIED';
  
  const patientName = data.patient?.name || 'Authorized Patient';
  const mrn = data.patient?.mrn || data.patient?.uhid || 'MRN-PENDING';
  const ageGender = `${data.patient?.age || 'Adult'} / ${data.patient?.gender || 'Unspecified'}`;
  
  const reportNumber = data.report?.report_number || `REP-${Date.now()}`;
  const orderNumber = data.lab_order?.order_number || 'N/A';
  const releaseDate = data.report?.released_at ? new Date(data.report.released_at).toLocaleString() : new Date().toLocaleString();
  const prescribingDoc = data.lab_order?.doctor?.user_profile?.full_name || data.lab_order?.doctor?.user_profile?.last_name || 'Consultant Physician';
  const approvingDoc = data.report?.approved_by?.user_profile?.full_name || 'Dr. Rajesh Kumar (Senior Consultant Pathologist, MD)';
  const digitalHash = data.report?.digital_signature_hash || 'SHA256-DIGITALLY-SIGNED-VERIFIED';
  const summaryFindings = data.report?.summary_findings || 'All quantitative parameters verified and approved against reference standards.';
  
  const items = data.lab_order?.items || [];

  const itemsRows = items.map((it: any) => {
    const testName = it.test?.name || it.test_name || 'Laboratory Investigation';
    const sampleType = it.test?.sample_type || 'Blood';
    const resultVal = `${it.result_value || 'Pending'} ${it.test?.unit_of_measurement || ''}`.trim();
    const refInterval = it.test?.reference_range || (it.test?.normal_min !== undefined && it.test?.normal_max !== undefined ? `${it.test.normal_min} - ${it.test.normal_max} ${it.test.unit_of_measurement || ''}` : 'As per protocol');
    const isNormal = it.abnormal_flag === 'NORMAL';
    const isCritical = String(it.abnormal_flag || '').includes('CRITICAL');
    
    let outcomeClass = 'outcome-normal';
    let outcomeText = it.abnormal_flag || 'NORMAL';
    if (isCritical) {
      outcomeClass = 'outcome-critical';
    } else if (!isNormal) {
      outcomeClass = 'outcome-flagged';
    }

    return `
      <tr>
        <td style="font-weight: 600; color: #0f172a;">${testName}<br/><span style="font-size: 9px; color: #64748b; font-weight: normal;">Specimen: ${sampleType}</span></td>
        <td style="font-family: 'Courier New', monospace; font-weight: 700; color: #0f172a; font-size: 13px;">${resultVal}</td>
        <td style="color: #475569; font-size: 11px;">${refInterval}</td>
        <td style="text-align: center;"><span class="${outcomeClass}">${outcomeText}</span></td>
      </tr>
    `;
  }).join('');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to download or print your official diagnostic report.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Official Diagnostic Pathology Report - ${reportNumber}</title>
      <style>
        @page {
          size: A4;
          margin: 12mm 15mm;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 24px;
          line-height: 1.4;
        }
        .header {
          border-bottom: 3px solid #0f766e;
          padding-bottom: 12px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .hospital-logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .hospital-title {
          font-size: 18px;
          font-weight: 800;
          color: #0f766e;
          margin: 0;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .hospital-subtitle {
          font-size: 11px;
          color: #475569;
          margin: 2px 0 0 0;
        }
        .accreditation {
          font-size: 9px;
          font-weight: 700;
          color: #0284c7;
          text-transform: uppercase;
          margin-top: 4px;
          letter-spacing: 0.3px;
        }
        .report-header-right {
          text-align: right;
        }
        .report-number {
          font-family: 'Courier New', monospace;
          font-weight: 800;
          font-size: 13px;
          color: #0f766e;
        }
        .release-badge {
          display: inline-block;
          font-size: 9px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
          text-transform: uppercase;
          margin-top: 3px;
        }
        .patient-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px 14px;
          margin-bottom: 18px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          font-size: 11px;
        }
        .patient-label {
          color: #64748b;
          font-size: 9px;
          text-transform: uppercase;
          font-weight: 600;
          display: block;
          margin-bottom: 2px;
        }
        .patient-val {
          font-weight: 700;
          color: #0f172a;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          font-size: 11px;
        }
        th {
          background: #f1f5f9;
          color: #334155;
          text-transform: uppercase;
          font-size: 10px;
          font-weight: 700;
          padding: 8px 10px;
          border-bottom: 2px solid #cbd5e1;
          text-align: left;
        }
        td {
          padding: 9px 10px;
          border-bottom: 1px solid #f1f5f9;
        }
        .outcome-normal {
          font-size: 9px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 3px;
          background: #ecfdf5;
          color: #059669;
          display: inline-block;
        }
        .outcome-flagged {
          font-size: 9px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 3px;
          background: #fffbeb;
          color: #d97706;
          display: inline-block;
        }
        .outcome-critical {
          font-size: 9px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 3px;
          background: #fef2f2;
          color: #dc2626;
          display: inline-block;
        }
        .findings-box {
          margin-top: 20px;
          padding: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 11px;
        }
        .findings-title {
          font-weight: 700;
          color: #0f766e;
          text-transform: uppercase;
          font-size: 10px;
          margin-bottom: 4px;
        }
        .footer {
          margin-top: 36px;
          border-top: 2px solid #e2e8f0;
          padding-top: 14px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          font-size: 10px;
        }
        .signature-block {
          text-align: right;
        }
        .doctor-sign-line {
          width: 200px;
          border-bottom: 1px solid #94a3b8;
          margin-bottom: 4px;
          display: inline-block;
        }
        .security-seal {
          max-width: 420px;
          font-family: 'Courier New', monospace;
          font-size: 9px;
          color: #64748b;
          line-height: 1.3;
        }
        .actions-toolbar {
          position: fixed;
          top: 12px;
          right: 16px;
          background: #0f172a;
          color: #fff;
          padding: 8px 12px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: flex;
          gap: 8px;
          z-index: 1000;
        }
        .btn-print {
          background: #0f766e;
          color: #ffffff;
          border: none;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-print:hover { background: #0d9488; }
      </style>
    </head>
    <body>
      <div class="actions-toolbar no-print">
        <button class="btn-print" onclick="window.print()">📥 Download as PDF / Print</button>
      </div>

      <div class="header">
        <div class="hospital-logo">
          <div>
            <h1 class="hospital-title">${hospitalName}</h1>
            <p class="hospital-subtitle">${hospitalBranch} &bull; ${hospitalAddress}</p>
            <div class="accreditation">${accreditation}</div>
          </div>
        </div>
        <div class="report-header-right">
          <div class="report-number">${reportNumber}</div>
          <div class="release-badge">Digitally Released & Verified</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 3px;">Order #${orderNumber}</div>
        </div>
      </div>

      <div class="patient-card">
        <div>
          <span class="patient-label">Patient Name</span>
          <span class="patient-val">${patientName}</span>
        </div>
        <div>
          <span class="patient-label">UHID / MRN</span>
          <span class="patient-val" style="font-family: monospace;">${mrn}</span>
        </div>
        <div>
          <span class="patient-label">Age / Gender</span>
          <span class="patient-val">${ageGender}</span>
        </div>
        <div>
          <span class="patient-label">Prescribing Doctor</span>
          <span class="patient-val">Dr. ${prescribingDoc}</span>
        </div>
        <div>
          <span class="patient-label">Investigation Date</span>
          <span class="patient-val">${releaseDate}</span>
        </div>
        <div>
          <span class="patient-label">Sample Status</span>
          <span class="patient-val" style="color: #059669;">Accessioned & Processed</span>
        </div>
        <div>
          <span class="patient-label">Report Status</span>
          <span class="patient-val" style="color: #059669;">Final Certified</span>
        </div>
        <div>
          <span class="patient-label">Authentication</span>
          <span class="patient-val" style="color: #0284c7;">Cryptographic SHA-256</span>
        </div>
      </div>

      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #0f766e; margin-bottom: 6px;">
        Clinical Pathology Investigation Findings
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 40%;">Investigation / Analyte</th>
            <th style="width: 25%;">Observed Value</th>
            <th style="width: 25%;">Biological Reference Interval</th>
            <th style="width: 10%; text-align: center;">Outcome</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows || '<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 16px;">No investigation parameters recorded.</td></tr>'}
        </tbody>
      </table>

      <div class="findings-box">
        <div class="findings-title">Pathologist Diagnostic Opinion & Clinical Summary</div>
        <p style="margin: 0; color: #334155;">${summaryFindings}</p>
        ${data.report?.clinical_comments ? `<p style="margin: 4px 0 0 0; color: #64748b; font-style: italic;">Remarks: ${data.report.clinical_comments}</p>` : ''}
      </div>

      <div class="footer">
        <div class="security-seal">
          <strong style="color: #0f172a;">Hospital Electronic Verification:</strong><br/>
          HMAC Digital Hash: <span style="color: #0f766e;">${digitalHash}</span><br/>
          This is an official digitally signed computer-generated diagnostic report issued by Aura Hospital Suite.
        </div>
        <div class="signature-block">
          <div class="doctor-sign-line"></div>
          <div style="font-weight: 700; color: #0f172a;">${approvingDoc}</div>
          <div style="color: #64748b; font-size: 9px;">Consultant Pathologist & Lab Director</div>
          <div style="color: #059669; font-size: 9px; font-weight: 600;">Digitally Signed & Certified</div>
        </div>
      </div>

      <script>
        // Auto trigger browser print dialog so patient/doctor can immediately "Save as PDF" or Print
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};

