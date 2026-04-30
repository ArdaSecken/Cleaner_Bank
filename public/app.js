// ============================================================
// AXA Clearflow – Clearing Bank GUI
// app.js – alle logica en API calls
// API base: http://localhost:3000
// ============================================================

const API = '';

let currentUser = null;
let cbApiToken = null;

function apiFetch(path, options = {}) {
    const headers = {
        ...(options.headers || {}),
        Authorization: 'Bearer ' + cbApiToken
    };

    return fetch(API + path, { ...options, headers });
}

async function doLogin() {
    const username = document.getElementById('login-user').value.trim();
    const password = document.getElementById('login-pass').value.trim();
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';
    try {
        const r = await fetch(API + '/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        }).then(r => r.json());
        if (!r.ok) { errEl.textContent = r.message; errEl.style.display = 'block'; return; }
        currentUser = r.user;
        cbApiToken = r.apiToken;

        if (!cbApiToken) {
            errEl.textContent = 'Geen API token ontvangen';
            errEl.style.display = 'block';
            return;
        }

        document.getElementById('user-name').textContent = currentUser.username;
        document.getElementById('user-role').textContent = currentUser.role;
        document.getElementById('user-avatar').textContent = currentUser.username[0].toUpperCase();
        if (currentUser.role === 'admin') document.getElementById('nav-users').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
        loadDashboard();
    } catch (e) {
        errEl.textContent = 'API niet bereikbaar';
        errEl.style.display = 'block';
    }
}

function doLogout() {
    currentUser = null;
    cbApiToken = null;
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-user').value = '';
    document.getElementById('login-pass').value = '';
}
// ── HELPERS ──────────────────────────────────────────────────

function nowSQL() {
    const d = new Date();
    return d.getFullYear() + '-'
        + String(d.getMonth() + 1).padStart(2, '0') + '-'
        + String(d.getDate()).padStart(2, '0') + ' '
        + String(d.getHours()).padStart(2, '0') + ':'
        + String(d.getMinutes()).padStart(2, '0') + ':'
        + String(d.getSeconds()).padStart(2, '0');
}

function fmt(v) {
    return '€' + parseFloat(v || 0).toFixed(2);
}

function badgeHTML(code) {
    if (!code) {
        return '<span class="badge pending"><div class="badge-dot"></div>Pending</span>';
    }
    const c = String(code);
    if (c.startsWith('2')) {
        return '<span class="badge ok"><div class="badge-dot"></div>' + c + '</span>';
    }
    if (c.startsWith('4') || c.startsWith('5')) {
        return '<span class="badge err"><div class="badge-dot"></div>' + c + '</span>';
    }
    return '<span class="badge pending"><div class="badge-dot"></div>' + c + '</span>';
}

function showResp(id, data, isError) {
    const el = document.getElementById(id);
    el.className = 'response visible' + (isError ? ' error' : '');
    el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
}

function setBtn(btn, loading) {
    if (loading) {
        btn._originalText = btn.textContent;
        btn.innerHTML = '<span class="spinner"></span>Processing...';
        btn.disabled = true;
    } else {
        btn.textContent = btn._originalText || 'Done';
        btn.disabled = false;
    }
}

function poTableHTML(rows) {
    if (!rows || rows.length === 0) {
        return '<div class="empty">No records found</div>';
    }
    const rowsHTML = rows.map(r => {
        return '<tr>'
            + '<td class="td-mono">' + (r.po_id || '—').slice(0, 24) + '</td>'
            + '<td style="font-weight:700">' + fmt(r.po_amount) + '</td>'
            + '<td class="td-mono">' + (r.ob_id || '—') + '</td>'
            + '<td class="td-mono">' + (r.bb_id || '—') + '</td>'
            + '<td>' + badgeHTML(r.cb_code) + '</td>'
            + '<td>' + badgeHTML(r.bb_code) + '</td>'
            + '</tr>';
    }).join('');

    return '<div class="table-wrap"><table>'
        + '<thead><tr>'
        + '<th>Transaction ID</th>'
        + '<th>Amount</th>'
        + '<th>Originator (BIC)</th>'
        + '<th>Beneficiary (BIC)</th>'
        + '<th>CB Status</th>'
        + '<th>BB Status</th>'
        + '</tr></thead>'
        + '<tbody>' + rowsHTML + '</tbody>'
        + '</table></div>';
}

// ── NAVIGATION ───────────────────────────────────────────────

function showPage(name, clickedEl) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + name).classList.add('active');
    if (clickedEl) clickedEl.classList.add('active');

    const titles = {
        dashboard:    'Dashboard',
        transactions: 'Transaction Ledger',
        validation:   'Validation Console',
        banks:        'Network Monitor',
        po_in:        'PO Queue',
        ack:          'ACK Processing',
        log:          'Audit Log'
    };
    document.getElementById('page-title').textContent = titles[name] || name;
}

// ── DASHBOARD ────────────────────────────────────────────────

async function loadDashboard() {
    try {
        const [poOut, banks, poIn] = await Promise.all([
            apiFetch('/api/po_out/test/true').then(r => r.json()).catch(() => ({ ok: false, data: [] })),
            apiFetch('/api/banks').then(r => r.json()).catch(() => ({ ok: false, data: [] })),
            fetch(API + '/test-po-in').then(r => r.json()).catch(() => ({ ok: false, data: [] })),
        ]);

        if (poOut.ok) {
            document.getElementById('s-po-out').textContent = (poOut.data || []).length;
            document.getElementById('badge-po').textContent = (poOut.data || []).length;
            document.getElementById('dash-po-out').innerHTML = poTableHTML((poOut.data || []).slice(0, 4));
        }

        if (banks.ok) {
            document.getElementById('s-banks').textContent = (banks.data || []).length;
        }

        if (poIn.data) {
            document.getElementById('s-po-in').textContent = (poIn.data || []).length;
            document.getElementById('dash-po-in').innerHTML = poTableHTML((poIn.data || []).slice(0, 4));
        }

        document.getElementById('sys-dot').className = 'status-dot on';
        document.getElementById('sys-status').textContent = 'System Operational';

        const pill = document.getElementById('op-pill');
        pill.style.background = 'var(--green-bg)';
        pill.style.color = 'var(--green)';
        pill.textContent = 'System Operational';

    } catch (e) {
        document.getElementById('sys-dot').className = 'status-dot';
        document.getElementById('sys-status').textContent = 'API Offline';

        const pill = document.getElementById('op-pill');
        pill.style.background = '#FDECEA';
        pill.style.color = '#C62828';
        pill.textContent = 'API Offline';
    }
}

// ── TRANSACTIONS ─────────────────────────────────────────────

async function loadTransactions() {
    const btn = document.querySelector('#page-transactions .btn.primary');
    if (btn) setBtn(btn, true);

    try {
        const r = await fetch(API + '/test-po-in').then(r => r.json());
        const filter = document.getElementById('tx-filter').value;
        let rows = r.data || [];

        if (filter === 'pending') rows = rows.filter(x => !x.cb_code);
        if (filter === 'ok')      rows = rows.filter(x => x.cb_code === '2000');

        const tbody = document.getElementById('tx-body');
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="7"><div class="empty">No transactions found</div></td></tr>';
            return;
        }

        tbody.innerHTML = rows.map(r => {
            const date = r.po_datetime ? String(r.po_datetime).slice(0, 10) : '—';
            return '<tr>'
                + '<td class="td-mono" style="color:var(--axa)">' + (r.po_id || '—').slice(0, 24) + '</td>'
                + '<td class="td-muted">' + date + '</td>'
                + '<td>'
                +   '<span style="font-size:11px;color:var(--muted)">OUT </span><strong>' + (r.ob_id || '—') + '</strong><br>'
                +   '<span style="font-size:11px;color:var(--muted)">IN &nbsp;</span><strong>' + (r.bb_id || '—') + '</strong>'
                + '</td>'
                + '<td style="font-weight:700">' + fmt(r.po_amount) + '</td>'
                + '<td>' + badgeHTML(r.cb_code) + '</td>'
                + '<td>' + badgeHTML(r.bb_code) + '</td>'
                + '<td class="td-muted">' + (r.po_message || '').slice(0, 30) + '</td>'
                + '</tr>';
        }).join('');

    } catch (e) {
        document.getElementById('tx-body').innerHTML =
            '<tr><td colspan="7"><div class="empty">API not reachable</div></td></tr>';
    } finally {
        if (btn) setBtn(btn, false);
    }
}

// ── BANKS ────────────────────────────────────────────────────

async function loadBanks() {
    try {
        const r = await apiFetch('/api/banks').then(r => r.json());
        const tbody = document.getElementById('banks-body');

        if (!r.ok || !(r.data || []).length) {
            tbody.innerHTML = '<tr><td colspan="3"><div class="empty">No banks registered</div></td></tr>';
            return;
        }

        tbody.innerHTML = r.data.map(b => {
            return '<tr>'
                + '<td class="td-mono">' + (b.id || '—') + '</td>'
                + '<td style="font-weight:600">' + (b.name || '—') + '</td>'
                + '<td class="td-muted">' + (b.description || '—') + '</td>'
                + '</tr>';
        }).join('');

        document.getElementById('s-banks').textContent = r.data.length;

    } catch (e) {
        document.getElementById('banks-body').innerHTML =
            '<tr><td colspan="3"><div class="empty">API not reachable</div></td></tr>';
    }
}

async function registerBank(btn) {
    const id          = document.getElementById('b-id').value.trim();
    const name        = document.getElementById('b-name').value.trim();
    const description = document.getElementById('b-desc').value.trim();

    if (!id || !name) {
        showResp('b-response', 'BIC and name are required', true);
        return;
    }

    setBtn(btn, true);
    try {
        const r = await apiFetch('/api/banks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name, description })
        }).then(r => r.json());

        showResp('b-response', r, !r.ok);
        if (r.ok) loadBanks();

    } catch (e) {
        showResp('b-response', 'Error: ' + e.message, true);
    }
    setBtn(btn, false);
}

// ── VALIDATION ───────────────────────────────────────────────

function fillValDemo() {
    document.getElementById('v-po_id').value  = 'AXABBE22_VAL' + Date.now().toString(36).toUpperCase();
    document.getElementById('v-amount').value = '150.00';
    document.getElementById('v-ob_id').value  = 'AXABBE22';
    document.getElementById('v-bb_id').value  = 'CVMCBEBB';
    document.getElementById('v-oa_id').value  = 'BE68539007547034';
    document.getElementById('v-ba_id').value  = 'BE71096123456769';
}

async function testValidation(btn) {
    const po = {
        po_id:       document.getElementById('v-po_id').value.trim(),
        po_amount:   parseFloat(document.getElementById('v-amount').value),
        po_message:  'Validation test',
        po_datetime: nowSQL(),
        ob_id:       document.getElementById('v-ob_id').value.trim(),
        oa_id:       document.getElementById('v-oa_id').value.trim(),
        ob_code:     '2000',
        ob_datetime: nowSQL(),
        bb_id:       document.getElementById('v-bb_id').value.trim(),
        ba_id:       document.getElementById('v-ba_id').value.trim()
    };

    setBtn(btn, true);
    try {
        const r = await apiFetch('/api/po_in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: [po] })
        }).then(r => r.json());

        showResp('v-response', r, !r.ok);

    } catch (e) {
        showResp('v-response', 'Error: ' + e.message, true);
    }
    setBtn(btn, false);
}

// ── PO IN ────────────────────────────────────────────────────

function fillPODemo() {
    const ts = nowSQL();
    document.getElementById('pi-id').value      = 'AXABBE22_' + Date.now().toString(36).toUpperCase();
    document.getElementById('pi-amount').value  = (Math.random() * 490 + 10).toFixed(2);
    document.getElementById('pi-message').value = 'Huur april 2026';
    document.getElementById('pi-dt').value      = ts;
    document.getElementById('pi-ob_id').value   = 'AXABBE22';
    document.getElementById('pi-oa_id').value   = 'BE68539007547034';
    document.getElementById('pi-ob_code').value = '2000';
    document.getElementById('pi-ob_dt').value   = ts;
    document.getElementById('pi-bb_id').value   = 'CVMCBEBB';
    document.getElementById('pi-ba_id').value   = 'BE71096123456769';
}

async function sendPOIn(btn) {
    const po = {
        po_id:       document.getElementById('pi-id').value.trim(),
        po_amount:   parseFloat(document.getElementById('pi-amount').value),
        po_message:  document.getElementById('pi-message').value.trim(),
        po_datetime: document.getElementById('pi-dt').value.trim(),
        ob_id:       document.getElementById('pi-ob_id').value.trim(),
        oa_id:       document.getElementById('pi-oa_id').value.trim(),
        ob_code:     document.getElementById('pi-ob_code').value.trim(),
        ob_datetime: document.getElementById('pi-ob_dt').value.trim(),
        bb_id:       document.getElementById('pi-bb_id').value.trim(),
        ba_id:       document.getElementById('pi-ba_id').value.trim()
    };

    setBtn(btn, true);
    try {
        const r = await apiFetch('/api/po_in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: [po] })
        }).then(r => r.json());

        showResp('pi-response', r, !r.ok);

    } catch (e) {
        showResp('pi-response', 'Error: ' + e.message, true);
    }
    setBtn(btn, false);
}

// ── PO OUT ───────────────────────────────────────────────────

async function fetchPOOut(btn) {
    const test = document.getElementById('po-test').checked;
    const url  = test ? '/api/po_out/test/true' : '/api/po_out';

    setBtn(btn, true);
    try {
        const r = await apiFetch(url).then(r => r.json());

        if (r.ok) {
            const count = (r.data || []).length;
            showResp('po-out-response',
                count + " PO's received" + (test ? ' (test mode — not deleted)' : ''),
                false
            );
            document.getElementById('po-out-table').innerHTML = poTableHTML(r.data);
        } else {
            showResp('po-out-response', r, true);
        }

    } catch (e) {
        showResp('po-out-response', 'Error: ' + e.message, true);
    }
    setBtn(btn, false);
}

// ── ACK IN ───────────────────────────────────────────────────

async function sendACKIn(btn) {
    let po;
    try {
        po = JSON.parse(document.getElementById('ack-json').value);
    } catch (e) {
        showResp('ack-response', 'Invalid JSON — check your input', true);
        return;
    }

    po.bb_code     = document.getElementById('ack-bb_code').value.trim();
    po.bb_datetime = document.getElementById('ack-bb_dt').value.trim();

    setBtn(btn, true);
    try {
        const r = await apiFetch('/api/ack_in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: [po] })
        }).then(r => r.json());

        showResp('ack-response', r, !r.ok);

    } catch (e) {
        showResp('ack-response', 'Error: ' + e.message, true);
    }
    setBtn(btn, false);
}

// ── ACK OUT ──────────────────────────────────────────────────

async function fetchACKOut(btn) {
    const test = document.getElementById('ack-test').checked;
    const url  = test ? '/api/ack_out/test/true' : '/api/ack_out';

    setBtn(btn, true);
    try {
        const r = await apiFetch(url).then(r => r.json());

        if (r.ok) {
            const count = (r.data || []).length;
            showResp('ack-out-response',
                count + " ACK's received" + (test ? ' (test mode)' : ''),
                false
            );
            document.getElementById('ack-out-table').innerHTML = poTableHTML(r.data);
        } else {
            showResp('ack-out-response', r, true);
        }

    } catch (e) {
        showResp('ack-out-response', 'Error: ' + e.message, true);
    }
    setBtn(btn, false);
}

// ── LOG ──────────────────────────────────────────────────────

async function loadLog() {
    const el = document.getElementById('log-full');
    el.innerHTML = '<div class="empty">Loading...</div>';

    try {
        const r = await fetch(API + '/test-po-in').then(r => r.json());
        const rows = r.data || [];

        if (!rows.length) {
            el.innerHTML = '<div class="empty">No events found</div>';
            return;
        }

        el.innerHTML = rows.slice(0, 60).map(r => {
            const time = r.po_datetime ? String(r.po_datetime).slice(11, 19) : '—';
            const msg  = (r.po_id || '—') + ' | ' + (r.ob_id || '') + ' → ' + (r.bb_id || '') + ' | ' + fmt(r.po_amount);
            return '<div class="log-entry">'
                + '<span class="log-time">' + time + '</span>'
                + '<span class="log-type po_in">[po_in]</span>'
                + '<span class="log-msg">' + msg + '</span>'
                + '</div>';
        }).join('');

    } catch (e) {
        el.innerHTML = '<div class="empty">API not reachable</div>';
    }
}


// ── USER MANAGEMENT ───────────────────────────────────────────

async function loadUsers() {
    try {
        const r = await fetch(API + '/auth/users').then(r => r.json());
        const tbody = document.getElementById('users-body');
        if (!r.ok || !(r.data || []).length) {
            tbody.innerHTML = '<tr><td colspan="5"><div class="empty">Geen gebruikers</div></td></tr>';
            return;
        }
        tbody.innerHTML = r.data.map(u =>
            '<tr>'
            + '<td class="td-mono">' + u.id + '</td>'
            + '<td style="font-weight:600">' + u.username + '</td>'
            + '<td><span class="badge ' + (u.role === 'admin' ? 'axa' : 'ok') + '">' + u.role + '</span></td>'
            + '<td class="td-muted">' + String(u.created_at || '').slice(0, 10) + '</td>'
            + '<td>' + (u.username !== 'admin' ? '<button class="btn sm" style="color:#c62828;border-color:#c62828" onclick="deleteUser(' + u.id + ')">Verwijder</button>' : '—') + '</td>'
            + '</tr>'
        ).join('');
    } catch (e) {
        document.getElementById('users-body').innerHTML = '<tr><td colspan="5"><div class="empty">Error</div></td></tr>';
    }
}

async function createUser(btn) {
    const username = document.getElementById('nu-user').value.trim();
    const password = document.getElementById('nu-pass').value.trim();
    const role     = document.getElementById('nu-role').value;
    if (!username || !password) {
        showResp('nu-response', 'Vul alle velden in', true);
        return;
    }
    setBtn(btn, true);
    try {
        const r = await fetch(API + '/auth/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role })
        }).then(r => r.json());
        showResp('nu-response', r, !r.ok);
        if (r.ok) {
            loadUsers();
            document.getElementById('nu-user').value = '';
            document.getElementById('nu-pass').value = '';
        }
    } catch (e) {
        showResp('nu-response', 'Error: ' + e.message, true);
    }
    setBtn(btn, false);
}

async function deleteUser(id) {
    if (!confirm('Ben je zeker dat je deze gebruiker wil verwijderen?')) return;
    try {
        await fetch(API + '/auth/users/' + id, { method: 'DELETE' });
        loadUsers();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

// ── CLOCK ────────────────────────────────────────────────────

setInterval(() => {
    const d = new Date();
    const time = String(d.getHours()).padStart(2, '0') + ':'
               + String(d.getMinutes()).padStart(2, '0') + ':'
               + String(d.getSeconds()).padStart(2, '0');
    document.getElementById('clock').textContent = 'Last Sync: ' + time;
}, 1000);

// ── INIT ─────────────────────────────────────────────────────

document.getElementById('pi-dt').value     = nowSQL();
document.getElementById('pi-ob_dt').value  = nowSQL();
document.getElementById('ack-bb_dt').value = nowSQL();
