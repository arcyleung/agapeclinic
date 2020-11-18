/* eslint-disable no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-shadow */
const pm2 = require('pm2');

pm2.connect(true, (err) => {
  if (err) {
    console.error(`error! ${err}`);
    process.exit(2);
  }

  pm2.list((err, list) => {
    console.log(err, list);
  });

  //   pm2.stop('agape-backend', (err, proc) => {
  //   });

  //   pm2.restart('agape-backend', (err, proc) => {
  //   });

  pm2.start({
    name: 'agape-backend',
    script: 'app.js', // Script to be run
    exec_mode: 'fork', // Allows your app to be clustered
    instances: 1, // Optional: Scales your app by 2
    watch: 'app.js',
    mergeLogs: true,
    max_memory_restart: '400M', // Optional: Restarts your app if it reaches 100Mo
    output: './logs/agape-backend.log',
    error: './logs/agape-backend.err',
    logDateFormat: 'YYYY-MM-DD HH:mm Z',
    env: {
      NODE_ENV: "production",
      PORT: 8081
    }
  }, (err, apps) => {
    pm2.disconnect(); // Disconnects from PM2
    if (err) throw err;
  });

  // pm2.start({
  //   name: 'agape-motd',
  //   script: 'motd.js', // Script to be run
  //   exec_mode: 'cluster', // Allows your app to be clustered
  //   instances: 1, // Optional: Scales your app by 2
  //   watch: 'motd.js',
  //   mergeLogs: true,
  //   max_memory_restart: '400M', // Optional: Restarts your app if it reaches 100Mo
  //   output: './logs/agape-motd.log',
  //   // error: './logs/agape-motd.err',
  //   logDateFormat: 'YYYY-MM-DD HH:mm Z',
  // }, (err, apps) => {
  //   pm2.disconnect(); // Disconnects from PM2
  //   if (err) throw err;
  // });
});
