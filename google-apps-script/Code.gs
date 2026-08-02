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
