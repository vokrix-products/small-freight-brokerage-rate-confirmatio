import sys
from processor import process_file

def main():
    # A realistic CSV representing a rate confirmation extract
    test_bytes = (
        b"carrier_name,load_id,pickup_date,delivery_date,origin,destination,equipment,total_rate,commodity,weight\n"
        b"ABC Trucking,L1234,2025-04-10,2025-04-12,Chicago IL,Atlanta GA,Dry Van,2500,Electronics,20000"
    )
    results = process_file(test_bytes)
    assert isinstance(results, list), "Result must be a list"
    assert len(results) > 0, "At least one record expected"
    rec = results[0]
    assert "title" in rec
    assert "status" in rec
    assert "details" in rec
    assert "due_date" in rec
    print("Demo successful. Record:", rec)
    return 0

if __name__ == "__main__":
    sys.exit(main())
