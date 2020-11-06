const { createCanvas } = require('canvas');

const scrambleCase = (str) => [...str].map(
  (char, i) => char[`to${i % ~~(Math.random() * 5) ? 'Upper' : 'Lower'}Case`](),
).join('');

// Get a random string of alphanumeric characters
const randomText = () => scrambleCase(
  Math.random()
    .toString(36)
    .substring(2, 8),
);

const FONTBASE = 200;
const FONTSIZE = 35;

// Get a font size relative to base size and canvas width
const relativeFont = (width) => {
  const ratio = FONTSIZE / FONTBASE;
  const size = width * ratio;
  return `${size}px serif`;
};

// Get a float between min and max
const arbitraryRandom = (min, max) => Math.random() * (max - min) + min;

// Get a rotation between -degrees and degrees converted to radians
const randomRotation = (degrees = 15) => (arbitraryRandom(-degrees, degrees) * Math.PI) / 180;

// Configure captcha text
const configureText = (ctx, width, height) => {
  ctx.font = relativeFont(width);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const text = randomText();
  ctx.fillText(text, width / 2, height / 2);
  return text;
};

// Get a PNG dataURL of a captcha image
const generateCaptcha = (width, height) => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.rotate(randomRotation());
  const text = configureText(ctx, width, height);
  return {
    image: canvas.toDataURL(),
    text,
  };
};

module.exports = generateCaptcha;
