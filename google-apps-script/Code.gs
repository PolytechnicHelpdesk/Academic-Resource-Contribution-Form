/**
 * Polytechnic Helpdesk upload receiver.
 * Deploy this Apps Script as a web app, then paste its URL into script.js.
 */
const SPREADSHEET_ID = '1mPPYrSRvRncwxKeoUb3FwF8N71LD2wPLVH9cU9ulVdw';
const SHEET_NAME = 'Website Submissions';
const UPLOAD_FOLDER_NAME = 'Polytechnic Helpdesk Uploads';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const HEADERS = ['Receipt no.', 'Submitted at', 'Name', 'Email', 'Department', 'Semester', 'Resource title', 'Resource type', 'Subject', 'Description', 'Resource link', 'PDF filename', 'PDF in Drive', 'Submission status'];
const PUBLIC_STATUS_SHEET_NAME = 'Public Status';

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
    const payload = event && event.parameter && event.parameter.payload
      ? event.parameter.payload
      : event && event.postData ? event.postData.contents : '';
    const data = JSON.parse(payload);
    validate_(data);
    const fileUrl = saveFile_(data.file);
    const sheet = getSheet_();
    sheet.appendRow([
      data.receiptNumber, new Date(), data.name, data.email, data.department, data.semester,
      data.title, data.resourceType, data.subject, data.description,
      data.resourceLink || '', data.file ? data.file.name : '', fileUrl, 'Under Review'
    ]);
    upsertPublicStatus_(data.receiptNumber, 'Under Review', data.title, data.name);
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
  if (data.file && !ALLOWED_FILE_TYPES.includes(data.file.mimeType)) throw new Error('Only PDF, JPG, JPEG, and PNG files are allowed.');
  if (data.file && !data.file.base64) throw new Error('The file data is missing.');
  if (data.file && Math.floor(String(data.file.base64).length * 0.75) > MAX_FILE_BYTES) throw new Error('The file is too large.');
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

/**
 * Run this once from the Apps Script editor. It creates the public tracker
 * sheet and a trigger that keeps it updated when an admin changes a status.
 */
function initializeStatusTracker() {
  getSheet_();
  rebuildPublicStatusSheet_();

  const triggers = ScriptApp.getProjectTriggers();
  triggers
    .filter((trigger) => trigger.getHandlerFunction() === 'onSubmissionStatusEdit')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('onSubmissionStatusEdit')
    .forSpreadsheet(SPREADSHEET_ID)
    .onEdit()
    .create();
}

/**
 * Installable on-edit trigger. It runs when the admin changes a submission
 * status in the Website Submissions sheet.
 */
function onSubmissionStatusEdit(event) {
  if (!event || !event.range) return;
  const range = event.range;
  const sheet = range.getSheet();
  if (sheet.getName() !== SHEET_NAME || range.getRow() < 2) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const receiptColumn = headers.indexOf('Receipt no.') + 1;
  const statusColumn = headers.indexOf('Submission status') + 1;
  const titleColumn = headers.indexOf('Resource title') + 1;
  const nameColumn = headers.indexOf('Name') + 1;
  if (!receiptColumn || !statusColumn || !titleColumn || !nameColumn) return;

  for (let row = range.getRow(); row < range.getRow() + range.getNumRows(); row += 1) {
    const receipt = String(sheet.getRange(row, receiptColumn).getValue() || '').trim();
    const status = String(sheet.getRange(row, statusColumn).getValue() || 'Under Review').trim();
    const title = String(sheet.getRange(row, titleColumn).getValue() || '').trim();
    const name = String(sheet.getRange(row, nameColumn).getValue() || '').trim();
    if (receipt) upsertPublicStatus_(receipt, status || 'Under Review', title, name);
  }
}

function getPublicStatusSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(PUBLIC_STATUS_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(PUBLIC_STATUS_SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(['Receipt no.', 'Resource title', 'Full name', 'Submission status']);
  return sheet;
}

function rebuildPublicStatusSheet_() {
  const submissionSheet = getSheet_();
  const values = submissionSheet.getDataRange().getValues();
  const headers = values.shift() || [];
  const receiptIndex = headers.indexOf('Receipt no.');
  const statusIndex = headers.indexOf('Submission status');
  const titleIndex = headers.indexOf('Resource title');
  const nameIndex = headers.indexOf('Name');
  const rows = values
    .filter((row) => String(row[receiptIndex] || '').trim())
    .map((row) => [
      String(row[receiptIndex]).trim(),
      String(row[titleIndex] || '').trim(),
      String(row[nameIndex] || '').trim(),
      String(row[statusIndex] || 'Under Review').trim() || 'Under Review'
    ]);

  const publicSheet = getPublicStatusSheet_();
  publicSheet.clearContents();
  publicSheet.getRange(1, 1, 1, 4).setValues([['Receipt no.', 'Resource title', 'Full name', 'Submission status']]);
  if (rows.length) publicSheet.getRange(2, 1, rows.length, 4).setValues(rows);
  publicSheet.setFrozenRows(1);
}

function upsertPublicStatus_(receipt, status, resourceTitle, fullName) {
  const publicSheet = getPublicStatusSheet_();
  const normalizedReceipt = String(receipt).trim().toUpperCase();
  const normalizedStatus = String(status || 'Under Review').trim() || 'Under Review';
  const normalizedTitle = String(resourceTitle || '').trim();
  const normalizedName = String(fullName || '').trim();
  const receipts = publicSheet.getLastRow() > 1
    ? publicSheet.getRange(2, 1, publicSheet.getLastRow() - 1, 1).getValues().flat()
    : [];
  const index = receipts.findIndex((value) => String(value).trim().toUpperCase() === normalizedReceipt);
  if (index === -1) {
    publicSheet.appendRow([normalizedReceipt, normalizedTitle, normalizedName, normalizedStatus]);
  } else {
    publicSheet.getRange(index + 2, 1, 1, 4).setValues([[normalizedReceipt, normalizedTitle, normalizedName, normalizedStatus]]);
  }
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function jsonp_(callback, value) {
  if (!/^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(callback)) return json_(value);
  return ContentService.createTextOutput(`${callback}(${JSON.stringify(value)});`).setMimeType(ContentService.MimeType.JAVASCRIPT);
}
