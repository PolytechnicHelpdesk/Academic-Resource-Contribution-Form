const APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwO7q8KLic-EulBQkrgOt_df4gIwPJ_syE5ISFYtaWWKONLxzfc_Uo6ALCA69bBeJ7o/exec';
const STATUS_API_URL = 'https://polytechnic-helpdesk-status.infoweb-user-as.workers.dev/status';
const form = document.querySelector('#resource-form');
const fileInput = document.querySelector('#resource-file');
const fileName = document.querySelector('#file-name');
const description = form.elements.description;
const department = form.elements.department;
const otherDepartment = form.elements.otherDepartment;
const statusForm = document.querySelector('#status-form');
const receiptLookup = document.querySelector('#receipt-lookup');
const maxFileSize = 5 * 1024 * 1024;
let latestSubmission;

document.querySelector('#year').textContent = new Date().getFullYear();

description.addEventListener('input', () => {
  document.querySelector('#description-count').textContent = description.value.length;
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  fileName.textContent = file ? `${file.name} - ${(file.size / 1024 / 1024).toFixed(2)} MB` : 'PDF only - Maximum file size 5 MB';
});

department.addEventListener('change', () => {
  const isOther = department.value === 'Other';
  document.querySelector('#other-department-field').hidden = !isOther;
  otherDepartment.required = isOther;
  if (!isOther) {
    otherDepartment.value = '';
    setError(otherDepartment);
  }
});

function showUploadStatus(message) {
  document.querySelector('#upload-status').textContent = message;
  document.querySelector('#upload-overlay').hidden = false;
}

function hideUploadStatus() {
  document.querySelector('#upload-overlay').hidden = true;
}

function setError(field, message = '') {
  field.classList.toggle('invalid', Boolean(message));
  const error = field.closest('label')?.querySelector('.error-message');
  if (error) error.textContent = message;
}

function validate() {
  let valid = true;
  form.querySelectorAll('[required]').forEach((field) => {
    if (field.type === 'checkbox') return;
    const message = field.validity.valueMissing ? 'Please complete this field.' : field.validity.typeMismatch ? 'Enter a valid email address.' : '';
    setError(field, message);
    if (message) valid = false;
  });

  const file = fileInput.files[0];
  const link = form.elements.resourceLink.value.trim();
  const groupError = document.querySelector('#file-link-error');
  groupError.textContent = '';
  if (!file && !link) { groupError.textContent = 'Upload a PDF or provide a resource link.'; valid = false; }
  if (file && file.type !== 'application/pdf') { groupError.textContent = 'Please select a PDF file.'; valid = false; }
  if (file && file.size > maxFileSize) { groupError.textContent = 'The PDF must be 5 MB or smaller.'; valid = false; }
  if (link && !form.elements.resourceLink.validity.valid) { setError(form.elements.resourceLink, 'Enter a valid URL.'); valid = false; }

  const consentError = document.querySelector('.consent-error');
  consentError.textContent = form.elements.consent.checked ? '' : 'Please confirm before submitting.';
  return valid && form.elements.consent.checked;
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!validate()) return;
  if (APPS_SCRIPT_WEB_APP_URL.startsWith('PASTE_')) {
    document.querySelector('#file-link-error').textContent = 'The upload service has not been connected yet. Follow GOOGLE_DRIVE_SETUP.md first.';
    return;
  }

  const submitButton = document.querySelector('#submit-button');
  submitButton.disabled = true;
  submitButton.textContent = 'Preparing upload...';
  showUploadStatus('Preparing your document securely...');

  try {
    const file = fileInput.files[0];
    const data = Object.fromEntries(new FormData(form).entries());
    delete data.file;
    delete data.consent;
    if (data.department === 'Other') data.department = `Other - ${data.otherDepartment.trim()}`;
    delete data.otherDepartment;
    data.receiptNumber = createReceiptNumber();
    data.file = file ? { name: file.name, mimeType: file.type, base64: await readFile(file) } : null;

    showUploadStatus(file ? 'Uploading your PDF to the Polytechnic Helpdesk...' : 'Sending your resource details to the Polytechnic Helpdesk...');
    submitButton.textContent = 'Uploading resource...';
    await fetch(APPS_SCRIPT_WEB_APP_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(data) });

    latestSubmission = { ...data, submittedAt: new Date().toISOString() };
    hideUploadStatus();
    downloadReceipt(latestSubmission);
    document.querySelector('#confirmation-receipt-number').textContent = latestSubmission.receiptNumber;
    document.querySelector('#success-dialog').showModal();
  } catch (error) {
    hideUploadStatus();
    document.querySelector('#file-link-error').textContent = 'The contribution could not be sent. Please try again.';
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Submit resource <span aria-hidden="true">→</span>';
  }
});

function createReceiptNumber() {
  const date = new Date();
  const day = `${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const time = `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const values = new Uint32Array(4);
  crypto.getRandomValues(values);
  const random = Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
  return `PH-${day}-${time}-${random}`;
}

function downloadReceipt(data) {
  if (!window.jspdf) return;
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const submitted = new Date(data.submittedAt).toLocaleString();
  const gap = 5;
  const half = (contentWidth - gap) / 2;
  const logoMark = getReceiptLogoMark();

  const drawCell = (x, y, width, label, value, height = 18) => {
    pdf.setFillColor(247, 250, 252);
    pdf.roundedRect(x, y, width, height, 3, 3, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(93, 113, 131);
    pdf.text(label.toUpperCase(), x + 5, y + 5.7);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(24, 42, 59);
    pdf.text(pdf.splitTextToSize(String(value || 'Not provided'), width - 10), x + 5, y + 11.7);
  };

  const drawSection = (title, y) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(18, 50, 82);
    pdf.text(title.toUpperCase(), margin, y);
    pdf.setDrawColor(216, 228, 237);
    pdf.line(margin + 44, y - 1.5, pageWidth - margin, y - 1.5);
  };

  pdf.setFillColor(18, 50, 82);
  pdf.rect(0, 0, pageWidth, 58, 'F');
  pdf.setFillColor(34, 116, 185);
  pdf.rect(0, 55, pageWidth, 3, 'F');
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(pageWidth - 52, 9, 36, 36, 4, 4, 'F');
  if (logoMark) {
    pdf.addImage(logoMark, 'JPEG', pageWidth - 48, 12, 28, 30, undefined, 'FAST');
  } else {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(18, 50, 82);
    pdf.text('PH', pageWidth - 43.2, 31);
  }
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(17);
  pdf.text('POLYTECHNIC HELPDESK', margin, 22);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(199, 221, 238);
  pdf.text('Academic Resource Contribution Receipt', margin, 31);
  pdf.setFontSize(8);
  pdf.text(`Receipt no. ${data.receiptNumber}`, margin, 42);

  pdf.setFillColor(232, 247, 237);
  pdf.roundedRect(margin, 63, contentWidth, 18, 4, 4, 'F');
  pdf.setFillColor(31, 150, 85);
  pdf.circle(margin + 10, 72, 4.4, 'F');
  pdf.setDrawColor(255, 255, 255);
  pdf.setLineWidth(1.1);
  pdf.line(margin + 7.4, 72, margin + 9.5, 74.1);
  pdf.line(margin + 9.5, 74.1, margin + 13, 69.8);
  pdf.setTextColor(24, 104, 58);
  pdf.setFontSize(11);
  pdf.text('Contribution received', margin + 20, 70.8);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(67, 121, 91);
  pdf.text(`Submitted ${submitted}`, margin + 20, 76.5);

  let y = 91;
  drawSection('Contributor details', y);
  y += 7;
  drawCell(margin, y, half, 'Contributor', data.name);
  drawCell(margin + half + gap, y, half, 'Email', data.email);
  y += 22;
  drawCell(margin, y, half, 'Department', data.department);
  drawCell(margin + half + gap, y, half, 'Semester', data.semester);
  y += 28;
  drawSection('Resource information', y);
  y += 7;
  drawCell(margin, y, contentWidth, 'Resource title', data.title);
  y += 22;
  drawCell(margin, y, half, 'Resource type', data.resourceType);
  drawCell(margin + half + gap, y, half, 'Subject / course', data.subject);
  y += 22;
  drawCell(margin, y, half, 'Attached PDF', data.file?.name || 'No PDF attached');
  drawCell(margin + half + gap, y, half, 'Resource link', data.resourceLink || 'Not provided');
  y += 28;
  drawSection('Contributor note', y);
  y += 7;
  const descriptionLines = pdf.splitTextToSize(data.description, contentWidth - 10);
  const descriptionHeight = Math.max(28, descriptionLines.length * 4.3 + 14);
  pdf.setFillColor(247, 250, 252);
  pdf.roundedRect(margin, y, contentWidth, descriptionHeight, 3, 3, 'F');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.2);
  pdf.setTextColor(40, 58, 73);
  pdf.text(descriptionLines, margin + 5, y + 9);
  pdf.setDrawColor(216, 228, 237);
  pdf.line(margin, 283, pageWidth - margin, 283);
  pdf.setFontSize(7.8);
  pdf.setTextColor(107, 125, 140);
  pdf.text('Keep this receipt for your records. Resources are reviewed before publication.', margin, 290);
  pdf.text('Polytechnic Helpdesk - Academic Resource Contribution Portal', pageWidth - margin, 290, { align: 'right' });
  pdf.save(`${data.receiptNumber}-polytechnic-helpdesk-receipt.pdf`);
}

function getReceiptLogoMark() {
  const logo = document.querySelector('#receipt-logo-source');
  if (!logo || !logo.complete || !logo.naturalWidth) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(logo, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.95);
  } catch {
    return null;
  }
}

document.querySelector('#download-receipt').addEventListener('click', () => {
  if (latestSubmission) downloadReceipt(latestSubmission);
});

document.querySelector('#close-dialog').addEventListener('click', () => {
  document.querySelector('#success-dialog').close();
  form.reset();
  document.querySelector('#other-department-field').hidden = true;
  otherDepartment.required = false;
  document.querySelector('#description-count').textContent = '0';
  fileName.textContent = 'PDF only - Maximum file size 5 MB';
  form.querySelectorAll('.error-message').forEach((item) => item.textContent = '');
  form.querySelectorAll('.invalid').forEach((item) => item.classList.remove('invalid'));
});

statusForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const receiptNumber = receiptLookup.value.trim().toUpperCase();
  const error = document.querySelector('#status-error');
  const result = document.querySelector('#status-result');
  error.textContent = '';
  result.hidden = true;
  if (!receiptNumber) {
    error.textContent = 'Enter the receipt number from your PDF receipt.';
    receiptLookup.focus();
    return;
  }
  if (STATUS_API_URL.startsWith('PASTE_')) {
    error.textContent = 'The status service is being set up. Please try again shortly.';
    return;
  }

  const button = statusForm.querySelector('button');
  button.disabled = true;
  button.textContent = 'Checking...';
  try {
    const service = new URL(STATUS_API_URL);
    service.searchParams.set('receipt', receiptNumber);
    const response = await fetch(service.toString());
    if (!response.ok) throw new Error('Status request failed.');
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'Status request failed.');
    if (!data.found) {
      error.textContent = 'No submission was found for that receipt number.';
      return;
    }
    renderSubmissionStatus(data);
  } catch (requestError) {
    error.textContent = 'We could not check the status right now. Please try again later or contact the Polytechnic Helpdesk.';
  } finally {
    button.disabled = false;
    button.innerHTML = 'Check status <span aria-hidden="true">→</span>';
  }
});

function renderSubmissionStatus(response) {
  const result = document.querySelector('#status-result');
  const icon = document.querySelector('#status-icon');
  const label = document.querySelector('#status-label');
  const title = document.querySelector('#status-title-result');
  const message = document.querySelector('#status-message');
  const receipt = document.querySelector('#status-receipt');
  const rawStatus = String(response.status || 'Under Review');
  const normalized = rawStatus.replace(/[\s_-]+/g, ' ').trim().toLowerCase();
  const status = normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
  let type = 'review';
  let symbol = '…';
  let description = 'Your submission is with the Polytechnic Helpdesk team for review.';
  if (normalized === 'accepted') { type = 'accepted'; symbol = '✓'; description = 'Your resource has been accepted for the Polytechnic Helpdesk collection.'; }
  else if (normalized === 'rejected') { type = 'rejected'; symbol = '×'; description = 'Your resource was not accepted. Please contact the helpdesk for more information.'; }
  else if (normalized === 'partially accepted') { type = 'partial'; symbol = '◐'; description = 'Part of your submission was accepted. The helpdesk may contact you with details.'; }
  else if (normalized === 'partially rejected') { type = 'rejected'; symbol = '◐'; description = 'Part of your submission was not accepted. The helpdesk may contact you with details.'; }
  result.className = `status-result ${type}`;
  icon.textContent = symbol;
  label.textContent = 'Current decision';
  title.textContent = status;
  message.textContent = description;
  receipt.textContent = `${response.receiptNumber} · ${response.resourceTitle || 'Academic resource contribution'}`;
  result.hidden = false;
}
