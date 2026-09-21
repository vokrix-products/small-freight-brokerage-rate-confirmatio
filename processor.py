import os
import json
import io
import re
import datetime
import logging
import pdfplumber
import openpyxl
from openai import OpenAI

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

client = OpenAI(
    api_key=os.environ["DEEPSEEK_API_KEY"],
    base_url="https://api.deepseek.com"
)

# Every freight field the model is asked to extract.
FREIGHT_FIELDS = [
    "carrier_name", "carrier_mc", "customer_name", "load_id", "carrier_pro",
    "customer_po", "pickup_date", "delivery_date", "origin_city",
    "origin_state", "origin_zip", "destination_city", "destination_state",
    "destination_zip", "equipment_type", "commodity", "weight", "pieces",
    "total_rate", "rate_type", "miles", "fsc", "detention_rate", "lumper_fee",
    "tonu", "accessorials", "payment_terms",
]

# A document must populate at least this many freight fields before we accept
# it as a rate confirmation / BOL. Guards against silently creating empty
# records from unrelated files (e.g. a construction budget spreadsheet).
MIN_POPULATED_FIELDS = 3

# Required fields, per document type. A BOL legitimately carries no rate, so
# total_rate / equipment_type must not be required for it.
CRITICAL_BY_TYPE = {
    "Rate Confirmation": [
        "carrier_name", "load_id", "pickup_date",
        "origin_city", "origin_state",
        "destination_city", "destination_state",
        "total_rate",
    ],
    "BOL": [
        "carrier_name", "load_id",
        "origin_city", "origin_state",
        "destination_city", "destination_state",
    ],
}
GENERIC_CRITICAL = ["carrier_name", "load_id", "origin_city", "destination_city"]

# Fields that should normally be present. Missing -> "Needs Review:warning",
# never "Missing:critical". Kept deliberately short: the long tail of purely
# optional fields must not push every record out of "Valid:good".
RECOMMENDED_BY_TYPE = {
    "Rate Confirmation": ["equipment_type", "commodity", "weight", "customer_name"],
    "BOL": ["commodity", "weight", "pieces", "pickup_date"],
}
GENERIC_RECOMMENDED = ["commodity", "weight"]

CONFIDENCE_THRESHOLD = 0.7

EXTRACTION_PROMPT = (
    "You are a freight document extraction assistant. "
    "From the provided document text, extract the following fields. "
    "Return a JSON object exactly like: "
    "{\"fields\": {\"carrier_name\": {\"value\": \"...\", \"confidence\": 0.0}, ...}, \"overall_confidence\": 0.0}. "
    "Fields to extract: carrier_name, carrier_mc, customer_name, load_id, carrier_pro, customer_po, "
    "pickup_date, delivery_date, origin_city, origin_state, origin_zip, destination_city, destination_state, "
    "destination_zip, equipment_type, commodity, weight, pieces, total_rate, rate_type, miles, fsc, "
    "detention_rate, lumpter_fee, tonu, accessorials, payment_terms, document_type. "
    "If a field is not found, set value to null and confidence to 0.0. Dates in ISO-8601 (YYYY-MM-DD). "
    "document_type must be either \"Rate Confirmation\" or \"BOL\"."
)


def _value(field):
    """Pull the value out of a {value, confidence} entry (or pass it through)."""
    if isinstance(field, dict):
        return field.get("value")
    return field


def _confidence(field) -> float:
    """Pull the confidence out of a {value, confidence} entry."""
    if isinstance(field, dict):
        conf = field.get("confidence", 0.0)
        if isinstance(conf, (int, float)):
            return float(conf)
    return 0.0


def _present(field) -> bool:
    """True when a field carries a real value (not null/empty/placeholder)."""
    value = _value(field)
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip().lower() not in ("", "null", "none", "n/a")
    return True


def normalize_document_type(fields: dict) -> str:
    """Map the model's document_type onto a known type, else 'Unknown'."""
    raw = _value(fields.get("document_type"))
    if not isinstance(raw, str):
        return "Unknown"
    low = raw.strip().lower()
    if re.search(r"\bbol\b", low) or "bill of lading" in low:
        return "BOL"
    if "rate" in low or "confirmation" in low:
        return "Rate Confirmation"
    return "Unknown"


def _extract_text(file_bytes: bytes) -> str:
    """Best-effort text extraction: PDF, then Excel, then UTF-8 plain text."""
    # Try PDF
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
        text = "\n".join(pages)
        if text.strip():
            logger.info("PDF parsed successfully")
            return text
    except Exception as e:
        logger.info("PDF parsing failed: %s", e)

    # Try Excel
    try:
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True)
        rows = []
        for sheet in wb.sheetnames:
            ws = wb[sheet]
            for row in ws.iter_rows(values_only=True):
                rows.append(",".join(str(c) if c is not None else "" for c in row))
        text = "\n".join(rows)
        if text.strip():
            logger.info("Excel parsed successfully")
            return text
    except Exception as e:
        logger.info("Excel parsing failed: %s", e)

    # Fallback to plain text
    logger.info("Using plain text fallback")
    return file_bytes.decode("utf-8", errors="ignore").lstrip("\ufeff")


def extract_fields(text: str) -> dict:
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": EXTRACTION_PROMPT},
            {"role": "user", "content": text}
        ],
        temperature=0.0,
        max_tokens=2000
    )
    content = response.choices[0].message.content
    try:
        start = content.find("{")
        end = content.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise json.JSONDecodeError("no JSON object found", content, 0)
        result = json.loads(content[start:end + 1])
        return result
    except json.JSONDecodeError:
        logger.error("Failed to parse AI response as JSON: %s", content)
        return {"fields": {}, "overall_confidence": 0.0}


def determine_status(fields: dict, document_type: str) -> str:
    critical = CRITICAL_BY_TYPE.get(document_type, GENERIC_CRITICAL)
    recommended = RECOMMENDED_BY_TYPE.get(document_type, GENERIC_RECOMMENDED)

    # Missing required field -> critical
    for field in critical:
        if not _present(fields.get(field)):
            return "Missing:critical"

    # Required field present but low confidence -> warning
    for field in critical:
        if _confidence(fields.get(field)) < CONFIDENCE_THRESHOLD:
            return "Low Confidence:warning"

    # Expected (but not required) field missing or low confidence -> needs review
    for field in recommended:
        if not _present(fields.get(field)):
            return "Needs Review:warning"
        if _confidence(fields.get(field)) < CONFIDENCE_THRESHOLD:
            return "Needs Review:warning"

    return "Valid:good"


def process_file(file_bytes: bytes) -> list[dict]:
    raw_text = _extract_text(file_bytes)

    if not raw_text.strip():
        raise ValueError(
            "No readable text could be extracted from the uploaded file. "
            "Supported inputs are rate confirmation / BOL PDF, Excel, CSV or plain text."
        )

    extracted = extract_fields(raw_text)
    fields = extracted.get("fields") or {}
    if not isinstance(fields, dict):
        fields = {}

    populated = sum(1 for name in FREIGHT_FIELDS if _present(fields.get(name)))
    if populated < MIN_POPULATED_FIELDS:
        raise ValueError(
            "Not a carrier rate confirmation or BOL: only "
            f"{populated} of {len(FREIGHT_FIELDS)} freight fields were recognised. "
            "No record was created for this upload."
        )

    document_type = normalize_document_type(fields)

    # Title = carrier_name
    title = _value(fields.get("carrier_name"))
    if not isinstance(title, str) or not title.strip():
        title = "Unknown Carrier"
    else:
        title = title.strip()

    # due_date = pickup_date or delivery_date, only when a valid ISO-8601 date
    due_date = None
    for key in ("pickup_date", "delivery_date"):
        candidate = _value(fields.get(key))
        if isinstance(candidate, str) and candidate.strip():
            candidate = candidate.strip()
            try:
                datetime.date.fromisoformat(candidate)
                due_date = candidate
                break
            except ValueError:
                continue

    # details: every field except carrier_name
    details = {}
    for k, v in fields.items():
        if k == "carrier_name":
            continue
        details[k] = _value(v)

    status = determine_status(fields, document_type)

    return [{
        "title": title,
        "status": status,
        "details": details,
        "due_date": due_date
    }]
