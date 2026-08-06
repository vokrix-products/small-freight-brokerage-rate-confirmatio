import os, sys, time, requests, json, traceback
from datetime import datetime

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_SERVICE_KEY = os.environ['SUPABASE_SERVICE_KEY']
PRODUCT_ID = os.environ['PRODUCT_ID']

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
    print(f"Processing job {job_id}")

    # Mark as processing immediately
    requests.patch(f"{BASE_URL}/jobs?id=eq.{job_id}", headers=HEADERS, json={"status": "processing"})

    try:
        file_bytes = download_file('uploads', input_file_path)
        results = processor.process_file(file_bytes)

        if not isinstance(results, list):
            results = [results]

        record_ids = []
        for item in results:
            record = {
                "product_id": PRODUCT_ID,
                "customer_id": customer_id,
                "title": item.get("title", "Unknown"),
                "status": item.get("status", "Valid:good"),
                "details": item.get("details", {}),
                "source_file_path": input_file_path,
                "due_date": item.get("due_date")
            }
            r = requests.post(f"{BASE_URL}/records", headers={**HEADERS, "Prefer": "return=representation"}, json=record)
            r.raise_for_status()
            record_ids.append(r.json()[0]['id'])

        patch_data = {
            "status": "completed",
            "result_summary": json.dumps({"records_created": len(record_ids)}),
            "completed_at": datetime.now().isoformat()
        }
        requests.patch(f"{BASE_URL}/jobs?id=eq.{job_id}", headers=HEADERS, json=patch_data)
        print(f"Job {job_id} complete — {len(record_ids)} records created")

        try:
            requests.post(f"{BASE_URL}/notifications", headers=HEADERS, json={
                "product_id": PRODUCT_ID,
                "customer_id": customer_id,
                "title": "Processing complete",
                "body": f"{len(record_ids)} records extracted successfully.",
                "type": "success",
                "read": False
            })
        except Exception:
            pass

    except Exception as e:
        print(f"Job {job_id} failed: {e}")
        traceback.print_exc()
        requests.patch(f"{BASE_URL}/jobs?id=eq.{job_id}", headers=HEADERS, json={
            "status": "failed",
            "result_summary": str(e)[:500],
            "completed_at": datetime.now().isoformat()
        })

def main():
    print("Poller starting...")
    while True:
        try:
            resp = requests.get(f"{BASE_URL}/jobs", headers=HEADERS, params={
                "status": "eq.pending",
                "job_type": "eq.process_upload",
                "product_id": f"eq.{PRODUCT_ID}",
                "order": "created_at.asc",
                "limit": 5
            })
            resp.raise_for_status()
            for job in resp.json():
                process_job(job)
        except Exception as e:
            traceback.print_exc()
        time.sleep(60)

if __name__ == "__main__":
    main()
