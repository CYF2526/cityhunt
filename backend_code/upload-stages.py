#!/usr/bin/env python3
import sys
import json
import os
from firebase_admin import credentials, firestore, initialize_app

def check_stages_collection(db):
    """Check if stages collection exists and is accessible"""
    try:
        # Verify Firestore connection by attempting to access the stages collection
        stages_ref = db.collection('stages')
        list(stages_ref.limit(1).stream())
        return True
    except Exception as e:
        # If we get a permission error or connection error, collection is not accessible
        error_str = str(e).lower()
        if 'permission' in error_str or 'not found' in error_str or 'not accessible' in error_str:
            return False
        # For other errors, still return False to be safe
        return False

def upload_stages(db, stages_data):
    """Upload stages to Firestore, overwriting existing documents"""
    batch = db.batch()
    batch_count = 0
    BATCH_LIMIT = 500  # Firestore batch limit
    
    for stage in stages_data:
        # Determine document ID
        if 'stageId' in stage:
            doc_id = f"stage{stage['stageId']}"
        elif 'docId' in stage:
            doc_id = stage['docId']
        else:
            print(f"Skipping stage without docId or stageId: {stage}")
            continue
        
        # Prepare document data (exclude docId from data)
        stage_data = {k: v for k, v in stage.items() if k != 'docId'}
        
        # Ensure stageId is set
        if 'stageId' not in stage_data:
            stage_data['stageId'] = int(doc_id.replace('stage', ''))
        
        doc_ref = db.collection('stages').document(doc_id)
        batch.set(doc_ref, stage_data)  # Overwrite completely
        batch_count += 1
        
        # Firestore batch limit is 500 operations
        if batch_count >= BATCH_LIMIT:
            batch.commit()
            print(f'Committed batch of {batch_count} documents')
            batch_count = 0
            batch = db.batch()
    
    # Commit remaining documents
    if batch_count > 0:
        batch.commit()
        print(f'Committed final batch of {batch_count} documents')

def main():
    # Get stages data file path from command line or use default
    stages_file = sys.argv[1] if len(sys.argv) > 1 else './stages-data.json'
    
    if not os.path.exists(stages_file):
        print(f'Error: Stages data file not found: {stages_file}')
        print('Usage: python upload-stages.py [path-to-stages-data.json]')
        sys.exit(1)
    
    # Read stages data
    try:
        with open(stages_file, 'r', encoding='utf-8') as f:
            stages_data = json.load(f)
    except json.JSONDecodeError as e:
        print(f'Error parsing JSON file: {e}')
        sys.exit(1)
    except Exception as e:
        print(f'Error reading file: {e}')
        sys.exit(1)
    
    # Ensure stages_data is a list
    if not isinstance(stages_data, list):
        print('Error: Stages data must be an array')
        sys.exit(1)
    
    if len(stages_data) == 0:
        print('Error: No stages data found in file')
        sys.exit(1)
    
    print(f'Found {len(stages_data)} stage(s) to upload')
    
    # Initialize Firebase Admin
    try:
        # Try to use default credentials (from GOOGLE_APPLICATION_CREDENTIALS)
        try:
            cred = credentials.ApplicationDefault()
            initialize_app(cred)
        except ValueError:
            # Already initialized, continue
            pass
        except Exception:
            # If default credentials fail, try service account file
            try:
                service_account_path = os.getenv('SERVICE_ACCOUNT_PATH', './serviceAccountKey.json')
                if os.path.exists(service_account_path):
                    cred = credentials.Certificate(service_account_path)
                    initialize_app(cred)
                else:
                    print('Error: Firebase Admin not initialized.')
                    print('Please set GOOGLE_APPLICATION_CREDENTIALS environment variable')
                    print('or provide serviceAccountKey.json file in the current directory.')
                    sys.exit(1)
            except ValueError:
                # Already initialized, continue
                pass
    except Exception as e:
        print(f'Error initializing Firebase Admin: {e}')
        sys.exit(1)
    
    db = firestore.client()
    
    # Check if stages collection exists
    print('Checking if stages collection exists...')
    if not check_stages_collection(db):
        print('Error: stages collection not found or not accessible')
        sys.exit(1)
    
    print('Stages collection found. Uploading documents...')
    
    try:
        upload_stages(db, stages_data)
        print(f'Successfully uploaded {len(stages_data)} stage document(s)')
    except Exception as e:
        print(f'Error uploading stages: {e}')
        sys.exit(1)
    
    print('Upload complete!')

if __name__ == '__main__':
    main()

