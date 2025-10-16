import os
from pathlib import Path

# Stop Flask CLI from auto-reading the ROOT env file
os.environ.setdefault("FLASK_SKIP_DOTENV", "1")

import sqlite3
from flask import Flask, request, jsonify, Response
import secrets
import csv
import io

app = Flask(__name__)

ADMIN_TOKEN = "supersecret123"  # Hardcoded for now

# (optional) log lengths for sanity (not the token itself)
print(f"[server] ADMIN_TOKEN length: {len(ADMIN_TOKEN)}")

@app.route('/api/health', methods=['GET'])
def health():
    return {"ok": True}

def get_db():
    """Get database connection with row factory"""
    db_path = os.getenv('DB_PATH', 'reaction.db')
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database with schema"""
    with open('schema.sql', 'r') as f:
        schema = f.read()
    
    conn = get_db()
    conn.executescript(schema)
    conn.commit()
    conn.close()

def query(sql, args=()):
    """Execute query and return results"""
    conn = get_db()
    try:
        cursor = conn.execute(sql, args)
        results = cursor.fetchall()
        return [dict(row) for row in results]
    finally:
        conn.close()

def execute(sql, args=()):
    """Execute statement and return lastrowid"""
    conn = get_db()
    try:
        cursor = conn.execute(sql, args)
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()

@app.after_request
def after_request(response):
    """Add security headers"""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['Content-Security-Policy'] = "default-src 'self'; style-src 'self' 'unsafe-inline';"
    return response

@app.route('/api/start', methods=['POST'])
def start_session():
    """Start a new session"""
    data = request.get_json()
    name = data.get('name', '').strip()
    
    # Validate name
    if len(name) < 2 or len(name) > 80:
        return jsonify({'error': 'Name must be 2-80 characters'}), 400
    
    if '<' in name or '>' in name:
        return jsonify({'error': 'Name cannot contain < or >'}), 400
    
    try:
        # Upsert player
        player_id = execute(
            'INSERT OR IGNORE INTO players (name) VALUES (?)',
            (name,)
        )
        
        if player_id is None:
            # Player exists, get their ID
            result = query('SELECT id FROM players WHERE name = ?', (name,))
            player_id = result[0]['id']
        
        # Create session
        session_id = secrets.token_hex(16)
        execute(
            'INSERT INTO sessions (id, player_id, consent, completed) VALUES (?, ?, 0, 0)',
            (session_id, player_id)
        )
        
        return jsonify({'session': session_id, 'player_id': player_id})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/consent', methods=['POST'])
def give_consent():
    """Give consent for session"""
    data = request.get_json()
    session_id = data.get('session')
    
    if not session_id:
        return jsonify({'error': 'Session ID required'}), 400
    
    try:
        # Check session exists and not completed
        session = query('SELECT * FROM sessions WHERE id = ? AND completed = 0', (session_id,))
        if not session:
            return jsonify({'error': 'Invalid or completed session'}), 400
        
        # Update consent
        execute('UPDATE sessions SET consent = 1 WHERE id = ?', (session_id,))
        
        return jsonify({'ok': True})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/submit', methods=['POST'])
def submit_score():
    """Submit reaction time score"""
    data = request.get_json()
    session_id = data.get('session')
    rt_ms = data.get('rt_ms')
    ua = data.get('ua', '')
    screen = data.get('screen', {})
    
    if not session_id or not rt_ms:
        return jsonify({'error': 'Session ID and reaction time required'}), 400
    
    try:
        # Check session exists, has consent, not completed
        session = query(
            'SELECT * FROM sessions WHERE id = ? AND consent = 1 AND completed = 0',
            (session_id,)
        )
        if not session:
            return jsonify({'error': 'Invalid session'}), 400
        
        player_id = session[0]['player_id']
        
        # Clean reaction time
        rt_ms_clean = rt_ms if 80 <= rt_ms <= 2000 else None
        
        # Insert score
        execute(
            'INSERT INTO scores (player_id, session_id, trial_idx, rt_ms_raw, rt_ms_clean) VALUES (?, ?, 1, ?, ?)',
            (player_id, session_id, rt_ms, rt_ms_clean)
        )
        
        # Update session
        execute(
            'UPDATE sessions SET completed = 1, user_agent = ?, screen_w = ?, screen_h = ? WHERE id = ?',
            (ua[:300], screen.get('w'), screen.get('h'), session_id)
        )
        
        return jsonify({'ok': True})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    """Get leaderboard data"""
    try:
        results = query('SELECT * FROM leaderboard ORDER BY best_ms ASC')
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/players/<int:player_id>', methods=['DELETE'])
def delete_player(player_id):
    """Delete player (admin only)"""
    admin_token = request.headers.get('X-Admin-Token')
    expected_token = os.getenv('ADMIN_TOKEN')
    
    if not admin_token or admin_token != expected_token:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        # Soft delete player and their scores
        execute('UPDATE players SET deleted = 1 WHERE id = ?', (player_id,))
        execute('UPDATE scores SET deleted = 1 WHERE player_id = ?', (player_id,))
        
        return jsonify({'ok': True})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/export.csv', methods=['GET'])
def export_csv():
    """Export leaderboard as CSV"""
    try:
        results = query('SELECT * FROM leaderboard ORDER BY best_ms ASC')
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Name', 'Best Time (ms)', 'Mean Time (ms)', 'Tries'])
        
        for row in results:
            writer.writerow([row['name'], row['best_ms'], row['mean_ms'], row['tries']])
        
        output.seek(0)
        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': 'attachment; filename=leaderboard.csv'}
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    init_db()
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
