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
  if (transport === 'embed') return statusEmbed_(response);
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

function statusEmbed_(response) {
  const found = response.found;
  const rawStatus = found ? String(response.status || 'Under Review') : 'Submission Not Found';
  const status = escapeHtml_(rawStatus.replace(/\b\w/g, function(letter) { return letter.toUpperCase(); }));
  const title = found ? escapeHtml_(response.resourceTitle || 'Academic resource contribution') : 'Check the receipt number and try again.';
  const receipt = found ? escapeHtml_(response.receiptNumber) : '';
  const normalized = rawStatus.toLowerCase();
  const color = normalized === 'accepted' ? '#16723d' : normalized.indexOf('rejected') !== -1 ? '#a43232' : normalized.indexOf('partially accepted') !== -1 ? '#1b628f' : '#8a6113';
  const html = `<!doctype html><html><head><base target="_top"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;background:transparent;font-family:Arial,sans-serif;color:#18304a}.result{box-sizing:border-box;min-height:148px;padding:18px;border:1px solid #dce5ec;border-radius:10px;background:#f8fbfd}.label{margin:0;color:#6c7e8c;font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase}.status{display:inline-block;margin:9px 0 6px;padding:6px 9px;border-radius:999px;background:#fff;color:${color};font-size:15px;font-weight:700}.detail{margin:0;color:#5d7183;font-size:13px;line-height:1.45}.receipt{margin:12px 0 0;color:#7e8d99;font-size:12px}</style></head><body><main class="result"><p class="label">Current decision</p><p class="status">${status}</p><p class="detail">${title}</p>${receipt ? `<p class="receipt">Receipt No. ${receipt}</p>` : ''}</main></body></html>`;
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
