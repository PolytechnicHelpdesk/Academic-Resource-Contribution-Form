const APPS_SCRIPT_WEB_APP_URL = 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE';
const form = document.querySelector('#resource-form');
const fileInput = document.querySelector('#resource-file');
const fileName = document.querySelector('#file-name');
const description = form.elements.description;
const maxFileSize = 5 * 1024 * 1024;

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
    document.querySelector('#success-dialog').showModal();
  } catch (error) {
    document.querySelector('#file-link-error').textContent = 'The contribution could not be sent. Please try again.';
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Submit contribution <span aria-hidden="true">→</span>';
  }
});

document.querySelector('#close-dialog').addEventListener('click', () => {
  document.querySelector('#success-dialog').close();
  form.reset();
  document.querySelector('#description-count').textContent = '0';
  fileName.textContent = 'PDF only · maximum file size 5 MB';
  form.querySelectorAll('.error-message').forEach((item) => item.textContent = '');
  form.querySelectorAll('.invalid').forEach((item) => item.classList.remove('invalid'));
});
