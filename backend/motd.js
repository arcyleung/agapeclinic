/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const cron = require('node-cron');
const Handlebars = require('handlebars');
const { execSync } = require('child_process');

require('dotenv').config();

let motdAuthorizedEmailsList;

try {
  motdAuthorizedEmailsList = fs.readFileSync('motd-authorized-emails').toString().split('\n');
  if (!motdAuthorizedEmailsList.length) { throw Error('motd-authorized-emails must contain at least 1 email!'); }
} catch (ex) {
  console.error('Failed to read motd-authorized-emails: please ensure a "motd-authorized-emails" file is present in the same directory as index.js');
  process.exit(1);
}

function renderTemplate(data, templateFile, outputFile) {
  const source = fs.readFileSync(templateFile, 'utf8').toString();
  const template = Handlebars.compile(source);
  const output = template(data);
  fs.writeFileSync(path.join(process.env.FRONTEND_ASSETS_PATH, outputFile), output);
}

// Set up the cron job to read the latest MOTD from the SMTP host
let lastTimestamp;
const curlCommand = `curl -s --url 'imap://${process.env.MOTD_HOST}/INBOX;UID=*;SECTION=HEADER.FIELDS%20(DATE)' 'imap://${process.env.MOTD_HOST}/INBOX;UID=*;SECTION=HEADER.FIELDS%20(X-SENDER)' 'imap://${process.env.MOTD_HOST}/INBOX;UID=*;SECTION=TEXT' -u ${process.env.MOTD_USER}:${process.env.MOTD_PASS}`;

cron.schedule('* * * * *', () => {
  const output = execSync(curlCommand);
  const [timestamp, sender, message] = output.toString().split(/[\r\n]+/);
  if (timestamp === lastTimestamp) {
    return;
  }

  lastTimestamp = timestamp;

  const senderEmail = sender.split(' ')[1];
  if (!motdAuthorizedEmailsList.includes(senderEmail)) {
    return;
  }

  // Generarte the new MOTD html
  console.log(sender);
  console.log(message);

  renderTemplate({ message }, 'templates/motd.hbs', 'motd.html');
  console.log(`Generated new MOTD at ${moment.utc()}`);
});
