require('dotenv').config();

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const { log } = require('console');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;

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
    { key: 'uraian', question: `Uraian Permasalahan \n\n *) Jika permasalahan yang sama terjadi pada username lain, mohon input username-username lain yang terdampak pada isian Uraian Permasalahan dan Upload Screenshot Bukti Permasalahan untuk setiap username yang terdampak (bisa upload banyak file gambar)` }
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
            headerValues: ['Nama', 'Nomor WhatsApp', 'Provinsi', 'Kabupaten/Kota', 'Username', 'Modul SIGA Mobile', 'Uraian Permasalahan','Timestamp']
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
    
    session.data[currentQuestion.key] = message.body;
    
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
            await message.reply('✅ Data Anda berhasil disimpan! Terima kasih atas partisipasinya.\n\nKetik "halo" lagi jika ingin mengisi data baru.');
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