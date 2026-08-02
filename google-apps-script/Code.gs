/**
 * Polytechnic Helpdesk upload receiver.
 * Deploy this Apps Script as a web app, then paste its URL into script.js.
 */
const SPREADSHEET_ID = '1mPPYrSRvRncwxKeoUb3FwF8N71LD2wPLVH9cU9ulVdw';
const SHEET_NAME = 'Website Submissions';
const UPLOAD_FOLDER_NAME = 'Polytechnic Helpdesk Uploads';
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const HEADERS = ['Receipt no.', 'Submitted at', 'Name', 'Email', 'Department', 'Semester', 'Resource title', 'Resource type', 'Subject', 'Description', 'Resource link', 'PDF filename', 'PDF in Drive', 'Submission status'];

function doGet(event) {
  const receiptNumber = event && event.parameter ? String(event.parameter.receipt || '').trim().toUpperCase() : '';
  const callback = event && event.parameter ? String(event.parameter.prefix || '') : '';
  const transport = event && event.parameter ? String(event.parameter.transport || '') : '';
  if (!receiptNumber) return ContentService.createTextOutput('Polytechnic Helpdesk upload service is running.');

  const response = findSubmission_(receiptNumber);
  if (transport === 'page') return statusPage_(response);
  if (transport === 'frame') return statusFrame_(response);
  return jsonp_(callback, response);
}

function findSubmission_(receiptNumber) {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values.shift() || [];
  const receiptIndex = headers.indexOf('Receipt no.');
  const statusIndex = headers.indexOf('Submission status');
  const titleIndex = headers.indexOf('Resource title');
  const match = values.find((row) => String(row[receiptIndex] || '').trim().toUpperCase() === receiptNumber);
  return match
    ? { found: true, receiptNumber: String(match[receiptIndex]), status: String(match[statusIndex] || 'Under Review'), resourceTitle: String(match[titleIndex] || '') }
    : { found: false };
}

function statusFrame_(response) {
  // Only the matching invisible iframe can read this message in the website.
  const safeResponse = JSON.stringify({ type: 'polytechnic-helpdesk-status', response: response })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  const html = `<!doctype html><html><body><script>window.parent.postMessage(${safeResponse}, '*');</script></body></html>`;
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function statusPage_(response) {
  const found = response.found;
  const status = found ? escapeHtml_(response.status || 'Under Review') : 'Submission not found';
  const title = found ? escapeHtml_(response.resourceTitle || 'Academic resource contribution') : 'Check the receipt number and try again.';
  const receipt = found ? escapeHtml_(response.receiptNumber) : '';
  const color = /^accepted$/i.test(status) ? '#16723d' : /rejected/i.test(status) ? '#a43232' : /partially accepted/i.test(status) ? '#1b628f' : '#8a6113';
  const html = `<!doctype html><html><head><base target="_top"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Submission status</title><style>body{margin:0;background:#eaf4f8;font-family:Arial,sans-serif;color:#18304a}.card{box-sizing:border-box;width:min(620px,calc(100% - 32px));margin:48px auto;padding:34px;border-radius:18px;background:#fff;box-shadow:0 18px 48px #1d526b1c}.eyebrow{margin:0 0 8px;color:#2874b9;font-size:12px;font-weight:700;letter-spacing:.12em}.status{display:inline-block;margin:20px 0 10px;padding:8px 12px;border-radius:999px;background:#f5f7f9;color:${color};font-weight:700}.title{margin:0;font-size:24px}.detail{margin:12px 0 0;color:#5d7183;line-height:1.5}.receipt{margin-top:22px;padding-top:18px;border-top:1px solid #dce5ec;color:#5d7183;font-size:14px}.back{display:inline-block;margin-top:26px;color:#176aac;font-weight:700;text-decoration:none}</style></head><body><main class="card"><p class="eyebrow">POLYTECHNIC HELPDESK</p><h1 class="title">${found ? 'Resource submission status' : 'No submission found'}</h1><p class="status">${status}</p><p class="detail">${title}</p>${receipt ? `<p class="receipt">Receipt No. ${receipt}</p>` : ''}<a class="back" href="https://iichelpdesk.github.io/">Return to Polytechnic Helpdesk</a></main></body></html>`;
  return HtmlService.createHtmlOutput(html).setTitle('Polytechnic Helpdesk - Submission Status');
}

function escapeHtml_(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function doPost(event) {
  try {
    const data = JSON.parse(event.postData.contents);
    validate_(data);
    const fileUrl = saveFile_(data.file);
    const sheet = getSheet_();
    sheet.appendRow([
      data.receiptNumber, new Date(), data.name, data.email, data.department, data.semester,
      data.title, data.resourceType, data.subject, data.description,
      data.resourceLink || '', data.file ? data.file.name : '', fileUrl, 'Under Review'
    ]);
    return json_({ ok: true });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
}

function validate_(data) {
  ['name', 'email', 'department', 'semester', 'title', 'resourceType', 'subject', 'description'].forEach((field) => {
    if (!data[field] || !String(data[field]).trim()) throw new Error(`Missing ${field}.`);
  });
  if (!data.receiptNumber || !String(data.receiptNumber).trim()) throw new Error('Missing receipt number.');
  if (!data.file && !data.resourceLink) throw new Error('A file or resource link is required.');
  if (data.file && data.file.mimeType !== 'application/pdf') throw new Error('Only PDF files are allowed.');
  if (data.file && !data.file.base64) throw new Error('The PDF data is missing.');
  if (data.file && Math.floor(String(data.file.base64).length * 0.75) > MAX_PDF_BYTES) throw new Error('The PDF is too large.');
}

function saveFile_(fileData) {
  if (!fileData) return '';
  const cleanName = String(fileData.name).replace(/[^a-zA-Z0-9._ -]/g, '_');
  const blob = Utilities.newBlob(Utilities.base64Decode(fileData.base64), fileData.mimeType, cleanName);
  const file = getUploadFolder_().createFile(blob);
  return file.getUrl();
}

function getUploadFolder_() {
  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty('UPLOAD_FOLDER_ID');
  if (savedId) return DriveApp.getFolderById(savedId);
  const folder = DriveApp.createFolder(UPLOAD_FOLDER_NAME);
  properties.setProperty('UPLOAD_FOLDER_ID', folder.getId());
  return folder;
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  } else if (sheet.getRange(1, 1).getValue() !== 'Receipt no.') {
    sheet.insertColumnBefore(1);
    sheet.getRange(1, 1).setValue('Receipt no.');
  }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (!headers.includes('Submission status')) {
    sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Submission status');
  }
  return sheet;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function jsonp_(callback, value) {
  if (!/^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(callback)) return json_(value);
  return ContentService.createTextOutput(`${callback}(${JSON.stringify(value)});`).setMimeType(ContentService.MimeType.JAVASCRIPT);
}
