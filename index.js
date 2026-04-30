require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();

app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
  }));


app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── CONFIGURATIE ──────────────────────────────────────────────
const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'internationalweek',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'PingFin2026!',
};

async function getPool() {
    return await mysql.createConnection(config);
}
const getConn = getPool;

async function ensureSchema() {
    const conn = await getPool();

    try {
        await ensureColumn(conn, 'ACK_IN', 'bb_code', "VARCHAR(10) DEFAULT NULL");
        await ensureColumn(conn, 'ACK_IN', 'bb_datetime', "DATETIME DEFAULT NULL");
        await ensureColumn(conn, 'ACK_OUT', 'bb_code', "VARCHAR(10) DEFAULT NULL");
        await ensureColumn(conn, 'ACK_OUT', 'bb_datetime', "DATETIME DEFAULT NULL");
        await ensureColumn(conn, 'LOG', 'bb_code', "VARCHAR(10) DEFAULT NULL");
    } finally {
        await conn.end();
    }
}

async function ensureColumn(conn, tableName, columnName, definition) {
    const [rows] = await conn.execute(
        `
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ?
              AND TABLE_NAME = ?
              AND COLUMN_NAME = ?
        `,
        [config.database, tableName, columnName]
    );

    if (rows.length === 0) {
        await conn.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
}

const issuedTokens = new Map();
const TOKEN_TTL_MS = 4 * 60 * 60 * 1000;
const CB_SHARED_SECRET =
    process.env.CB_SHARED_SECRET ||
    process.env.LOCAL_SECRET_KEY ||
    process.env.SECRET_KEY ||
    '49683708e11f2a70';

function registerGet(paths, ...handlers) {
    for (const routePath of paths) {
        app.get(routePath, ...handlers);
    }
}

function registerPost(paths, ...handlers) {
    for (const routePath of paths) {
        app.post(routePath, ...handlers);
    }
}

function pruneExpiredTokens() {
    const now = Date.now();

    for (const [token, entry] of issuedTokens.entries()) {
        if (entry.expiresAt <= now) {
            issuedTokens.delete(token);
        }
    }
}

function createAccessToken(bic, scope = 'bank') {
    pruneExpiredTokens();

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + TOKEN_TTL_MS;

    issuedTokens.set(token, { bic, scope, expiresAt });

    return {
        token,
        expiresAt
    };
}

function requireCbAuth(req, res, next) {
    pruneExpiredTokens();

    const authorizationHeader = req.get('Authorization');

    if (!authorizationHeader) {
        return res.status(401).json({ ok: false, status: 401, message: 'Missing Authorization header' });
    }

    const [scheme, token] = authorizationHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ ok: false, status: 401, message: 'Invalid bearer token' });
    }

    const tokenEntry = issuedTokens.get(token);

    if (!tokenEntry || tokenEntry.expiresAt <= Date.now()) {
        issuedTokens.delete(token);
        return res.status(401).json({ ok: false, status: 401, message: 'Invalid bearer token' });
    }

    req.cbAuth = { bic: tokenEntry.bic, scope: tokenEntry.scope || 'bank' };
    next();
}

function isGuiAuth(req) {
    return req.cbAuth?.scope === 'gui';
}
// ── HELPER FUNCTIES ───────────────────────────────────────────

function randomIBAN() {
    const nums = () => Math.floor(Math.random() * 9000000000 + 1000000000);
    return `BE${Math.floor(Math.random() * 90 + 10)}${nums()}${Math.floor(Math.random() * 900 + 100)}`;
}

function randomBIC() {
    const bics = ['AXABBE22', 'CVMCBEBB'];
    return bics[Math.floor(Math.random() * bics.length)];
}

function randomAmount() {
    return parseFloat((Math.random() * 499 + 1).toFixed(2));
}

function randomMessage() {
    const msgs = [
        'Huur april 2026', 'Factuur 2026-04', 'Terugbetaling lening',
        'Aankoop goederen', 'Diensten maart 2026', 'Betaling project PingFin',
        'Maandelijkse bijdrage', 'Terugbetaling kosten'
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
}

function nowSQL() {
    const d = new Date();
    return d.getFullYear() + '-'
        + String(d.getMonth() + 1).padStart(2, '0') + '-'
        + String(d.getDate()).padStart(2, '0') + ' '
        + String(d.getHours()).padStart(2, '0') + ':'
        + String(d.getMinutes()).padStart(2, '0') + ':'
        + String(d.getSeconds()).padStart(2, '0');
}

// ════════════════════════════════════════════════════════════
// TEST ENDPOINTS
// ════════════════════════════════════════════════════════════

app.get('/test-banks', async (req, res) => {
    try {
        const conn = await getPool();
        const [rows] = await conn.execute("SELECT * FROM BANKS");
        await conn.end();
        res.json({ status: "Succes!", bericht: "Verbonden via MySQL!", data: rows });
    } catch (err) {
        res.status(500).json({ status: "Error", details: err.message });
    }
});

app.get('/test-insert', async (req, res) => {
    try {
        const conn = await getPool();
        const po_id = 'AXABBE22_' + Date.now().toString(36).toUpperCase();
        const po_amount = randomAmount();
        const po_message = randomMessage();
        const po_dt = nowSQL();
        const ob_id = randomBIC();
        const oa_id = randomIBAN();
        const ob_code = '2000';
        const ob_dt = nowSQL();
        const bb_id = randomBIC();
        const ba_id = randomIBAN();

        await conn.execute(
            `INSERT INTO PO_IN (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ob_code, ob_datetime, bb_id, ba_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [po_id, po_amount, po_message, po_dt, ob_id, oa_id, ob_code, ob_dt, bb_id, ba_id]
        );
        await conn.end();
        res.json({ status: "Gelukt!", ingevoegd: { po_id, po_amount, po_message, ob_id, oa_id, bb_id, ba_id } });
    } catch (err) {
        res.status(500).json({ status: "Insert Fout", message: err.message });
    }
});

app.get('/test-insert-bulk', async (req, res) => {
    try {
        const conn = await getPool();
        const inserted = [];

        for (let i = 0; i < 10; i++) {
            const po_id = 'AXABBE22_' + Date.now().toString(36).toUpperCase() + '_' + i;
            const po_amount = randomAmount();
            const po_message = randomMessage();
            const po_dt = nowSQL();
            const ob_id = randomBIC();
            const oa_id = randomIBAN();
            const ob_code = '2000';
            const ob_dt = nowSQL();
            const bb_id = randomBIC();
            const ba_id = randomIBAN();

            const cb_code = '2000';
        const cb_dt = nowSQL();

            await conn.execute(
                `INSERT INTO PO_IN (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ob_code, ob_datetime, cb_code, cb_datetime, bb_id, ba_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [po_id, po_amount, po_message, po_dt, ob_id, oa_id, ob_code, ob_dt, cb_code, cb_dt, bb_id, ba_id]
            );
            inserted.push({ po_id, po_amount, po_message, ob_id, oa_id, bb_id, ba_id });
        }

        await conn.end();
        res.json({ status: "Gelukt!", aantal: inserted.length, data: inserted });
    } catch (err) {
        res.status(500).json({ status: "Bulk Insert Fout", message: err.message });
    }
});

app.get('/test-po-in', async (req, res) => {
    try {
        const conn = await getPool();
        const [rows] = await conn.execute("SELECT * FROM PO_IN ORDER BY po_datetime DESC");
        await conn.end();
        res.json({ status: "Succes!", aantal: rows.length, data: rows });
    } catch (err) {
        res.status(500).json({ status: "Error", details: err.message });
    }
});

// ════════════════════════════════════════════════════════════
// ECHTE CB API ENDPOINTS
// ════════════════════════════════════════════════════════════

// ── POST /token and /api/token ───────────────────────────────
registerPost(['/token', '/api/token'], async (req, res) => {
    try {
        const { bic, secret_key } = req.body || {};

        if (!bic || !secret_key) {
            return res.status(400).json({ ok: false, status: 400, message: 'bic en secret_key zijn verplicht' });
        }

        if (secret_key !== CB_SHARED_SECRET) {
            return res.status(401).json({ ok: false, status: 401, message: 'Invalid secret key' });
        }

        const { token, expiresAt } = createAccessToken(bic);

        res.json({
            ok: true,
            status: 200,
            token,
            data: {
                token,
                bic,
                expires_at: new Date(expiresAt).toISOString()
            }
        });
    } catch (err) {
        res.status(500).json({ ok: false, status: 500, message: err.message });
    }
});

// ── GET /api/banks ────────────────────────────────────────────
registerGet(['/banks', '/api/banks'], requireCbAuth, async (req, res) => {
    try {
        const conn = await getPool();
        const [rows] = await conn.execute("SELECT id, name, description FROM BANKS");
        await conn.end();
        res.json({ ok: true, status: 200, data: rows });
    } catch (err) {
        res.status(500).json({ ok: false, status: 500, message: err.message });
    }
});

// ── POST /api/banks ───────────────────────────────────────────
registerPost(['/banks', '/api/banks'], requireCbAuth, async (req, res) => {
    try {
        const { id, name, description } = req.body;

        if (!id || !name) {
            return res.status(400).json({ ok: false, status: 400, message: 'id en name zijn verplicht' });
        }

        if (id.includes(' ')) {
            return res.status(400).json({ ok: false, status: 400, message: 'BIC mag geen spaties bevatten' });
        }

        const conn = await getPool();
        const [check] = await conn.execute("SELECT id FROM BANKS WHERE id = ?", [id]);

        if (check.length > 0) {
            await conn.execute(
                "UPDATE BANKS SET name = ?, description = ? WHERE id = ?",
                [name, description || null, id]
            );
        } else {
            await conn.execute(
                "INSERT INTO BANKS (id, name, description) VALUES (?, ?, ?)",
                [id, name, description || null]
            );
        }

        await conn.end();
        res.json({ ok: true, status: 200, message: 'Bank succesvol opgeslagen' });

    } catch (err) {
        res.status(500).json({ ok: false, status: 500, message: err.message });
    }
});

// ── POST /api/po_in ───────────────────────────────────────────
registerPost(['/po_in', '/api/po_in'], requireCbAuth, async (req, res) => {
    try {
        const { data } = req.body;

        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ ok: false, status: 400, message: 'data array is verplicht' });
        }

        const conn = await getPool();
        let verwerkt = 0;
        let fouten = [];

        for (const po of data) {
            try {
                // Validatie 1: bedrag max 500
                if (po.po_amount > 500) {
                    fouten.push({ po_id: po.po_id, fout: '4002 - Bedrag overschrijdt €500 limiet' });
                    continue;
                }

                // Validatie 2: bedrag niet negatief
                if (po.po_amount <= 0) {
                    fouten.push({ po_id: po.po_id, fout: '4003 - Bedrag kan niet negatief zijn' });
                    continue;
                }

                // Validatie 3: bb_id moet bestaan in BANKS
                const [bankCheck] = await conn.execute("SELECT id FROM BANKS WHERE id = ?", [po.bb_id]);
                if (bankCheck.length === 0) {
                    fouten.push({ po_id: po.po_id, fout: '4004 - bb_id bestaat niet in CB systeem' });
                    continue;
                }

                // Validatie 4: duplicate po_id
                const [dupCheck] = await conn.execute("SELECT po_id FROM PO_IN WHERE po_id = ?", [po.po_id]);
                if (dupCheck.length > 0) {
                    fouten.push({ po_id: po.po_id, fout: '4005 - PO met dit ID bestaat al' });
                    continue;
                }

                const cb_code = '2000';
                const cb_datetime = nowSQL();

                // Opslaan in PO_IN
                await conn.execute(
                    `INSERT INTO PO_IN (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ob_code, ob_datetime, cb_code, cb_datetime, bb_id, ba_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [po.po_id, po.po_amount, po.po_message, po.po_datetime, po.ob_id, po.oa_id, po.ob_code, po.ob_datetime, cb_code, cb_datetime, po.bb_id, po.ba_id]
                );

                // Doorsturen naar PO_OUT
                await conn.execute(
                    `INSERT INTO PO_OUT (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ob_code, ob_datetime, cb_code, cb_datetime, bb_id, ba_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [po.po_id, po.po_amount, po.po_message, po.po_datetime, po.ob_id, po.oa_id, po.ob_code, po.ob_datetime, cb_code, cb_datetime, po.bb_id, po.ba_id]
                );

                // Loggen
                await conn.execute(
                    `INSERT INTO LOG (message, type, po_id, po_amount, po_message, ob_id, bb_id, cb_code)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [`PO ontvangen van ${po.ob_id}`, 'po_in', po.po_id, po.po_amount, po.po_message, po.ob_id, po.bb_id, cb_code]
                );

                verwerkt++;

            } catch (poErr) {
                fouten.push({ po_id: po.po_id, fout: poErr.message });
            }
        }

        await conn.end();
        res.json({
            ok: true,
            status: 200,
            data: `Result: ${verwerkt} Payment Orders Processed.`,
            fouten: fouten.length > 0 ? fouten : undefined
        });

    } catch (err) {
        res.status(500).json({ ok: false, status: 500, message: err.message });
    }
});

// ── GET /api/po_out ───────────────────────────────────────────
registerGet(['/po_out', '/api/po_out'], requireCbAuth, async (req, res) => {
    try {
        const conn = await getPool();
        const [rows] = isGuiAuth(req)
            ? await conn.execute("SELECT * FROM PO_OUT")
            : await conn.execute("SELECT * FROM PO_OUT WHERE bb_id = ?", [req.cbAuth.bic]);

        if (rows.length > 0) {
            const ids = rows.map(r => r.po_id);
            await conn.execute(`DELETE FROM PO_OUT WHERE po_id IN (${ids.map(() => '?').join(',')})`, ids);
        }

        await conn.end();
        res.json({ ok: true, status: 200, data: rows });
    } catch (err) {
        res.status(500).json({ ok: false, status: 500, message: err.message });
    }
});

// ── GET /api/po_out/test/true ─────────────────────────────────
registerGet(['/po_out/test/true', '/api/po_out/test/true'], requireCbAuth, async (req, res) => {
    try {
        const conn = await getPool();
        const [rows] = isGuiAuth(req)
            ? await conn.execute("SELECT * FROM PO_OUT")
            : await conn.execute("SELECT * FROM PO_OUT WHERE bb_id = ?", [req.cbAuth.bic]);
        await conn.end();
        res.json({ ok: true, status: 200, data: rows });
    } catch (err) {
        res.status(500).json({ ok: false, status: 500, message: err.message });
    }
});

// ── POST /api/ack_in ──────────────────────────────────────────
registerPost(['/ack_in', '/api/ack_in'], requireCbAuth, async (req, res) => {
    try {
        const { data } = req.body;

        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ ok: false, status: 400, message: 'data array is verplicht' });
        }

        const conn = await getPool();
        let verwerkt = 0;
        let fouten = [];

        for (const ack of data) {
            try {
                // Opslaan in ACK_IN
                await conn.execute(
                    `INSERT INTO ACK_IN (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ob_code, ob_datetime, cb_code, cb_datetime, bb_id, ba_id, bb_code, bb_datetime)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [ack.po_id, ack.po_amount, ack.po_message, ack.po_datetime, ack.ob_id, ack.oa_id, ack.ob_code, ack.ob_datetime, ack.cb_code, ack.cb_datetime, ack.bb_id, ack.ba_id, ack.bb_code, ack.bb_datetime]
                );

                // Doorsturen naar ACK_OUT
                await conn.execute(
                    `INSERT INTO ACK_OUT (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ob_code, ob_datetime, cb_code, cb_datetime, bb_id, ba_id, bb_code, bb_datetime)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [ack.po_id, ack.po_amount, ack.po_message, ack.po_datetime, ack.ob_id, ack.oa_id, ack.ob_code, ack.ob_datetime, ack.cb_code, ack.cb_datetime, ack.bb_id, ack.ba_id, ack.bb_code, ack.bb_datetime]
                );

                // Loggen
                await conn.execute(
                    `INSERT INTO LOG (message, type, po_id, bb_code) VALUES (?, ?, ?, ?)`,
                    [`ACK ontvangen van ${ack.bb_id}`, 'ack_in', ack.po_id, ack.bb_code]
                );

                verwerkt++;

            } catch (ackErr) {
                fouten.push({ po_id: ack.po_id, fout: ackErr.message });
            }
        }

        await conn.end();
        res.json({
            ok: true,
            status: 200,
            data: `Result: ${verwerkt} Acknowledgements Processed.`,
            fouten: fouten.length > 0 ? fouten : undefined
        });

    } catch (err) {
        res.status(500).json({ ok: false, status: 500, message: err.message });
    }
});

// ── GET /api/ack_out ──────────────────────────────────────────
registerGet(['/ack_out', '/api/ack_out'], requireCbAuth, async (req, res) => {
    try {
        const conn = await getPool();
        const [rows] = isGuiAuth(req)
            ? await conn.execute("SELECT * FROM ACK_OUT")
            : await conn.execute("SELECT * FROM ACK_OUT WHERE ob_id = ?", [req.cbAuth.bic]);

        if (rows.length > 0) {
            const ids = rows.map(r => r.po_id);
            await conn.execute(`DELETE FROM ACK_OUT WHERE po_id IN (${ids.map(() => '?').join(',')})`, ids);
        }

        await conn.end();
        res.json({ ok: true, status: 200, data: rows });
    } catch (err) {
        res.status(500).json({ ok: false, status: 500, message: err.message });
    }
});

// ── GET /api/ack_out/test/true ────────────────────────────────
registerGet(['/ack_out/test/true', '/api/ack_out/test/true'], requireCbAuth, async (req, res) => {
    try {
        const conn = await getPool();
        const [rows] = isGuiAuth(req)
            ? await conn.execute("SELECT * FROM ACK_OUT")
            : await conn.execute("SELECT * FROM ACK_OUT WHERE ob_id = ?", [req.cbAuth.bic]);
        await conn.end();
        res.json({ ok: true, status: 200, data: rows });
    } catch (err) {
        res.status(500).json({ ok: false, status: 500, message: err.message });
    }
});

// ── GET /api/info ─────────────────────────────────────────────
registerGet(['/info', '/api/info'], async (req, res) => {
    res.json({
        ok: true,
        status: 200,
        code: 2000,
        message: 'OK',
        data: {
            team: process.env.TEAM_NAME,
            bic: process.env.TEAM_BIC,
            members: (process.env.TEAM_MEMBERS || '').split(',')
        }
    });
});

// ── GET /api/help ─────────────────────────────────────────────
registerGet(['/help', '/api/help'], async (req, res) => {
    res.json({
        ok: true,
        status: 200,
        data: [
            { method: 'GET',  url: '/api/help',              beschrijving: 'Dit overzicht' },
            { method: 'GET',  url: '/api/info',              beschrijving: 'Info over onze CB' },
            { method: 'POST', url: '/api/token',             beschrijving: 'Bearer token ophalen met bic + secret_key' },
            { method: 'GET',  url: '/api/banks',             beschrijving: 'Lijst van alle banken' },
            { method: 'POST', url: '/api/banks',             beschrijving: 'Bank registreren of updaten' },
            { method: 'POST', url: '/api/po_in',             beschrijving: "PO's insturen naar CB" },
            { method: 'GET',  url: '/api/po_out',            beschrijving: "PO's ophalen van CB (verwijdert!)" },
            { method: 'GET',  url: '/api/po_out/test/true',  beschrijving: "PO's ophalen testmodus (verwijdert NIET)" },
            { method: 'POST', url: '/api/ack_in',            beschrijving: "ACK's insturen naar CB" },
            { method: 'GET',  url: '/api/ack_out',           beschrijving: "ACK's ophalen van CB (verwijdert!)" },
            { method: 'GET',  url: '/api/ack_out/test/true', beschrijving: "ACK's ophalen testmodus (verwijdert NIET)" },
        ]
    });
});
// POST /auth/login
app.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password)
            return res.status(400).json({ ok: false, message: 'Username en password zijn verplicht' });
        
        const conn = await getPool();
        const [rows] = await conn.execute(
            'SELECT id, username, role, password FROM USERS WHERE username = ?',
            [username]
        );
        await conn.end();

        if (rows.length === 0)
            return res.status(401).json({ ok: false, message: 'Ongeldige gebruikersnaam of wachtwoord' });

        const match = await bcrypt.compare(password, rows[0].password);
        if (!match)
            return res.status(401).json({ ok: false, message: 'Ongeldige gebruikersnaam of wachtwoord' });

        const { token, expiresAt } = createAccessToken(process.env.TEAM_BIC || 'GUI', 'gui');

        res.json({
            ok: true,
            status: 200,
            user: { id: rows[0].id, username: rows[0].username, role: rows[0].role },
            apiToken: token,
            apiTokenExpiresAt: new Date(expiresAt).toISOString()
        });
    } catch (err) {
        res.status(500).json({ ok: false, message: err.message });
    }
});

// GET /auth/users
app.get('/auth/users', async (req, res) => {
    try {
        const conn = await getConn();
        const [rows] = await conn.execute('SELECT id, username, role, created_at FROM USERS');
        await conn.end();
        res.json({ ok: true, status: 200, data: rows });
    } catch (err) {
        res.status(500).json({ ok: false, message: err.message });
    }
});

// POST /auth/users
app.post('/auth/users', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        if (!username || !password)
            return res.status(400).json({ ok: false, message: 'Username en password zijn verplicht' });
        const conn = await getConn();
        await conn.execute(
            'INSERT INTO USERS (username, password, role) VALUES (?, ?, ?)',
            [username, password, role || 'user']
        );
        await conn.end();
        res.json({ ok: true, status: 200, message: 'Gebruiker aangemaakt' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY')
            return res.status(400).json({ ok: false, message: 'Username bestaat al' });
        res.status(500).json({ ok: false, message: err.message });
    }
});

// DELETE /auth/users/:id
app.delete('/auth/users/:id', async (req, res) => {
    try {
        const conn = await getConn();
        await conn.execute('DELETE FROM USERS WHERE id = ? AND username != "admin"', [req.params.id]);
        await conn.end();
        res.json({ ok: true, status: 200, message: 'Gebruiker verwijderd' });
    } catch (err) {
        res.status(500).json({ ok: false, message: err.message });
    }
});
// ════════════════════════════════════════════════════════════
// SERVER STARTEN
// ════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 80;

ensureSchema()
    .then(() => {
        app.listen(PORT, () => {
            console.log('CB API DRAAIT op poort ' + PORT);
        });
    })
    .catch((err) => {
        console.error('Schema migration failed:', err.message);
        process.exit(1);
    });
