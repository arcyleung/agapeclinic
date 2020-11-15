/* eslint-disable no-console */
const fs = require('fs');
const cors = require('cors');
const crypto = require('crypto');
const moment = require('moment');
const multer = require('multer');
const express = require('express');
const NodeCache = require('node-cache');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');

const pjson = require('./package.json');
const generateCaptcha = require('./captcha');
const { buildReferralForm, createPdfBinary } = require('./referral-form');

require('dotenv').config();

require('./motd');

// ==============================================
// CONFIGS
// ==============================================
let mailingList;

try {
  mailingList = fs.readFileSync('mailing-list').toString().split('\n');
  if (!mailingList.length) { throw Error('mailing-list must contain at least 1 email!'); }
} catch (ex) {
  console.error('Failed to read mailing-list: please ensure a "mailing-list" file is present in the same directory as index.js');
  process.exit(1);
}

// Refactor into config; we likely won't see > 100 referrals a day
const maxReferrals = 100;
let currentRefIx = 0;
let lastGenDay = moment().format('D');

const upload = multer({ storage: multer.memoryStorage() });
const app = express();

const captchaCache = new NodeCache(
  {
    stdTTL: 300,
    maxKeys: 5,
    deleteOnExpire: true,
    checkperiod: 60,
  },
);

// debugging
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: 465,
  secure: true, // use SSL
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// ==============================================
// HELPER FUNCTIONS
// ==============================================

function generateRefID() {
  const now = moment();
  if (lastGenDay !== now.format('D') || currentRefIx > maxReferrals - 1) {
    lastGenDay = now.format('D');
    currentRefIx = 0;
  }
  const refID = `${now.format('YYYYMMDD')}-${currentRefIx.toString(10).padStart(2, '0')}`;
  currentRefIx += 1;
  return refID;
}

function sendEmail(binary, data, files, recipients) {
  // Email options
  const {
    patientFirst,
    patientMiddle,
    patientLast,
    doctorFirst,
    doctorMiddle,
    doctorLast,
    doctorEmail,
    sendCopyCheck,
  } = data;

  const mailOptions = {
    from: process.env.MAIL_USER,
    to: '',
    subject: `[Referral ${data.refID}] ${patientFirst}${` ${patientMiddle} `}${patientLast}`,
    text: `Referral for ${patientFirst}${` ${patientMiddle} `}${patientLast} from Dr. ${doctorFirst}${` ${doctorMiddle} `}${doctorLast}`,
    attachments: [{
      filename: `referral_${data.refID}_${patientFirst}_${patientLast}.pdf`,
      content: binary,
    }],
  };

  if (files) {
    mailOptions.attachments.concat(
      files.map((f) => ({
        name: f.originalname,
        content: f.buffer,
      })),
    );
  }

  // Send mail
  recipients.forEach((recipient) => {
    mailOptions.to = recipient;
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
      } else {
        console.log(`Email sent: ${info.response}`);
      }
    });
  });

  if (sendCopyCheck) {
    mailOptions.to = doctorEmail;
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
      } else {
        console.log(`Email sent: ${info.response}`);
      }
    });
  }
}

// ==============================================
// EXPRESS ROUTES
// ==============================================
app.use(cors());

// for parsing application/json
app.use(bodyParser.json());

// for parsing application/xwww-
app.use(bodyParser.urlencoded({ extended: true }));

// for parsing multipart/form-data
app.use(express.static('public'));

app.get('/referral/health', (req, res) => {
  let status = 200;
  let message = 'Service is running OK!';

  // config test
  if (!process.env.MAIL_HOST || !process.env.MAIL_USER || !process.env.MAIL_PASS) {
    status = 503;
    message = 'Mail credentials not set!';
  }

  if (!mailingList || !mailingList.length) {
    status = 503;
    message = 'Mailing list is not found or empty!';
  }

  const response = {
    status,
    message,
    mailingList,
    mailHost: process.env.MAIL_HOST,
    mailUser: process.env.MAIL_USER,
  };

  res.status(status).send(response);
  // TODO: SMTP self test
});

// TODO: job queue system
app.post('/referral', upload.array('images'), (req, res) => {
  const data = { ...req.body };

  const expected = captchaCache.take(data.captchaHash);
  // Verify captcha
  if (data.captchaResponse !== expected) {
    return res.status(200).redirect('../captcha_failed.html');
  }

  try {
    // PDF generation
    const refID = generateRefID();
    data.refID = refID;
    const { files } = req;

    // Set date
    data.date = moment().format('dddd, MMMM Do YYYY, h:mm:ss a');
    createPdfBinary(buildReferralForm(data, files),
      (binary) => {
        sendEmail(binary, data, files, mailingList);
      }, (error) => {
        console.log(error);
      });

    // TODO: use async/ await to send confirmation
    res.status(200).redirect(`../referral_received.html?refID=${refID}`);
  } catch (ex) {
    console.error(ex);
    res.status(500).redirect('../referral_failed.html');
  }
});

app.post('/referral/test', upload.array('images'), (req, res) => {
  const data = { ...req.body };

  const expected = captchaCache.take(data.captchaHash);
  // Verify captcha
  if (data.captchaResponse !== expected) {
    console.log(expected);
    console.log(data.captchaResponse)
    return res.send({
      ip: req.ip,
      captchaHash: data.captchaHash,
      captchaResponse: data.captchaResponse,
      correctResponse: expected
    });
  }

  try {
    // PDF generation
    const refID = 99;
    data.refID = refID;
    const { files } = req;

    if (!data || data.testKey !== process.env.TEST_KEY) {
      res.status(401).send('Unauthorized');
      return;
    }

    console.log('Received test request');
    console.log(data);
    console.log(files);

    // Set date
    data.date = moment().format('dddd, MMMM Do YYYY, h:mm:ss a');
    createPdfBinary(buildReferralForm(data, files),
      (binary) => {
        sendEmail(binary, data, files, [data.testEmail]);
      }, (error) => {
        res.status(500).redirect('../referral_failed.html');
        res.send(error);
      });

    // TODO: use async/ await to send confirmation
    res.status(200).redirect(`../referral_received.html?refID=${refID}`);
  } catch (ex) {
    console.error(ex);
    res.send(ex);
  }
});

app.get('/referral/captcha', (req, res) => {
  let retries = 3;
  do {
    try {
      const captchaData = generateCaptcha(500, 200);
      const { image, text } = captchaData;
      const hash = crypto.createHash('sha256').update(image).digest('hex');
      captchaCache.set(hash, text);
      console.log(hash, text);
      console.log(captchaCache.get(hash))
      return res.status(200).send(image);
    } catch (ex) {
      console.error(ex);
      captchaCache.flushAll();
    }
    retries -= 1;
  } while (retries > 0);
  return res.status(500).send('Error generating captcha, please try again later...');
});

const server = app.listen(8081, () => {
  const host = server.address().address;
  const { port } = server.address();

  console.log('AGAPE CLINIC BACKEND v%s', pjson.version);
  console.log('Started on %s', moment.utc());
  console.log('Listening at http://%s:%s', host, port);
});
