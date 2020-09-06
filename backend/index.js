const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const multer = require('multer');
const nodemailer = require('nodemailer');
const Pdfmake = require('pdfmake');
const moment = require('moment');
require('dotenv').config();

let mailingList;
try {
  mailingList = fs.readFileSync('mailing-list').toString().split('\n');
  if (!mailingList.length) { throw Error('mailing-list must contain at least 1 email!'); }
} catch (ex) {
  console.error('Failed to read mailing list: please ensure a "mailing-list" file is present in the same directory as index.js');
  process.exit(1);
}

// Refactor into config; we likely won't see > 100 referrals a day
const maxReferrals = 100;
let currentRefIx = 0;
let lastGenDay = moment().format('D');

const upload = multer({ storage: multer.memoryStorage() });
const app = express();

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

function createPdfBinary(pdfDoc, callback, data) {
  const fontDescriptors = {
    Roboto: {
      normal: 'fonts/Roboto-Regular.ttf',
      bold: 'fonts/Roboto-Medium.ttf',
      italics: 'fonts/Roboto-Italic.ttf',
      bolditalics: 'fonts/Roboto-MediumItalic.ttf',
    },
  };

  const printer = new Pdfmake(fontDescriptors);

  const doc = printer.createPdfKitDocument(pdfDoc);

  const chunks = [];
  let binary;

  doc.on('data', (chunk) => {
    chunks.push(chunk);
  });
  doc.on('end', () => {
    binary = Buffer.concat(chunks);
    callback(binary, data);
  });
  doc.end();
}

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

function buildReferralForm(data, files) {
  const photos = files.map((f) => ({
    marginTop: 5,
    image: f.buffer,
    width: 500,
    alignment: 'center',
  }));

  return {
    content: [
      {
        alignment: 'justify',
        columns: [
          { text: 'Agape Clinic Referral Form', style: 'header' },
          {
            image: 'img/agape_logo.jpg',
            width: 150,
            alignment: 'justify',
          },
        ],
      },
      { text: `Referral ID: ${data.refID}` },
      { text: `Generated on: ${moment().format('dddd, MMMM Do YYYY, h:mm:ss a')}`, marginTop: 5 },
      { text: 'Patient Information', style: 'subheader' },
      {
        style: 'tableExample',
        fillColor: '#f9f9f9',
        table: {
          widths: [80, '*'],
          body: [

            ['Name', `${data.patientFirst} ${data.patientMiddle} ${data.patientLast}`],
            ['DOB\n(mm/dd/yyyy)', `${data.patientDOB}`],
            ['Gender', `${data.patientGender}`],
            ['OHIP Number', `${data.patientOHIP}`],
            ['Phone', `${data.patientPhone}`],
            ['Email', `${data.patientEmail}`],
            ['Address', `${data.patientAddr1}\n${data.patientAddr2}\n${data.patientCity} ${data.patientProvince} ${data.patientPostal}`],
          ],
        },
        layout: 'noBorders',
      },
      {
        style: 'tableExample',
        fillColor: '#f9f9f9',
        table: {
          widths: [80, '*'],
          body: [

            ['History', `${data.patientHistory}`],
          ],
        },
        layout: 'noBorders',
      },
      {
        style: 'tableExample',
        fillColor: '#f9f9f9',
        table: {
          widths: [80, '*'],
          body: [

            ['Provisional Diagnosis', `${data.patientDiagnosis}`],
          ],
        },
        layout: 'noBorders',
      },
      { text: 'Referring Doctor\'s Information', style: 'subheader' },
      {
        style: 'tableExample',
        fillColor: '#f9f9f9',
        table: {
          widths: [80, '*'],
          body: [

            ['Name', `${data.doctorFirst} ${data.doctorMiddle} ${data.doctorLast}`],
            ['Phone', `${data.doctorPhone}`],
            ['Email', `${data.doctorEmail}`],
            ['Fax', `${data.doctorFax}`],
            ['OHIP BN', `${data.doctorBN}`],
            ['Practice Address', `${data.doctorClinic}\n${data.doctorAddr1}\n${data.doctorAddr2}\n${data.doctorCity} ${data.doctorProvince} ${data.doctorPostal}`],
          ],
        },
        layout: 'noBorders',
      },
      { text: 'Attachments', style: 'subheader', pageBreak: 'before' },
      ...photos,
    ],
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        margin: [0, 0, 0, 10],
      },
      subheader: {
        fontSize: 16,
        bold: true,
        margin: [0, 10, 0, 5],
      },
      tableExample: {
        margin: [0, 5, 0, 15],
      },
    },
    defaultStyle: {
      // alignment: 'justify'
    },
  };
}

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
  try {
    // PDF generation
    const refID = generateRefID();
    const data = { ...req.body };
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
  try {
    // PDF generation
    const refID = 99;
    const data = { ...req.body };
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
        console.log(error);
      });

    // TODO: use async/ await to send confirmation
    res.status(200).redirect(`../referral_received.html?refID=${refID}`);
  } catch (ex) {
    console.error(ex);
    res.status(500).redirect('../referral_failed.html');
  }
});

const server = app.listen(8081, () => {
  const host = server.address().address;
  const { port } = server.address();

  console.log('Listening at http://%s:%s', host, port);
});
