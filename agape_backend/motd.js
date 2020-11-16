/* eslint-disable prefer-destructuring */
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const cron = require('node-cron');
const imaps = require('imap-simple');
const Handlebars = require('handlebars');
const sanitizeHTML = require('sanitize-html');

require('dotenv').config();

let motdAuthorizedEmailsList;
let smtpConnection;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

try {
  motdAuthorizedEmailsList = fs.readFileSync('motd-authorized-emails').toString().split(/\r?\n/);
  if (!motdAuthorizedEmailsList.length) { throw Error('motd-authorized-emails must contain at least 1 email!'); }
} catch (ex) {
  console.error('Failed to read motd-authorized-emails: please ensure a "motd-authorized-emails" file is present in the same directory as index.js');
  process.exit(1);
}

const config = {
  imap: {
    user: process.env.MOTD_USER,
    password: process.env.MOTD_PASS,
    host: process.env.MOTD_HOST,
    port: 993,
    tls: true,
    rejectUnauthorized: false,
    authTimeout: 10000,
  },
};

// Insert line breaks when applying message to template
Handlebars.registerHelper('breaklines', (text) => {
  // let str = Handlebars.Utils.escapeExpression(text);
  // str = text.replace(/(\r\n|\n|\r)/gm, '<br>');
  return new Handlebars.SafeString(text);
});

function renderTemplate(data, templateFile, outputFile) {
  const source = fs.readFileSync(templateFile, 'utf8').toString();
  const template = Handlebars.compile(source);
  const output = template(data);
  fs.writeFileSync(path.join(process.env.PUBLIC_HTML_PATH, outputFile), output);
}

let lastTimestamp;
async function getLastMOTD() {
  try {
    if (!smtpConnection || smtpConnection.state !== 'authenticated') {
      if (smtpConnection) {
        smtpConnection.end();
      }
      smtpConnection = await imaps.connect(config);
      smtpConnection.imap.on('close', () => {
        smtpConnection = null;
        console.error('IMAP connection closed!');
      });
      smtpConnection.imap.on('error', (err) => {
        smtpConnection = null;
        console.error('IMAP connection errored!', err);
      });
      await smtpConnection.openBox('INBOX');
    }

    const searchCriteria = ['*:*'];
    const fetchOptions = {
      bodies: ['HEADER', 'TEXT'],
    };

    const result = await smtpConnection.search(searchCriteria, fetchOptions);

    let sender;
    let timestamp;
    let message;
    result[0].parts.forEach((entry) => {
      switch (entry.which) {
        case 'TEXT':
          message = entry.body;
          break;
        case 'HEADER':
          sender = entry.body.from[0];
          timestamp = entry.body.date[0];
          break;
        default:
      }
    });

    // Process html
    if (message.includes('Content-Type: text/html')) {
      message = message.slice(message.indexOf('Content-Type: text/html'));
      const start = message.indexOf('<');
      const end = message.lastIndexOf('>');
      const clean = sanitizeHTML(message.slice(start, end));
      message = clean;
    }

    return { sender, timestamp, message };
  } catch (ex) {
    console.error(ex);
  }
}

async function generateFromTemplate() {
  const result = await getLastMOTD();
  if (!result) {
    console.error('Failed to get last MOTD');
    return;
  }

  const { sender, timestamp, message } = result;
  if (timestamp === lastTimestamp) {
    return;
  }

  lastTimestamp = timestamp;

  if (!motdAuthorizedEmailsList.includes(sender)) {
    return;
  }

  // Generarte the new MOTD html
  renderTemplate({ message, timestamp: moment(timestamp).format('YYYY/MM/DD') }, 'templates/index.hbs', 'index.html');
  console.log(`Generated new MOTD at ${moment.utc()}`);
}

// Set up the cron job to read the latest MOTD from the SMTP host
cron.schedule('* * * * *', async () => {
  await generateFromTemplate();
});

generateFromTemplate();
