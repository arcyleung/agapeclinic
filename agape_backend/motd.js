/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const cron = require('node-cron');
const imaps = require('imap-simple');
const Handlebars = require('handlebars');

require('dotenv').config();

let motdAuthorizedEmailsList;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

try {
  motdAuthorizedEmailsList = fs.readFileSync('motd-authorized-emails').toString().split('\n');
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

function renderTemplate(data, templateFile, outputFile) {
  const source = fs.readFileSync(templateFile, 'utf8').toString();
  const template = Handlebars.compile(source);
  const output = template(data);
  fs.writeFileSync(path.join(process.env.FRONTEND_ASSETS_PATH, outputFile), output);
}

let lastTimestamp;
async function getLastMOTD() {
  try {
    const conn = await imaps.connect(config);
    await conn.openBox('INBOX');
    const searchCriteria = ['*:*'];
    const fetchOptions = {
      bodies: ['HEADER', 'TEXT'],
    };

    const result = await conn.search(searchCriteria, fetchOptions);

    let sender;
    let timestamp;
    let motd;
    result[0].parts.forEach((entry) => {
      switch (entry.which) {
        case 'TEXT':
          motd = entry.body;
          break;
        case 'HEADER':
          sender = entry.body.from[0];
          timestamp = entry.body.date[0];
          break;
        default:
      }
    });

    return { sender, timestamp, motd };
  } catch (ex) {
    console.error(ex);
  }
}

// Set up the cron job to read the latest MOTD from the SMTP host
cron.schedule('* * * * *', async () => {
  const { sender, timestamp, motd } = await getLastMOTD();
  if (timestamp === lastTimestamp) {
    return;
  }

  lastTimestamp = timestamp;

  if (!motdAuthorizedEmailsList.includes(sender)) {
    return;
  }

  // Generarte the new MOTD html
  console.log(sender);
  console.log(motd);

  renderTemplate({ message: motd }, 'templates/motd.hbs', 'motd.html');
  console.log(`Generated new MOTD at ${moment.utc()}`);
});
