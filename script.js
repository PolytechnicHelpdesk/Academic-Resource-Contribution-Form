const APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwO7q8KLic-EulBQkrgOt_df4gIwPJ_syE5ISFYtaWWKONLxzfc_Uo6ALCA69bBeJ7o/exec';
const form = document.querySelector('#resource-form');
const fileInput = document.querySelector('#resource-file');
const fileName = document.querySelector('#file-name');
const description = form.elements.description;
const maxFileSize = 5 * 1024 * 1024;
let latestSubmission;

document.querySelector('#year').textContent = new Date().getFullYear();
description.addEventListener('input', () => document.querySelector('#description-count').textContent = description.value.length);
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  fileName.textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : 'PDF only · maximum file size 5 MB';
});

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
  submitButton.textContent = 'Sending contribution…';
  try {
    const file = fileInput.files[0];
    const data = Object.fromEntries(new FormData(form).entries());
    delete data.file;
    delete data.consent;
    data.file = file ? { name: file.name, mimeType: file.type, base64: await readFile(file) } : null;
    await fetch(APPS_SCRIPT_WEB_APP_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(data) });
    latestSubmission = { ...data, receiptNumber: `PH-${Date.now().toString().slice(-8)}`, submittedAt: new Date().toISOString() };
    downloadReceipt(latestSubmission);
    document.querySelector('#success-dialog').showModal();
  } catch (error) {
    document.querySelector('#file-link-error').textContent = 'The contribution could not be sent. Please try again.';
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Submit contribution <span aria-hidden="true">→</span>';
  }
});

function downloadReceipt(data) {
  if (!window.jspdf) return;
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 18;
  let y = 20;

  pdf.setFillColor(27, 94, 69);
  pdf.rect(0, 0, pageWidth, 44, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(19);
  pdf.text('POLYTECHNIC HELPDESK', margin, 19);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text('Academic Resource Contribution Receipt', margin, 27);
  pdf.setFontSize(8);
  pdf.text(`Receipt No. ${data.receiptNumber}`, margin, 35);
  y = 58;

  pdf.setTextColor(22, 38, 30);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('Contribution received', margin, y);
  y += 9;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(83, 97, 88);
  pdf.text(`Submitted on ${new Date(data.submittedAt).toLocaleString()}`, margin, y);
  y += 13;

  const rows = [
    ['Contributor', data.name], ['Email', data.email], ['Department', data.department], ['Semester', data.semester],
    ['Resource title', data.title], ['Resource type', data.resourceType], ['Subject / course', data.subject],
    ['PDF file', data.file?.name || 'Not attached'], ['Resource link', data.resourceLink || 'Not provided']
  ];
  rows.forEach(([label, value], index) => {
    const height = Math.max(10, pdf.getTextDimensions(pdf.splitTextToSize(String(value), 118)).h + 5);
    if (index % 2 === 0) { pdf.setFillColor(245, 248, 244); pdf.rect(margin, y - 5, pageWidth - margin * 2, height, 'F'); }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(27, 94, 69);
    pdf.text(label, margin + 4, y + 1);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(36, 48, 41);
    pdf.text(pdf.splitTextToSize(String(value), 118), margin + 43, y + 1);
    y += height;
  });
  y += 4;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(27, 94, 69);
  pdf.text('Description', margin, y);
  y += 6;
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(36, 48, 41);
  pdf.setFontSize(9);
  pdf.text(pdf.splitTextToSize(data.description, pageWidth - margin * 2), margin, y);
  pdf.setDrawColor(202, 93, 55);
  pdf.line(margin, 281, pageWidth - margin, 281);
  pdf.setFontSize(8);
  pdf.setTextColor(100, 113, 106);
  pdf.text('Keep this receipt for your records. Your contribution will be reviewed before publication.', margin, 288);
  pdf.save(`${data.receiptNumber}-polytechnic-helpdesk-receipt.pdf`);
}

document.querySelector('#download-receipt').addEventListener('click', () => {
  if (latestSubmission) downloadReceipt(latestSubmission);
});

document.querySelector('#close-dialog').addEventListener('click', () => {
  document.querySelector('#success-dialog').close();
  form.reset();
  document.querySelector('#description-count').textContent = '0';
  fileName.textContent = 'PDF only · maximum file size 5 MB';
  form.querySelectorAll('.error-message').forEach((item) => item.textContent = '');
  form.querySelectorAll('.invalid').forEach((item) => item.classList.remove('invalid'));
});
