# Agape Clinic Referral Service
Frontend and Backend services for Agape Clinic

## Frontend
Simple HTML/CSS/JS interface, using Bootstrap 4 and JQuery

## Backend
Requires Node v12.16.2 (LTS)

### Configuration
Please ensure the following environment variables are set in a .env file placed in the same directory as `index.js`
```
// Referrals
MAIL_HOST={your SMTP host}
MAIL_USER={mailer user account}
MAIL_PASS={mailer user password}

// MOTD
MOTD_HOST={your SMTP host}
MOTD_USER={motd receiver user account}
MOTD_PASS={motd receiver user password}
PUBLIC_HTML_PATH={path of index.html for template to be generated}
```

Ensure the `mailing-list` file is present in the same directory as `index.js`, containing the emails that each referral form will be mailed to (demarcated by newlines)
```
doctor1@testclinic.com
doctor2@testclinic.com
```

### Configuration
To start the server: `node index.js`

When the service is running send a GET request to `{yourdomain}.com/referral/health` to perform a self test and ensure the configuration is correct.
