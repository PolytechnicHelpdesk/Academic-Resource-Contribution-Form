/**
 * Polytechnic Helpdesk upload receiver.
 * Deploy this Apps Script as a web app, then paste its URL into script.js.
 */
const SPREADSHEET_ID = '1mPPYrSRvRncwxKeoUb3FwF8N71LD2wPLVH9cU9ulVdw';
const SHEET_NAME = 'Website Submissions';
const UPLOAD_FOLDER_NAME = 'Polytechnic Helpdesk Uploads';
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const HEADERS = ['Receipt no.', 'Submitted at', 'Name', 'Email', 'Department', 'Semester', 'Resource title', 'Resource type', 'Subject', 'Description', 'Resource link', 'PDF filename', 'PDF in Drive'];

function doGet() {
  return ContentService.createTextOutput('Polytechnic Helpdesk upload service is running.');
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
      data.resourceLink || '', data.file ? data.file.name : '', fileUrl
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
  return sheet;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
