require('dotenv').config();

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const { google } = require('googleapis');
const { Readable } = require('stream');
const { log } = require('console');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
const GDRIVE_FOLDER_ID = process.env.GDRIVE_FOLDER_ID;
const SCOPES = ['https://www.googleapis.com/auth/drive'];

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});


const userSessions = new Map();

const questions = [
    { key: 'nama', question: 'Nama lengkap Anda:' },
    { key: 'provinsi', question: 'Provinsi Anda:' },
    { key: 'kabupaten', question: 'Kabupaten/Kota Anda:' },
    { key: 'username', question: 'Username Anda:' },
    { key: 'modul', question: `Modul (Masukan angka): \n 1. Verval KRS \n 2. Elsimil` },
    { key: 'uraian', question: `Uraian Permasalahan \n\n *) Jika permasalahan yang sama terjadi pada username lain, mohon input username-username lain yang terdampak pada isian Uraian Permasalahan dan Upload Screenshot Bukti Permasalahan untuk setiap username yang terdampak (bisa upload banyak file gambar)` },
    { key: 'screenshot', question: 'Screenshot Bukti Permasalahan' }
];

async function initializeGoogleSheets() {
    const serviceAccountAuth = new JWT({
        email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    
    let sheet = doc.sheetsByIndex[0];
    if (!sheet) {
        sheet = await doc.addSheet({ 
            title: 'Data Pengguna',
            headerValues: ['Nama', 'Nomor WhatsApp', 'Provinsi', 'Kabupaten/Kota', 'Username', 'Modul SIGA Mobile', 'Uraian Permasalahan', 'Screenshot Bukti Permasalahan', 'Timestamp']
        });
    }
    
    return sheet;
}

async function saveToGoogleSheets(userData) {
    try {
        const sheet = await initializeGoogleSheets();
        
        await sheet.addRow({
            'Nama': userData.nama || '',
            'Nomor WhatsApp': userData.whatsappNumber || '',
            'Provinsi': userData.provinsi || '',
            'Kabupaten/Kota': userData.kabupaten || '',
            'Username': userData.username || '',
            'Modul SIGA Mobile' : userData.modul || '', 
            'Uraian Permasalahan' : userData.uraian || '',
            'Screenshot Bukti Permasalahan' : userData.screenshot || '',
            'Timestamp': new Date().toLocaleString('id-ID')
        });
        
        log('Data berhasil disimpan ke Google Sheets');
        return true;
    } catch (error) {
        console.error('Error saving to Google Sheets:', error);
        return false;
    }
}

async function sendMedia(message, filePath, caption) {
    try {
        if (!fs.existsSync(filePath)) {
            log('File not found!');
            return false;
        }

        const media = MessageMedia.fromFilePath(filePath);
        await message.reply(media, undefined, { caption: caption })

        return true;

    } catch (error) {
        console.error('Error sending file:', error);
        return false;
    }
}

async function authorizeGoogleDrive() {
    
    const auth = new google.auth.JWT({
        email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: SCOPES
    }
    );

    try {
        await auth.authorize();
        return auth;
    } catch (error) {
        console.error('Authentication GDRIVE Failed:', error);
    }
}

async function uploadWhatsAppMediaToDrive(auth, whatsappMedia, folderId, customFileName = null) {
    const drive = google.drive({ version: 'v3', auth });

    const fileName = customFileName || `whatsapp_${Date.now()}.${getFileExtension(whatsappMedia.mimetype)}`;
    
    const fileMetadata = {
        name: fileName,
        parents: [folderId]
    };

    const bufferStream = new Readable();
    bufferStream.push(whatsappMedia.data);
    bufferStream.push(null);

    const media = {
        mimeType: whatsappMedia.mimetype,
        body: bufferStream
    };

    try {
        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id'
        });

        console.log('WhatsApp media uploaded successfully. File ID:', response.data);
        return response.data;
    } catch (error) {
        console.error(`Error uploading WhatsApp media to Google Drive: ${error.message}`);
    }
}

function getFileExtension(mimetype) {
    const extensions = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'audio/mpeg': 'mp3',
        'audio/ogg': 'ogg',
        'audio/wav': 'wav',
        'application/pdf': 'pdf',
        'text/plain': 'txt'
    };
    
    return extensions[mimetype] || 'bin';
}

client.on('qr', (qr) => {
    log('Scan QR code di bawah ini dengan WhatsApp Anda:');
    qrcode.generate(qr, { small: true });
});


client.on('ready', () => {
    log('WhatsApp Bot siap digunakan!');
});

client.on('message', async (message) => {
    const userId = message.from.replace("@c.us", "");
    const userMessage = message.body.toLowerCase().trim();
    
    if (message.from.includes('@g.us')) {
        return;
    }
    
    if (!userSessions.has(userId)) {
        if (userMessage === 'help') {
            userSessions.set(userId, {
                currentQuestionIndex: 0,
                data: {},
                whatsappNumber: userId
            });
            
            const firstQuestion = questions[0];
            await message.reply(`Halo, selamat datang di Helpdesk SIGA Mobile.\nSaya di sini untuk membantu Anda.\n\n${firstQuestion.question}`);
        } else {
            await message.reply('Terima Kasih telah menghubungi Helpdesk SIGA Mobile. Untuk memulai silahkan ketik "help"');
        }
        return;
    }
    
    const session = userSessions.get(userId);
    const currentQuestion = questions[session.currentQuestionIndex];
    
    if (message.hasMedia) {
        const authDrive = await authorizeGoogleDrive();
        const media = await message.downloadMedia();

        const fileUpload = await uploadWhatsAppMediaToDrive(authDrive, media, GDRIVE_FOLDER_ID);

        session.data[currentQuestion.key] = `https://drive.google.com/file/d/${fileUpload.id}/view`;

    }else{
        session.data[currentQuestion.key] = message.body;
    }
    
    session.currentQuestionIndex++;
    
    if (session.currentQuestionIndex < questions.length) {
        const nextQuestion = questions[session.currentQuestionIndex];
        await message.reply(nextQuestion.question);
    } else {
        session.data.whatsappNumber = userId;
        let modul = session.data.modul;
        if (modul == 1) {
            session.data.modul = "Verval KRS";
        }else if(modul == 2){
            session.data.modul = "Elsimil";
        }else{
            session.data.modul = modul;
        }

        await message.reply('Data Anda sedang disimpan...');
        
        const saved = await saveToGoogleSheets(session.data);
        
        if (saved) {
            await message.reply(`✅ Informasi Anda berhasil kami terima dan simpan. Ketik 'help' jika masih terdapat kendala SIGA Mobile`);
        } else {
            await message.reply('❌ Maaf, terjadi kesalahan saat menyimpan data. Silakan coba lagi nanti.');
        }
        
        userSessions.delete(userId);
    }
});

client.on('auth_failure', (msg) => {
    console.error('Authentication failed:', msg);
});

client.on('disconnected', (reason) => {
    log('Client disconnected:', reason);
});

client.initialize();

process.on('SIGINT', () => {
    log('Shutting down...');
    client.destroy();
    process.exit(0);
});