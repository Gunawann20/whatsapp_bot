# WhatsApp Bot

A WhatsApp bot built with Node.js that integrates with Google Sheets and Google Drive.

## Features

- WhatsApp Web integration using whatsapp-web.js
- Google Sheets integration for data storage and retrieval
- QR code terminal display for easy authentication
- Environment variable configuration for secure credential management

## Prerequisites

Before running this bot, make sure you have:

- Node.js (version 14 or higher)
- A Google Cloud Project with Sheets API enabled
- Google Service Account credentials
- WhatsApp account for bot connection

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd whatsappbot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your configuration:
```env
# Google Sheets Configuration
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY=your_private_key

# Add GDrive
GDRIVE_FOLDER_ID=
```

## Dependencies

This project uses the following main dependencies:

- **whatsapp-web.js** (^1.30.0) - WhatsApp Web API wrapper
- **google-spreadsheet** (^4.1.4) - Google Sheets API integration
- **googleapis** (^150.0.1) - Google APIs client library
- **google-auth-library** (^9.15.1) - Google authentication
- **qrcode-terminal** (^0.12.0) - QR code display in terminal
- **dotenv** (^16.5.0) - Environment variable management

## Usage

1. Start the bot:
```bash
npm start
```

2. Scan the QR code that appears in your terminal with WhatsApp on your phone

3. The bot will connect and be ready to receive messages

## Google Sheets Setup

1. Create a Google Cloud Project
2. Enable the Google Sheets API
3. Create a Service Account and download the JSON credentials
4. Share your Google Sheet with the service account email
5. Add the sheet ID and credentials to your `.env` file

## Project Structure

```
whatsappbot/
├── src/
│   └── main.js          # Main application file
├── package.json         # Project configuration
├── .env                 # Environment variables (create this)
└── README.md           # This file
```

## Configuration

The bot uses environment variables for configuration. Make sure to set up your `.env` file with the required credentials and settings.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

If you encounter any issues or have questions, please create an issue in the repository.

## Security Notes

- Never commit your `.env` file or credentials to version control
- Keep your Google Service Account credentials secure
- Regularly rotate your API keys and credentials