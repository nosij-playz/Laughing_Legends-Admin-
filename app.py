from flask import Flask, render_template, request, jsonify
import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv
import random
import string
from datetime import datetime
import json

load_dotenv()

app = Flask(__name__)

def initialize_firebase():
    """
    Initialize Firebase app using environment variable for credentials.
    The environment variable should contain either:
      1. Path to JSON file, OR
      2. JSON string with service account content.
    """
    try:
        # Prevent re-initialization
        if not firebase_admin._apps:
            firebase_cred = os.getenv("FIREBASE_CREDENTIALS_JSON")

            if firebase_cred:
                if os.path.exists(firebase_cred):
                    # Case 1: FIREBASE_CREDENTIALS = path to JSON file
                    cred = credentials.Certificate.from_json(json.loads(firebase_cred))
                    firebase_admin.initialize_app(cred)
                    print("✅ Firebase initialized using credentials file from environment variable.")
                else:
                    # Case 2: FIREBASE_CREDENTIALS = JSON string content
                    cred_dict = json.loads(firebase_cred)
                    cred = credentials.Certificate(cred_dict)
                    firebase_admin.initialize_app(cred)
                    print("✅ Firebase initialized using JSON credentials from environment variable.")
            else:
                # Fallback — uses ADC (Application Default Credentials)
                firebase_admin.initialize_app()
                print("⚠️ Firebase initialized using default credentials (no FIREBASE_CREDENTIALS found).")

        else:
            print("ℹ️ Firebase already initialized, reusing existing app.")
        
        return firestore.client()

    except Exception as e:
        print(f"❌ Firebase initialization error: {e}")
        return None

db = initialize_firebase()

def generate_unique_code(length=8):
    characters = string.ascii_uppercase + string.digits
    return ''.join(random.choice(characters) for _ in range(length))

@app.route('/')
def admin_panel():
    return render_template('admin.html')

@app.route('/view-participants')
def view_participants():
    return render_template('view_participants.html')

@app.route('/api/participants', methods=['GET'])
def get_participants():
    try:
        if not db:
            return jsonify({'error': 'Database not initialized'}), 500
            
        participants_ref = db.collection('participants')
        docs = participants_ref.order_by('created_at', direction=firestore.Query.DESCENDING).stream()
        
        participants = []
        for doc in docs:
            participant_data = doc.to_dict()
            participant_data['id'] = doc.id
            
            # Check if team exists in leaderboard
            leaderboard_data = get_leaderboard_data(participant_data['teamName'])
            participant_data['in_leaderboard'] = bool(leaderboard_data)
            participant_data['leaderboard_status'] = leaderboard_data.get('status', 'not_started')
            participant_data['leaderboard_points'] = leaderboard_data.get('totalPoints', 0)
            participant_data['leaderboard_wins'] = leaderboard_data.get('wins', 0)
            participant_data['games_played'] = leaderboard_data.get('gamesPlayed', 0)
            
            participants.append(participant_data)
            
        return jsonify(participants)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/participants', methods=['POST'])
def add_participant():
    try:
        if not db:
            return jsonify({'error': 'Database not initialized'}), 500
            
        data = request.get_json()
        
        required_fields = ['participant1', 'participant2', 'phone1', 'phone2', 'teamName']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        unique_code = generate_unique_code()
        
        participant_data = {
            'participant1': data['participant1'].strip(),
            'participant2': data['participant2'].strip(),
            'phone1': data['phone1'].strip(),
            'phone2': data['phone2'].strip(),
            'teamName': data['teamName'].strip(),
            'uniqueCode': unique_code,
            'created_at': firestore.SERVER_TIMESTAMP,
            'status': 'registered'
        }
        
        doc_ref = db.collection('participants').document()
        doc_ref.set(participant_data)
        
        return jsonify({
            'message': 'Team registered successfully!',
            'uniqueCode': unique_code,
            'id': doc_ref.id
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/participants/<participant_id>', methods=['DELETE'])
def delete_participant(participant_id):
    try:
        if not db:
            return jsonify({'error': 'Database not initialized'}), 500
            
        # Also delete from leaderboard if exists
        try:
            db.collection('leaderboard').document(participant_id).delete()
        except:
            pass
            
        db.collection('participants').document(participant_id).delete()
        return jsonify({'message': 'Team deleted successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/move-to-leaderboard/<participant_id>', methods=['POST'])
def move_to_leaderboard(participant_id):
    try:
        if not db:
            return jsonify({'error': 'Database not initialized'}), 500
            
        # Get participant data
        participant_doc = db.collection('participants').document(participant_id).get()
        if not participant_doc.exists:
            return jsonify({'error': 'Team not found'}), 404
            
        participant_data = participant_doc.to_dict()
        team_name = participant_data['teamName']
        
        # Check if team already exists in leaderboard
        leaderboard_ref = db.collection('leaderboard').where('name', '==', team_name)
        existing_teams = leaderboard_ref.get()
        
        if not existing_teams:
            # Create new leaderboard entry with EXACT structure you specified
            leaderboard_data = {
                'name': team_name,
                'status': 'offline',
                'totalPoints': 0,
                'wins': 0,
                'gamesPlayed': 0
            }
            
            db.collection('leaderboard').document(participant_id).set(leaderboard_data)
            
            # Update participant status
            db.collection('participants').document(participant_id).update({
                'status': 'in_leaderboard'
            })
            
            return jsonify({
                'message': f'Team "{team_name}" launched to leaderboard!',
                'leaderboard_data': leaderboard_data
            })
        else:
            return jsonify({'error': 'Team already in leaderboard'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    try:
        if not db:
            return jsonify({'error': 'Database not initialized'}), 500
            
        leaderboard_ref = db.collection('leaderboard')
        docs = leaderboard_ref.order_by('totalPoints', direction=firestore.Query.DESCENDING).stream()
        
        leaderboard = []
        for doc in docs:
            team_data = doc.to_dict()
            team_data['id'] = doc.id
            leaderboard.append(team_data)
            
        return jsonify(leaderboard)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/leaderboard/<leaderboard_id>/status', methods=['POST'])
def set_leaderboard_status(leaderboard_id):
    """Set leaderboard entry status to 'online' or 'offline'"""
    try:
        if not db:
            return jsonify({'error': 'Database not initialized'}), 500

        data = request.get_json() or {}
        status = data.get('status')
        if status not in ('online', 'offline'):
            return jsonify({'error': "Invalid status. Use 'online' or 'offline'."}), 400

        doc_ref = db.collection('leaderboard').document(leaderboard_id)
        doc = doc_ref.get()
        if not doc.exists:
            return jsonify({'error': 'Leaderboard entry not found'}), 404

        doc_ref.update({'status': status})

        updated = doc_ref.get().to_dict()
        updated['id'] = doc_ref.id

        return jsonify({'message': 'Status updated', 'leaderboard': updated})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/all-data', methods=['GET'])
def get_all_data():
    """Get combined data from both participants and leaderboard collections"""
    try:
        if not db:
            return jsonify({'error': 'Database not initialized'}), 500
            
        # Get all participants
        participants_ref = db.collection('participants').stream()
        participants_data = []
        
        for doc in participants_ref:
            data = doc.to_dict()
            data['id'] = doc.id
            data['collection'] = 'participants'
            participants_data.append(data)
        
        # Get all leaderboard entries
        leaderboard_ref = db.collection('leaderboard').stream()
        leaderboard_data = []
        
        # We'll enrich leaderboard entries with participant details (if available)
        for doc in leaderboard_ref:
            data = doc.to_dict()
            data['id'] = doc.id
            data['collection'] = 'leaderboard'

            # Try to find matching participant by id or teamName
            try:
                participant_doc = db.collection('participants').document(doc.id).get()
                if participant_doc.exists:
                    p = participant_doc.to_dict()
                    data['participant1'] = p.get('participant1')
                    data['participant2'] = p.get('participant2')
                    data['phone1'] = p.get('phone1')
                    data['phone2'] = p.get('phone2')
                    data['uniqueCode'] = p.get('uniqueCode')
                else:
                    # fallback: search by teamName/name
                    name = data.get('name')
                    if name:
                        q = db.collection('participants').where('teamName', '==', name).limit(1).get()
                        if q:
                            p = q[0].to_dict()
                            data['participant1'] = p.get('participant1')
                            data['participant2'] = p.get('participant2')
                            data['phone1'] = p.get('phone1')
                            data['phone2'] = p.get('phone2')
                            data['uniqueCode'] = p.get('uniqueCode')
            except Exception:
                # ignore enrichment failures
                pass

            leaderboard_data.append(data)
        
        # Deduplicate: if a participant appears in leaderboard (by id or teamName),
        # don't list it again under participants to avoid double-counting in UI.
        leaderboard_ids = set([item.get('id') for item in leaderboard_data if item.get('id')])
        leaderboard_names = set([item.get('name') for item in leaderboard_data if item.get('name')])

        filtered_participants = []
        for p in participants_data:
            pid = p.get('id')
            pname = p.get('teamName') or p.get('name')
            if pid and pid in leaderboard_ids:
                # skip duplicate by id
                continue
            if pname and pname in leaderboard_names:
                # skip duplicate by teamName
                continue
            filtered_participants.append(p)

        return jsonify({
            'participants': filtered_participants,
            'leaderboard': leaderboard_data
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_leaderboard_data(team_name):
    """Helper function to get leaderboard data for a team"""
    try:
        if not db:
            return {}
            
        leaderboard_ref = db.collection('leaderboard').where('name', '==', team_name)
        docs = leaderboard_ref.get()
        
        if docs:
            return docs[0].to_dict()
        return {}
    except:
        return {}

@app.route('/api/generate-code', methods=['GET'])
def generate_code():
    return jsonify({'uniqueCode': generate_unique_code()})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)