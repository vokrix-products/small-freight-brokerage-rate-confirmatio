import os, sys, time, requests, json, traceback
from datetime import datetime

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_SERVICE_KEY = os.environ['SUPABASE_SERVICE_KEY']
PRODUCT_ID = os.environ['PRODUCT_ID']
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')

import processor

def download_file(bucket, file_path):
    if file_path.startswith(bucket + "/"):
        file_path = file_path[len(bucket) + 1:]
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{file_path}"
    resp = requests.get(url, headers={"Authorization": f"Bearer {SUPABASE_SERVICE_KEY}", "apikey": SUPABASE_SERVICE_KEY})
    resp.raise_for_status()
    return resp.content

HEADERS = {"Authorization": f"Bearer {SUPABASE_SERVICE_KEY}", "apikey": SUPABASE_SERVICE_KEY, "Content-Type": "application/json"}
BASE_URL = f"{SUPABASE_URL}/rest/v1"

def process_job(job):
    job_id = job['id']
    customer_id = job['customer_id']
    input_file_path = job['input_file_path']
    print(f"Processing job {job_id} for customer {customer_id}")
    try:
        # Download file from uploads bucket
        file_bytes = download_file('uploads', input_file_path)
        # Process with processor
        try:
            result = processor.process_file(file_bytes)
        except Exception as e:
            # Fallback: if process_file doesn't exist, try extract_text and send to Claude?
            # Assuming processor.py defines process_file; if not, handle gracefully
            raise e

        # Build record details
        title = f"Extracted data from {os.path.basename(input_file_path)}"
        details = result if isinstance(result, dict) else {"raw_result": str(result)}
        # Determine initial status based on confidence? Default to 'Valid:good' or something
        status = details.get('status', 'Valid:good')
        if isinstance(details, dict) and details.get('confidence') and details['confidence'] < 0.8:
            status = 'Needs Review:warning'
        # Insert record
        record = {
            "product_id": PRODUCT_ID,
            "customer_id": customer_id,
            "title": title,
            "status": status,
            "details": details,
            "source_file_path": input_file_path,
            "due_date": None
        }
        r = requests.post(f"{BASE_URL}/records", headers=HEADERS, json=record)
        r.raise_for_status()
        record_id = r.json()[0]['id']

        # Upload result to results bucket
        result_filename = f"{job_id}_result.json"
        result_bytes = json.dumps({"record_id": record_id, **details}).encode('utf-8')
        upload_headers = {"Authorization": f"Bearer {SUPABASE_SERVICE_KEY}", "apikey": SUPABASE_SERVICE_KEY, "Content-Type": "application/octet-stream"}
        r2 = requests.post(f"{SUPABASE_URL}/storage/v1/object/results/{result_filename}", headers=upload_headers, data=result_bytes)
        r2.raise_for_status()

        # Update job as completed
        patch_data = {
            "status": "completed",
            "output_file_path": f"results/{result_filename}",
            "result_summary": f"Record {record_id} created",
            "completed_at": datetime.now().isoformat()
        }
        r3 = requests.patch(f"{BASE_URL}/jobs?id=eq.{job_id}", headers=HEADERS, json=patch_data)
        r3.raise_for_status()

        # Insert notification (success)
        try:
            notification = {
                "product_id": PRODUCT_ID,
                "customer_id": customer_id,
                "title": "Processing complete",
                "body": "Your upload has been processed successfully.",
                "type": "success",
                "read": False
            }
            requests.post(f"{BASE_URL}/notifications", headers=HEADERS, json=notification)
        except Exception:
            pass

    except Exception as e:
        print(f"Job {job_id} failed: {e}")
        # Update job as failed
        fail_data = {
            "status": "failed",
            "result_summary": str(e)[:500],
            "completed_at": datetime.now().isoformat()
        }
        try:
            requests.patch(f"{BASE_URL}/jobs?id=eq.{job_id}", headers=HEADERS, json=fail_data)
        except Exception:
            pass
        # Insert notification (failure)
        try:
            notification = {
                "product_id": PRODUCT_ID,
                "customer_id": job.get('customer_id'),
                "title": "Processing failed",
                "body": f"There was an error processing your upload: {str(e)[:200]}",
                "type": "error",
                "read": False
            }
            requests.post(f"{BASE_URL}/notifications", headers=HEADERS, json=notification)
        except Exception:
            pass

def main():
    print("Poller starting...")
    while True:
        try:
            # Poll for pending process_upload jobs
            params = {
                "status": "eq.pending",
                "job_type": "eq.process_upload",
                "product_id": f"eq.{PRODUCT_ID}",
                "order": "created_at.asc",
                "limit": 5
            }
            resp = requests.get(f"{BASE_URL}/jobs", headers=HEADERS, params=params)
            resp.raise_for_status()
            jobs = resp.json()
            for job in jobs:
                process_job(job)
        except Exception as e:
            traceback.print_exc()
        time.sleep(60)

if __name__ == "__main__":
    main()
