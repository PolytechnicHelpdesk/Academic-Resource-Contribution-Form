const form = document.querySelector('#resource-form');
const fileInput = document.querySelector('#resource-file');
const fileName = document.querySelector('#file-name');
const dialog = document.querySelector('#success-dialog');
const description = form.elements.description;
const maxFileSize = 10 * 1024 * 1024;
let latestContribution;

document.querySelector('#year').textContent = new Date().getFullYear();

description.addEventListener('input', () => {
  document.querySelector('#description-count').textContent = description.value.length;
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  fileName.textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : 'PDF, DOCX, PPTX, XLSX, ZIP or image · max 10 MB';
});

function setError(element, message = '') {
  element.classList.toggle('invalid', Boolean(message));
  const error = element.closest('label')?.querySelector('.error-message');
  if (error) error.textContent = message;
}

function validateForm() {
  let valid = true;
  form.querySelectorAll('[required]').forEach((field) => {
    if (field.type === 'checkbox') return;
    const message = field.validity.valueMissing ? 'Please complete this field.' : field.validity.typeMismatch ? 'Enter a valid email address.' : '';
    setError(field, message);
    if (message) valid = false;
  });

  const consent = form.elements.consent;
  document.querySelector('.consent-error').textContent = consent.checked ? '' : 'Please confirm before submitting.';
  if (!consent.checked) valid = false;

  const file = fileInput.files[0];
  const link = form.elements.resourceLink.value.trim();
  const groupError = document.querySelector('#file-link-error');
  groupError.textContent = '';
  if (!file && !link) { groupError.textContent = 'Add a resource file or a resource link.'; valid = false; }
  if (file && file.size > maxFileSize) { groupError.textContent = 'The selected file is larger than 10 MB.'; valid = false; }
  if (link && !form.elements.resourceLink.validity.valid) { setError(form.elements.resourceLink, 'Enter a valid URL.'); valid = false; }
  return valid;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!validateForm()) {
    form.querySelector('.invalid, .consent-error:not(:empty), #file-link-error:not(:empty)')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const data = Object.fromEntries(new FormData(form).entries());
  data.file = fileInput.files[0] ? { name: fileInput.files[0].name, size: fileInput.files[0].size, type: fileInput.files[0].type } : null;
  data.submittedAt = new Date().toISOString();
  data.reference = `PH-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  delete data.consent;
  latestContribution = data;

  const saved = JSON.parse(localStorage.getItem('polytechnic-helpdesk-contributions') || '[]');
  saved.push(data);
  localStorage.setItem('polytechnic-helpdesk-contributions', JSON.stringify(saved));
  document.querySelector('#reference-number').textContent = data.reference;
  dialog.showModal();
});

document.querySelector('#download-receipt').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(latestContribution, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${latestContribution.reference}-receipt.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

document.querySelector('#close-dialog').addEventListener('click', () => {
  dialog.close();
  form.reset();
  document.querySelector('#description-count').textContent = '0';
  fileName.textContent = 'PDF, DOCX, PPTX, XLSX, ZIP or image · max 10 MB';
  form.querySelectorAll('.error-message').forEach((item) => item.textContent = '');
  form.querySelectorAll('.invalid').forEach((item) => item.classList.remove('invalid'));
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
