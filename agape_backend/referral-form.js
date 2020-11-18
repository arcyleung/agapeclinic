const moment = require('moment');
const Pdfmake = require('pdfmake');

const ReferralForm = {
  buildReferralForm(data, files) {
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
              ['DOB\n(yyyy/mm/dd)', `${data.patientDOB}`],
              ['Gender', `${data.patientGender}`],
              ['Patient Status', `${data.patientStatus}`],
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
  },

  createPdfBinary(pdfDoc, callback, data) {
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
  },
};

module.exports = ReferralForm;
