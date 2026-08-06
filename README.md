# Small Freight Brokerage Rate Confirmation and BOL Document Auto-Ingestion Tool (TMS Pre-Population)

## Product
An AI-powered backend service that ingests carrier Rate Confirmation and Bill of Lading (BOL) documents (PDF, Excel, CSV, or plain text) and automatically extracts structured freight data to pre-populate a freight brokerage TMS. The extraction is powered by the DeepSeek LLM, which reads the document text and returns typed fields with confidence scores.

## Archetype
Document AI / Intelligent Document Processing (IDP). The tool converts unstructured and semi-structured transportation documents into structured TMS records, reducing manual data entry for freight brokers.

## What the Poller Expects as Input
The backend exposes one core function: process_file(file_bytes) -> list[dict].

Input expectations:
- File bytes of a single document: PDF (.pdf), Excel (.xlsx), CSV (.csv), or plain text (.txt)
- The document must be a carrier Rate Confirmation or Bill of Lading (BOL)
- Environment variable DEEPSEEK_API_KEY must be set; the backend calls DeepSeek chat completions for extraction

Output record schema (one dict per document):
- title: extracted carrier_name (fallback: "Unknown Carrier")
- status: "Valid:good", "Missing:critical", "Low Confidence:warning", or "Needs Review:warning"
- details: dict of extracted fields (carrier_mc, customer_name, load_id, carrier_pro, customer_po, pickup_date, delivery_date, origin_city, origin_state, origin_zip, destination_city, destination_state, destination_zip, equipment_type, commodity, weight, pieces, total_rate, rate_type, miles, fsc, detention_rate, lumper_fee, tonu, accessorials, payment_terms, document_type)
- due_date: pickup_date or delivery_date in ISO-8601 (YYYY-MM-DD)

Dashboard: https://small-freight-brokerage-rate-confirmatio.vokrix.co
Vercel: small-freight-brokerage-rate-confirmatio
Railway: 
Railway: small-freight-brokerage-rate-confirmatio
Cloudflare: small-freight-brokerage-rate-confirmatio.vokrix.co

Billing: price_1U1Ohu2c9uGCcgMSRWZmsWcA

Landing: https://vokrix.co/small-freight-brokerage-rate-confirmatio

Outreach: active
